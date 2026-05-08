import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ErrorBox } from './ErrorBox';
import { Input } from './Input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import {
  checkSmsPermission,
  requestSmsPermission,
  readBankSmsMessages,
} from '@/lib/smsReader';
import type { BankSmsMessage } from '@/lib/smsReader';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { X, MessageSquare, ChevronRight } from 'lucide-react-native';
import type { Account, Category, TransactionType } from '@/lib/types';

interface SmsBankImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'list' | 'review';

export function SmsBankImportModal({ visible, onClose, onSuccess }: SmsBankImportModalProps) {
  const { user } = useAuth();

  // List step state
  const [step, setStep] = useState<Step>('list');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState<BankSmsMessage[]>([]);
  const [listError, setListError] = useState('');

  // Review step state
  const [selectedMessage, setSelectedMessage] = useState<BankSmsMessage | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (visible) {
      loadSms();
      loadAccountsAndCategories();
    }
  }, [visible]);

  const loadSms = async () => {
    if (Platform.OS !== 'android') {
      setListError('La lectura de SMS solo está disponible en Android nativo (no en Expo Go ni web)');
      return;
    }

    setLoadingMessages(true);
    setListError('');

    const hasPermission = await checkSmsPermission();
    if (!hasPermission) {
      const granted = await requestSmsPermission();
      if (!granted) {
        setListError('Permiso de SMS denegado. Ve a Configuración → Aplicaciones → MiFinanzas → Permisos y activa SMS.');
        setLoadingMessages(false);
        return;
      }
    }

    try {
      const bankMessages = await readBankSmsMessages(60);
      setMessages(bankMessages);
      if (bankMessages.length === 0) {
        setListError('No se encontraron mensajes bancarios en los últimos 60 días. Asegúrate de tener SMS de tu banco en la bandeja de entrada.');
      }
    } catch (e: any) {
      setListError(e.message || 'Error al leer los mensajes');
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadAccountsAndCategories = async () => {
    if (!user) return;
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('categories')
          .select('*')
          .or(`user_id.eq.${user.id},is_default.eq.true`)
          .order('name'),
      ]);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (e) {
      console.error('Error loading accounts/categories:', e);
    }
  };

  const handleSelectMessage = (message: BankSmsMessage) => {
    setSelectedMessage(message);
    setEditAmount(message.parsed.amount?.toString() || '');
    setEditDescription(message.parsed.description || '');
    // Normalizar al subconjunto de tipos válidos en DB ('income' | 'expense')
    setEditType(message.parsed.suggestedType === 'income' ? 'income' : 'expense');
    setAccountId('');
    setCategoryId('');
    setFormError('');
    setStep('review');
  };

  const handleSaveTransaction = async () => {
    const amountValue = parseFloat(editAmount);
    if (!amountValue || amountValue <= 0) {
      setFormError('El monto debe ser mayor a cero');
      return;
    }
    if (!accountId) {
      setFormError('Debes seleccionar una cuenta');
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Cuenta no encontrada');

      const { error } = await supabase.from('transactions').insert({
        user_id: user!.id,
        account_id: accountId,
        category_id: categoryId || null,
        type: editType,
        amount: amountValue,
        description: editDescription.trim() || selectedMessage?.sender || 'Transacción bancaria',
        transaction_date: selectedMessage?.date.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
        origin: 'manual_message',
        status: 'confirmed',
        is_recurring: false,
      });

      if (error) throw error;

      const balanceChange = editType === 'income' ? amountValue : -amountValue;
      await supabase
        .from('accounts')
        .update({ balance: account.balance + balanceChange })
        .eq('id', accountId);

      // Remove the saved message from the list
      setMessages(prev => prev.filter(m => m.id !== selectedMessage?.id));
      setStep('list');
      onSuccess();
      Alert.alert('Éxito', 'Transacción registrada correctamente');
    } catch (e: any) {
      setFormError(e.message || 'No se pudo crear la transacción');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('list');
    setMessages([]);
    setListError('');
    setSelectedMessage(null);
    setFormError('');
    onClose();
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return COLORS.success;
    if (score >= 0.4) return COLORS.warning;
    return COLORS.error;
  };

  const filteredCategories = categories.filter(c =>
    editType === 'income' ? c.type === 'income' : c.type !== 'income'
  );

  const renderSmsItem = ({ item }: { item: BankSmsMessage }) => (
    <TouchableOpacity style={styles.smsItem} onPress={() => handleSelectMessage(item)}>
      <View style={styles.smsItemLeft}>
        <View
          style={[
            styles.confidenceDot,
            { backgroundColor: getConfidenceColor(item.parsed.confidenceScore) },
          ]}
        />
        <View style={styles.smsItemContent}>
          <Text style={styles.smsSender}>{item.sender}</Text>
          <Text style={styles.smsBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.smsDate}>
            {item.date.toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>
      <View style={styles.smsItemRight}>
        {item.parsed.amount != null && (
          <Text style={styles.smsAmount}>{formatCurrency(item.parsed.amount)}</Text>
        )}
        <ChevronRight size={16} color={COLORS.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {step === 'review' && (
              <TouchableOpacity onPress={() => setStep('list')} style={styles.backButton}>
                <Text style={styles.backText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.title}>
                {step === 'list' ? 'Mensajes Bancarios' : 'Revisar Transacción'}
              </Text>
              {step === 'list' && messages.length > 0 && (
                <Text style={styles.subtitle}>{messages.length} mensaje(s) detectado(s)</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleClose}>
            <X size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* ── STEP: LIST ── */}
        {step === 'list' && (
          <>
            {loadingMessages ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Leyendo mensajes bancarios...</Text>
              </View>
            ) : listError ? (
              <View style={styles.centered}>
                <MessageSquare size={48} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>{listError}</Text>
                <Button title="Reintentar" onPress={loadSms} style={styles.retryButton} />
              </View>
            ) : (
              <FlatList
                data={messages}
                renderItem={renderSmsItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === 'review' && selectedMessage && (
          <ScrollView style={styles.reviewContent}>
            {/* SMS original */}
            <View style={styles.originalSmsCard}>
              <Text style={styles.originalSmsLabel}>Mensaje original · {selectedMessage.sender}</Text>
              <Text style={styles.originalSmsBody}>{selectedMessage.body}</Text>
            </View>

            {/* Tipo */}
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeSelector}>
              {(
                [
                  { label: 'Gasto', value: 'expense' as TransactionType },
                  { label: 'Ingreso', value: 'income' as TransactionType },
                ]
              ).map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeOption, editType === t.value && styles.typeOptionSelected]}
                  onPress={() => { setEditType(t.value); setCategoryId(''); }}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      editType === t.value && styles.typeOptionTextSelected,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Monto"
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="numeric"
              placeholder="0"
            />

            <Input
              label="Descripción"
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Descripción del movimiento"
            />

            {/* Cuenta */}
            <Text style={styles.label}>Cuenta (requerida)</Text>
            <View style={styles.optionsGrid}>
              {accounts.map(account => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.option, accountId === account.id && styles.optionSelected]}
                  onPress={() => setAccountId(account.id)}
                >
                  <Text
                    style={[styles.optionText, accountId === account.id && styles.optionTextSelected]}
                  >
                    {account.name}
                  </Text>
                  <Text
                    style={[
                      styles.optionSubtext,
                      accountId === account.id && styles.optionSubtextSelected,
                    ]}
                  >
                    {formatCurrency(account.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Categoría */}
            {filteredCategories.length > 0 && (
              <>
                <Text style={styles.label}>Categoría (opcional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  <View style={styles.optionsRow}>
                    <TouchableOpacity
                      style={[styles.option, !categoryId && styles.optionSelected]}
                      onPress={() => setCategoryId('')}
                    >
                      <Text style={[styles.optionText, !categoryId && styles.optionTextSelected]}>
                        Sin categoría
                      </Text>
                    </TouchableOpacity>
                    {filteredCategories.map(category => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.option,
                          categoryId === category.id && styles.optionSelected,
                        ]}
                        onPress={() => setCategoryId(category.id)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            categoryId === category.id && styles.optionTextSelected,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {formError ? <ErrorBox message={formError} /> : null}

            <View style={styles.actions}>
              <Button
                title="Cancelar"
                onPress={() => setStep('list')}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title="Guardar"
                onPress={handleSaveTransaction}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
    gap: SPACING.xs,
  },
  backButton: {
    marginBottom: SPACING.xs / 2,
  },
  backText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: SPACING.sm,
    minWidth: 120,
  },
  listContent: {
    padding: SPACING.md,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  smsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
  },
  smsItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: SPACING.sm,
  },
  confidenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  smsItemContent: {
    flex: 1,
  },
  smsSender: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  smsBody: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  smsDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  smsItemRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
    paddingLeft: SPACING.sm,
  },
  smsAmount: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  reviewContent: {
    padding: SPACING.lg,
  },
  originalSmsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  originalSmsLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  originalSmsBody: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  typeOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  typeOptionTextSelected: {
    color: COLORS.background,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  categoryScroll: {
    marginTop: SPACING.xs,
  },
  option: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  optionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  optionTextSelected: {
    color: COLORS.background,
  },
  optionSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  optionSubtextSelected: {
    color: COLORS.background,
    opacity: 0.8,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
});
