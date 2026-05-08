import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { parseNotification } from '@/lib/notificationParser';
import { applyClassificationRules } from '@/lib/rulesEngine';
import { formatCurrency } from '@/lib/utils';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import type { Account, Category, AutoRule, TransactionType } from '@/lib/types';
import { X, MessageSquare, Sparkles } from 'lucide-react-native';

interface ManualMessageProcessorProps {
  visible: boolean;
  onClose: () => void;
}

export function ManualMessageProcessor({
  visible,
  onClose,
}: ManualMessageProcessorProps) {
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<AutoRule[]>([]);

  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [confidenceScore, setConfidenceScore] = useState(0);

  React.useEffect(() => {
    if (visible && user) {
      loadData();
    }
  }, [visible, user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [accountsData, categoriesData, rulesData] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase
          .from('categories')
          .select('*')
          .or(`user_id.eq.${user.id},is_default.eq.true`),
        supabase
          .from('auto_rules')
          .select('*')
          .or(`user_id.eq.${user.id},is_default.eq.true`)
          .eq('is_active', true)
          .order('priority', { ascending: false }),
      ]);

      if (accountsData.data) setAccounts(accountsData.data);
      if (categoriesData.data) setCategories(categoriesData.data);
      if (rulesData.data) setRules(rulesData.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleParseMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert('Error', 'Ingresa el texto del mensaje bancario');
      return;
    }

    setLoading(true);

    try {
      const parsedData = parseNotification('Mensaje bancario', messageText);

      setEditAmount(parsedData.amount?.toString() || '');
      setEditDescription(parsedData.description || '');
      setEditType(parsedData.suggestedType === 'income' ? 'income' : 'expense');
      setConfidenceScore(parsedData.confidenceScore);

      if (parsedData.amount && parsedData.description && rules.length > 0 && editAccountId) {
        const classification = applyClassificationRules(
          parsedData.description,
          parsedData.amount,
          editAccountId,
          rules
        );
        if (classification.categoryId) {
          setEditCategoryId(classification.categoryId);
        }
      }

      setParsed(true);
    } catch (error) {
      console.error('Error parsing message:', error);
      Alert.alert('Error', 'No se pudo procesar el mensaje');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!user) return;

    const amount = parseFloat(editAmount);
    if (!editAccountId || !amount || amount <= 0) {
      Alert.alert('Error', 'Selecciona una cuenta y verifica el monto');
      return;
    }

    try {
      setLoading(true);

      const account = accounts.find(a => a.id === editAccountId);
      if (!account) throw new Error('Cuenta no encontrada');

      const { data: transaction, error: transError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: editAccountId,
          category_id: editCategoryId || null,
          type: editType,
          amount: Math.abs(amount),
          description: editDescription || 'Transacción desde mensaje',
          transaction_date: new Date().toISOString(),
          origin: 'manual_message',
          status: 'confirmed',
        })
        .select()
        .single();

      if (transError) throw transError;

      const balanceChange = editType === 'income' ? Math.abs(amount) : -Math.abs(amount);

      await supabase
        .from('accounts')
        .update({ balance: account.balance + balanceChange })
        .eq('id', editAccountId);

      Alert.alert('Éxito', 'Transacción creada correctamente');
      handleReset();
      onClose();
    } catch (error) {
      console.error('Error creating transaction:', error);
      Alert.alert('Error', 'No se pudo crear la transacción');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessageText('');
    setParsed(false);
    setEditAmount('');
    setEditDescription('');
    setEditAccountId('');
    setEditCategoryId('');
    setEditType('expense');
    setConfidenceScore(0);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return COLORS.success;
    if (score >= 0.4) return COLORS.warning;
    return COLORS.error;
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.7) return 'Alta';
    if (score >= 0.4) return 'Media';
    return 'Baja';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Procesar Mensaje</Text>
            <Text style={styles.subtitle}>Pega un mensaje bancario</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {!parsed ? (
            <>
              <Card style={styles.instructionCard}>
                <View style={styles.instructionHeader}>
                  <MessageSquare size={24} color={COLORS.primary} />
                  <Text style={styles.instructionTitle}>
                    Copia y pega un mensaje bancario
                  </Text>
                </View>
                <Text style={styles.instructionText}>
                  Ejemplos de mensajes que puedes procesar:{'\n\n'}
                  • Compra aprobada por $45.000 en EXITO{'\n'}
                  • Transferencia recibida por $1.200.000{'\n'}
                  • Pago exitoso por $89.900 a NETFLIX{'\n'}
                  • Retiro por $200.000 cajero ATH
                </Text>
              </Card>

              <Text style={styles.label}>Mensaje bancario</Text>
              <TextInput
                style={styles.textArea}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Pega aquí el mensaje del banco..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <Button
                title="Analizar Mensaje"
                onPress={handleParseMessage}
                loading={loading}
                fullWidth
                icon={<Sparkles size={20} color={COLORS.background} />}
                style={styles.parseButton}
              />
            </>
          ) : (
            <>
              <Card style={styles.resultCard}>
                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceLabel}>Confianza del análisis</Text>
                  <View style={styles.confidenceBadge}>
                    <View
                      style={[
                        styles.confidenceDot,
                        { backgroundColor: getConfidenceColor(confidenceScore) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.confidenceText,
                        { color: getConfidenceColor(confidenceScore) },
                      ]}
                    >
                      {getConfidenceLabel(confidenceScore)} ({Math.round(confidenceScore * 100)}%)
                    </Text>
                  </View>
                </View>

                {confidenceScore < 0.4 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      Confianza baja. Verifica los datos extraídos.
                    </Text>
                  </View>
                )}
              </Card>

              <Text style={styles.label}>Monto</Text>
              <Input
                value={editAmount}
                onChangeText={setEditAmount}
                placeholder="0"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Descripción</Text>
              <Input
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Descripción del movimiento"
              />

              <Text style={styles.label}>Cuenta</Text>
              <View style={styles.optionsContainer}>
                {accounts.map(account => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.option,
                      editAccountId === account.id && styles.optionSelected,
                    ]}
                    onPress={() => setEditAccountId(account.id)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        editAccountId === account.id && styles.optionTextSelected,
                      ]}
                    >
                      {account.name}
                    </Text>
                    <Text
                      style={[
                        styles.optionSubtext,
                        editAccountId === account.id && styles.optionSubtextSelected,
                      ]}
                    >
                      {formatCurrency(account.balance)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Categoría</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                <View style={styles.optionsContainer}>
                  {categories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.option,
                        editCategoryId === category.id && styles.optionSelected,
                      ]}
                      onPress={() => setEditCategoryId(category.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          editCategoryId === category.id && styles.optionTextSelected,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Tipo</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    editType === 'expense' && styles.typeOptionSelected,
                  ]}
                  onPress={() => setEditType('expense')}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      editType === 'expense' && styles.typeOptionTextSelected,
                    ]}
                  >
                    Gasto
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    editType === 'income' && styles.typeOptionSelected,
                  ]}
                  onPress={() => setEditType('income')}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      editType === 'income' && styles.typeOptionTextSelected,
                    ]}
                  >
                    Ingreso
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actions}>
                <Button
                  title="Reintentar"
                  onPress={handleReset}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Crear Transacción"
                  onPress={handleCreateTransaction}
                  loading={loading}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  instructionCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  instructionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  instructionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  textArea: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    minHeight: 120,
  },
  parseButton: {
    marginTop: SPACING.lg,
  },
  resultCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  confidenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  warningBox: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.warning + '20',
    borderRadius: RADIUS.sm,
  },
  warningText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.warning,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  horizontalScroll: {
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
  typeSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  typeOption: {
    flex: 1,
    paddingVertical: SPACING.md,
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
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  typeOptionTextSelected: {
    color: COLORS.background,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
});
