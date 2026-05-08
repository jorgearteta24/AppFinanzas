import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Plus, Target, X, TrendingUp, Wallet } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ErrorBox } from '@/components/ErrorBox';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

interface SavingsGoal {
  id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  destination_account_id?: string;
  color: string;
  icon: string;
  is_completed: boolean;
  is_active: boolean;
  account?: { name: string };
}

interface Account {
  id: string;
  name: string;
  type: string;
}

const GOAL_COLORS = [
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EF4444',
];

export default function GoalsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [contributionModal, setContributionModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [contributionError, setContributionError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount: '',
    target_date: '',
    destination_account_id: '',
    color: GOAL_COLORS[0],
  });

  const [contributionData, setContributionData] = useState({
    amount: '',
    createTransaction: false,
    account_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    try {
      const [goalsRes, accountsRes] = await Promise.all([
        supabase
          .from('savings_goals')
          .select('*, account:accounts!savings_goals_destination_account_id_fkey(name)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),

        supabase
          .from('accounts')
          .select('id, name, type')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (accountsRes.error) throw accountsRes.error;

      setGoals(goalsRes.data || []);
      setAccounts(accountsRes.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al cargar metas');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!formData.name.trim()) {
      setFormError('El nombre de la meta es requerido');
      return;
    }

    const targetAmount = parseFloat(formData.target_amount);
    if (!targetAmount || targetAmount <= 0) {
      setFormError('El monto objetivo debe ser mayor a cero');
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      const { error } = await supabase.from('savings_goals').insert({
        user_id: user!.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        target_amount: targetAmount,
        current_amount: 0,
        target_date: formData.target_date || null,
        destination_account_id: formData.destination_account_id || null,
        color: formData.color,
        icon: 'piggy-bank',
        is_completed: false,
        is_active: true,
      });

      if (error) throw error;

      Alert.alert('Éxito', 'Meta de ahorro creada correctamente');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      setFormError(error.message || 'Error al crear meta');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_amount: '',
      target_date: '',
      destination_account_id: '',
      color: GOAL_COLORS[0],
    });
  };

  const handleContribution = async (isWithdrawal: boolean = false) => {
    if (!selectedGoal) return;

    const amount = parseFloat(contributionData.amount);
    if (!amount || amount <= 0) {
      setContributionError('El monto debe ser mayor a cero');
      return;
    }

    if (isWithdrawal && amount > selectedGoal.current_amount) {
      setContributionError('No puedes retirar más de lo que tienes ahorrado');
      return;
    }

    if (contributionData.createTransaction && !contributionData.account_id) {
      setContributionError('Debes seleccionar una cuenta para crear la transacción');
      return;
    }

    setContributionError('');

    setSaving(true);
    try {
      const newAmount = isWithdrawal
        ? selectedGoal.current_amount - amount
        : selectedGoal.current_amount + amount;

      const isCompleted = newAmount >= selectedGoal.target_amount;

      const { error: updateError } = await supabase
        .from('savings_goals')
        .update({
          current_amount: newAmount,
          is_completed: isCompleted,
        })
        .eq('id', selectedGoal.id);

      if (updateError) throw updateError;

      if (contributionData.createTransaction) {
        const { data: categoryData } = await supabase
          .from('categories')
          .select('id')
          .eq('type', isWithdrawal ? 'savings' : 'savings')
          .eq('is_default', true)
          .limit(1)
          .maybeSingle();

        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user!.id,
          account_id: contributionData.account_id,
          category_id: categoryData?.id || null,
          type: isWithdrawal ? 'savings_withdrawal' : 'savings_deposit',
          amount,
          description: `${isWithdrawal ? 'Retiro' : 'Aporte'} a meta: ${selectedGoal.name}`,
          transaction_date: new Date().toISOString().split('T')[0],
          origin: 'manual',
          status: 'confirmed',
          is_recurring: false,
        });

        if (txError) throw txError;

        const { data: account } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', contributionData.account_id)
          .single();

        if (account) {
          const newBalance = isWithdrawal
            ? Number(account.balance) + amount
            : Number(account.balance) - amount;

          await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', contributionData.account_id);
        }
      }

      Alert.alert(
        'Éxito',
        isWithdrawal
          ? 'Retiro registrado correctamente'
          : isCompleted
          ? '¡Felicitaciones! Meta completada'
          : 'Aporte registrado correctamente'
      );
      setContributionModal(false);
      setContributionData({ amount: '', createTransaction: false, account_id: '' });
      setSelectedGoal(null);
      loadData();
    } catch (error: any) {
      setContributionError(error.message || 'Error al procesar la operación');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    Alert.alert('Desactivar meta', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desactivar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('savings_goals')
              .update({ is_active: false })
              .eq('id', goalId);

            if (error) throw error;

            Alert.alert('Éxito', 'Meta desactivada');
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al desactivar meta');
          }
        },
      },
    ]);
  };

  const renderGoal = ({ item }: { item: SavingsGoal }) => {
    const percentage = (item.current_amount / item.target_amount) * 100;
    const remaining = Math.max(item.target_amount - item.current_amount, 0);

    let monthsLeft = 0;
    let suggestedMonthly = 0;

    if (item.target_date && !item.is_completed) {
      const today = new Date();
      const target = new Date(item.target_date);
      monthsLeft = Math.max(
        Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)),
        1
      );
      suggestedMonthly = remaining / monthsLeft;
    }

    return (
      <TouchableOpacity onLongPress={() => handleDeleteGoal(item.id)} activeOpacity={0.7}>
        <Card style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View style={styles.goalInfo}>
              <Text style={styles.goalName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.goalDescription}>{item.description}</Text>
              )}
              <Text style={styles.goalTarget}>{formatCurrency(item.target_amount)}</Text>
            </View>
            <View style={[styles.goalIcon, { backgroundColor: item.color }]}>
              <Target size={24} color={COLORS.textInverse} />
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: item.is_completed ? COLORS.success : item.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {item.is_completed ? '¡Completada!' : `${percentage.toFixed(0)}%`}
            </Text>
          </View>

          <View style={styles.goalStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Ahorrado</Text>
              <Text style={[styles.statValue, { color: item.color }]}>
                {formatCurrency(item.current_amount)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Falta</Text>
              <Text style={styles.statValue}>{formatCurrency(remaining)}</Text>
            </View>
          </View>

          {!item.is_completed && suggestedMonthly > 0 && (
            <View style={styles.suggestionBox}>
              <TrendingUp size={16} color={COLORS.primary} />
              <Text style={styles.suggestionText}>
                Ahorra {formatCurrency(suggestedMonthly)}/mes para lograrlo en {monthsLeft}{' '}
                {monthsLeft === 1 ? 'mes' : 'meses'}
              </Text>
            </View>
          )}

          {item.account && (
            <View style={styles.accountBadge}>
              <Wallet size={14} color={COLORS.textSecondary} />
              <Text style={styles.accountText}>{item.account.name}</Text>
            </View>
          )}

          {!item.is_completed && (
            <View style={styles.actionButtons}>
              <Button
                title="Aportar"
                onPress={() => {
                  setSelectedGoal(item);
                  setContributionModal(true);
                }}
                variant="outline"
                style={styles.actionButton}
              />
              {item.current_amount > 0 && (
                <Button
                  title="Retirar"
                  onPress={() => {
                    setSelectedGoal(item);
                    setContributionData((prev) => ({ ...prev, isWithdrawal: true }));
                    setContributionModal(true);
                  }}
                  variant="ghost"
                  style={styles.actionButton}
                />
              )}
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Metas de Ahorro</Text>
          <Text style={styles.subtitle}>{goals.length} meta(s) activa(s)</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus size={24} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={goals}
        renderItem={renderGoal}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Target size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No tienes metas de ahorro</Text>
            <Button
              title="Crear primera meta"
              onPress={() => setModalVisible(true)}
              style={styles.emptyButton}
            />
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Meta de Ahorro</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setFormError(''); }}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Input
                label="Nombre de la meta"
                placeholder="Ej: Viaje a la playa"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <Input
                label="Descripción (opcional)"
                placeholder="Describe tu meta"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
              />

              <Input
                label="Monto objetivo"
                placeholder="0"
                value={formData.target_amount}
                onChangeText={(text) => setFormData({ ...formData, target_amount: text })}
                keyboardType="numeric"
              />

              <Input
                label="Fecha objetivo (opcional)"
                placeholder="YYYY-MM-DD"
                value={formData.target_date}
                onChangeText={(text) => setFormData({ ...formData, target_date: text })}
              />

              <Text style={styles.label}>Cuenta destino (opcional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.accountScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.accountButton,
                    !formData.destination_account_id && styles.accountButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, destination_account_id: '' })}
                >
                  <Text
                    style={[
                      styles.accountButtonText,
                      !formData.destination_account_id && styles.accountButtonTextActive,
                    ]}
                  >
                    Ninguna
                  </Text>
                </TouchableOpacity>
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.accountButton,
                      formData.destination_account_id === account.id &&
                        styles.accountButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, destination_account_id: account.id })
                    }
                  >
                    <Text
                      style={[
                        styles.accountButtonText,
                        formData.destination_account_id === account.id &&
                          styles.accountButtonTextActive,
                      ]}
                    >
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {GOAL_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      formData.color === color && styles.colorButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, color })}
                  />
                ))}
              </View>

              {formError ? <ErrorBox message={formError} /> : null}

              <Button
                title="Crear Meta"
                onPress={handleSaveGoal}
                loading={saving}
                fullWidth
                style={[styles.saveButton, { marginBottom: insets.bottom + SPACING.md }]}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={contributionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {(contributionData as any).isWithdrawal ? 'Retirar de Meta' : 'Aportar a Meta'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setContributionModal(false);
                  setContributionData({ amount: '', createTransaction: false, account_id: '' });
                  setSelectedGoal(null);
                  setContributionError('');
                }}
              >
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedGoal && (
                <View style={styles.goalSummary}>
                  <Text style={styles.goalSummaryName}>{selectedGoal.name}</Text>
                  <Text style={styles.goalSummaryAmount}>
                    Ahorrado: {formatCurrency(selectedGoal.current_amount)}
                  </Text>
                </View>
              )}

              <Input
                label="Monto"
                placeholder="0"
                value={contributionData.amount}
                onChangeText={(text) =>
                  setContributionData({ ...contributionData, amount: text })
                }
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setContributionData({
                    ...contributionData,
                    createTransaction: !contributionData.createTransaction,
                  })
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    contributionData.createTransaction && styles.checkboxChecked,
                  ]}
                >
                  {contributionData.createTransaction && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Crear transacción en cuenta</Text>
              </TouchableOpacity>

              {contributionData.createTransaction && (
                <>
                  <Text style={styles.label}>Cuenta</Text>
                  {accounts.map((account) => (
                    <TouchableOpacity
                      key={account.id}
                      style={[
                        styles.accountOption,
                        contributionData.account_id === account.id &&
                          styles.accountOptionActive,
                      ]}
                      onPress={() =>
                        setContributionData({ ...contributionData, account_id: account.id })
                      }
                    >
                      <Text
                        style={[
                          styles.accountOptionText,
                          contributionData.account_id === account.id &&
                            styles.accountOptionTextActive,
                        ]}
                      >
                        {account.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {contributionError ? <ErrorBox message={contributionError} /> : null}

              <Button
                title={(contributionData as any).isWithdrawal ? 'Retirar' : 'Aportar'}
                onPress={() => handleContribution((contributionData as any).isWithdrawal)}
                loading={saving}
                fullWidth
                style={[styles.saveButton, { marginBottom: insets.bottom + SPACING.md }]}
              />
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
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
    marginTop: SPACING.xs,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.md,
  },
  goalCard: {
    marginBottom: SPACING.md,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  goalDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  goalTarget: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    minWidth: 70,
    textAlign: 'right',
  },
  goalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  suggestionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  accountText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['3xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    minWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  modalBody: {
    padding: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  accountScroll: {
    marginBottom: SPACING.md,
  },
  accountButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundSecondary,
    marginRight: SPACING.sm,
  },
  accountButtonActive: {
    backgroundColor: COLORS.primary,
  },
  accountButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  accountButtonTextActive: {
    color: COLORS.textInverse,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  colorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: COLORS.text,
  },
  saveButton: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  goalSummary: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  goalSummaryName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  goalSummaryAmount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  checkboxLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  accountOption: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
    marginBottom: SPACING.xs,
  },
  accountOptionActive: {
    backgroundColor: COLORS.primary,
  },
  accountOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  accountOptionTextActive: {
    color: COLORS.textInverse,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
