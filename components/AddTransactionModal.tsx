import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ErrorBox } from './ErrorBox';
import { Input } from './Input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { X } from 'lucide-react-native';
import type { Account, Category, TransactionType } from '@/lib/types';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TRANSACTION_TYPES: { label: string; value: TransactionType }[] = [
  { label: 'Gasto', value: 'expense' },
  { label: 'Ingreso', value: 'income' },
  { label: 'Transferencia', value: 'transfer' },
];

export function AddTransactionModal({ visible, onClose, onSuccess }: AddTransactionModalProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (visible && user) {
      loadData();
    }
  }, [visible, user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
        supabase.from('categories').select('*').or(`user_id.eq.${user.id},is_default.eq.true`).order('name'),
      ]);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSave = async () => {
    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue <= 0) {
      setFormError('El monto debe ser mayor a cero');
      return;
    }
    if (!accountId) {
      setFormError('Debes seleccionar una cuenta');
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError('La fecha debe tener el formato YYYY-MM-DD');
      return;
    }

    setFormError('');
    setLoading(true);
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Cuenta no encontrada');

      const { error } = await supabase.from('transactions').insert({
        user_id: user!.id,
        account_id: accountId,
        category_id: categoryId || null,
        type,
        amount: amountValue,
        description: description.trim() || 'Transacción manual',
        transaction_date: date,
        origin: 'manual',
        status: 'confirmed',
        is_recurring: false,
      });

      if (error) throw error;

      const balanceChange = type === 'income' ? amountValue : -amountValue;
      await supabase
        .from('accounts')
        .update({ balance: account.balance + balanceChange })
        .eq('id', accountId);

      Alert.alert('Éxito', 'Transacción creada correctamente');
      handleReset();
      onSuccess();
      onClose();
    } catch (error: any) {
      setFormError(error.message || 'No se pudo crear la transacción');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAmount('');
    setDescription('');
    setAccountId('');
    setCategoryId('');
    setType('expense');
    setDate(new Date().toISOString().split('T')[0]);
    setFormError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const filteredCategories = categories.filter(c =>
    type === 'income' ? c.type === 'income' : c.type !== 'income'
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Nueva Transacción</Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeSelector}>
              {TRANSACTION_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeOption, type === t.value && styles.typeOptionSelected]}
                  onPress={() => { setType(t.value); setCategoryId(''); }}
                >
                  <Text style={[styles.typeOptionText, type === t.value && styles.typeOptionTextSelected]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Monto"
              placeholder="0"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Input
              label="Descripción (opcional)"
              placeholder="Ej: Mercado, Nómina..."
              value={description}
              onChangeText={setDescription}
            />

            <Input
              label="Fecha"
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
            />

            <Text style={styles.label}>Cuenta</Text>
            <View style={styles.optionsGrid}>
              {accounts.map(account => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.option, accountId === account.id && styles.optionSelected]}
                  onPress={() => setAccountId(account.id)}
                >
                  <Text style={[styles.optionText, accountId === account.id && styles.optionTextSelected]}>
                    {account.name}
                  </Text>
                  <Text style={[styles.optionSubtext, accountId === account.id && styles.optionSubtextSelected]}>
                    {formatCurrency(account.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredCategories.length > 0 && (
              <>
                <Text style={styles.label}>Categoría (opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
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
                        style={[styles.option, categoryId === category.id && styles.optionSelected]}
                        onPress={() => setCategoryId(category.id)}
                      >
                        <Text style={[styles.optionText, categoryId === category.id && styles.optionTextSelected]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {formError ? <ErrorBox message={formError} /> : null}

            <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.md }]}>
              <Button title="Cancelar" onPress={handleClose} variant="outline" style={{ flex: 1 }} />
              <Button title="Guardar" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
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
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  body: {
    padding: SPACING.lg,
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
    marginBottom: SPACING.lg,
  },
});
