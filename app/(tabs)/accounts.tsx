import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ErrorBox } from '@/components/ErrorBox';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { Wallet, Plus, X, CreditCard as Edit2, Trash2 } from 'lucide-react-native';
import type { Account } from '@/lib/types';

export default function AccountsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'cash' | 'credit_card' | 'savings'>('checking');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAccounts();
  }, []);

  const handleOpenModal = (account?: Account) => {
    setSaveError('');
    if (account) {
      setEditingAccount(account);
      setName(account.name);
      setBalance(account.balance.toString());
      setAccountType(account.type as 'checking' | 'cash' | 'credit_card' | 'savings');
    } else {
      setEditingAccount(null);
      setName('');
      setBalance('0');
      setAccountType('checking');
    }
    setShowModal(true);
  };

  const handleSaveAccount = async () => {
    if (!user || !name.trim()) {
      setSaveError('El nombre de la cuenta es requerido');
      return;
    }
    setSaveError('');

    const balanceValue = parseFloat(balance) || 0;

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: name.trim(),
            balance: balanceValue,
            type: accountType,
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        Alert.alert('Éxito', 'Cuenta actualizada correctamente');
      } else {
        const { error } = await supabase.from('accounts').insert({
          user_id: user.id,
          name: name.trim(),
          balance: balanceValue,
          type: accountType,
          is_active: true,
        });

        if (error) throw error;
        Alert.alert('Éxito', 'Cuenta creada correctamente');
      }

      setShowModal(false);
      loadAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      setSaveError('No se pudo guardar la cuenta');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    Alert.alert('Confirmar eliminación', '¿Estás seguro de eliminar esta cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('accounts').delete().eq('id', accountId);

            if (error) throw error;
            loadAccounts();
          } catch (error) {
            console.error('Error deleting account:', error);
            Alert.alert('Error', 'No se pudo eliminar la cuenta');
          }
        },
      },
    ]);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      checking: 'Cuenta Bancaria',
      cash: 'Efectivo',
      credit_card: 'Tarjeta de Crédito',
      savings: 'Ahorro',
    };
    return labels[type] || type;
  };

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState message="Cargando cuentas..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Cuentas</Text>
            <Text style={styles.subtitle}>Administra tus cuentas bancarias</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => handleOpenModal()}>
            <Plus size={24} color={COLORS.background} />
          </TouchableOpacity>
        </View>

        {accounts.length > 0 && (
          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>Saldo Total</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalBalance)}</Text>
          </Card>
        )}

        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No hay cuentas"
            description="Agrega tus cuentas bancarias, tarjetas y efectivo para comenzar a llevar control de tus finanzas"
            actionLabel="Agregar Primera Cuenta"
            onAction={() => handleOpenModal()}
          />
        ) : (
          accounts.map(account => (
            <Card key={account.id} style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountType}>{getAccountTypeLabel(account.type)}</Text>
                </View>
                <Text style={styles.accountBalance}>{formatCurrency(account.balance)}</Text>
              </View>

              <View style={styles.accountActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenModal(account)}
                >
                  <Edit2 size={16} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteAccount(account.id)}
                >
                  <Trash2 size={16} color={COLORS.error} />
                  <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Nombre de la cuenta</Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Ej: Cuenta de ahorros Bancolombia"
              />

              <Text style={styles.label}>Saldo inicial</Text>
              <Input
                value={balance}
                onChangeText={setBalance}
                placeholder="0"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Tipo de cuenta</Text>
              <View style={styles.typeSelector}>
                {(['checking', 'cash', 'credit_card', 'savings'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      accountType === type && styles.typeOptionSelected,
                    ]}
                    onPress={() => setAccountType(type)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        accountType === type && styles.typeOptionTextSelected,
                      ]}
                    >
                      {getAccountTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {saveError ? (
              <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm }}>
                <ErrorBox message={saveError} />
              </View>
            ) : null}
            <View style={[styles.modalActions, { paddingBottom: insets.bottom + SPACING.lg }]}>
              <Button
                title="Cancelar"
                onPress={() => setShowModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={editingAccount ? 'Actualizar' : 'Crear'}
                onPress={handleSaveAccount}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  totalAmount: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  accountCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  accountType: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  accountBalance: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  accountActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  modalBody: {
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
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  typeOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  typeOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    textAlign: 'center',
  },
  typeOptionTextSelected: {
    color: COLORS.background,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
