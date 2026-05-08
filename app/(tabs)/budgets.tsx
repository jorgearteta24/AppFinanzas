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
import { Plus, Target, TrendingUp, CircleAlert as AlertCircle, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ErrorBox } from '@/components/ErrorBox';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

interface Budget {
  id: string;
  category_id: string | null;
  amount: number;
  month: number;
  year: number;
  alert_percentage: number;
  is_active: boolean;
  category?: { name: string; color: string };
  spent?: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export default function GoalsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    alert_percentage: '80',
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    if (!user) return;

    try {
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1)
        .toISOString()
        .split('T')[0];
      const lastDay = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      const [budgetsRes, categoriesRes, transactionsRes] = await Promise.all([
        supabase
          .from('budgets')
          .select('*, category:categories(name, color)')
          .eq('user_id', user.id)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .eq('is_active', true),

        supabase
          .from('categories')
          .select('*')
          .or(`user_id.eq.${user.id},is_default.eq.true`)
          .in('type', ['expense', 'debt'])
          .order('name'),

        supabase
          .from('transactions')
          .select('category_id, amount, type')
          .eq('user_id', user.id)
          .gte('transaction_date', firstDay)
          .lte('transaction_date', lastDay)
          .in('type', ['expense', 'debt_payment', 'bank_fee', 'savings_deposit']),
      ]);

      if (budgetsRes.error) throw budgetsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const spendingMap = new Map<string, number>();
      let totalSpent = 0;

      transactionsRes.data?.forEach((tx) => {
        const amount = Number(tx.amount);
        totalSpent += amount;

        if (tx.category_id) {
          const current = spendingMap.get(tx.category_id) || 0;
          spendingMap.set(tx.category_id, current + amount);
        }
      });

      const budgetsWithSpent = (budgetsRes.data || []).map((budget) => ({
        ...budget,
        spent: budget.category_id ? spendingMap.get(budget.category_id) || 0 : totalSpent,
      }));

      setBudgets(budgetsWithSpent);
      setCategories(categoriesRes.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al cargar presupuestos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormError('El monto debe ser mayor a cero');
      return;
    }

    const alertPercentage = parseInt(formData.alert_percentage);
    if (alertPercentage <= 0 || alertPercentage > 100) {
      setFormError('El porcentaje de alerta debe estar entre 1 y 100');
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      const { error } = await supabase.from('budgets').insert({
        user_id: user!.id,
        category_id: formData.category_id || null,
        amount: parseFloat(formData.amount),
        month: selectedMonth,
        year: selectedYear,
        alert_percentage: alertPercentage,
        is_active: true,
      });

      if (error) throw error;

      Alert.alert('Éxito', 'Presupuesto creado correctamente');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      setFormError(error.message || 'Error al crear presupuesto');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      amount: '',
      alert_percentage: '80',
    });
  };

  const handleDeleteBudget = async (budgetId: string) => {
    Alert.alert('Eliminar presupuesto', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('budgets')
              .update({ is_active: false })
              .eq('id', budgetId);

            if (error) throw error;

            Alert.alert('Éxito', 'Presupuesto eliminado');
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al eliminar presupuesto');
          }
        },
      },
    ]);
  };

  const changeMonth = (direction: number) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const renderBudget = ({ item }: { item: Budget }) => {
    const percentage = (item.spent! / item.amount) * 100;
    const isOverBudget = percentage >= 100;
    const isAlert = percentage >= item.alert_percentage && !isOverBudget;
    const remaining = Math.max(item.amount - item.spent!, 0);

    let statusColor = COLORS.success;
    let statusText = 'Normal';
    if (isOverBudget) {
      statusColor = COLORS.error;
      statusText = 'Excedido';
    } else if (isAlert) {
      statusColor = COLORS.warning;
      statusText = 'Alerta';
    }

    return (
      <TouchableOpacity onLongPress={() => handleDeleteBudget(item.id)} activeOpacity={0.7}>
        <Card style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View style={styles.budgetInfo}>
              <Text style={styles.budgetName}>
                {item.category_id ? item.category?.name : 'Presupuesto General'}
              </Text>
              <Text style={styles.budgetAmount}>{formatCurrency(item.amount)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: statusColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{percentage.toFixed(0)}%</Text>
          </View>

          <View style={styles.budgetStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Gastado</Text>
              <Text style={[styles.statValue, { color: statusColor }]}>
                {formatCurrency(item.spent!)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Restante</Text>
              <Text style={styles.statValue}>{formatCurrency(remaining)}</Text>
            </View>
          </View>
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
          <Text style={styles.title}>Presupuestos</Text>
          <Text style={styles.subtitle}>{budgets.length} presupuesto(s)</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus size={24} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {MONTHS[selectedMonth - 1]} {selectedYear}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={budgets}
        renderItem={renderBudget}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Target size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No hay presupuestos para este mes</Text>
            <Button
              title="Crear primer presupuesto"
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
              <Text style={styles.modalTitle}>Nuevo Presupuesto</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setFormError(''); }}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.infoText}>
                Para: {MONTHS[selectedMonth - 1]} {selectedYear}
              </Text>

              <Text style={styles.label}>Categoría (opcional)</Text>
              <Text style={styles.helperText}>
                Deja vacío para crear un presupuesto general del mes
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    !formData.category_id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, category_id: '' })}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      !formData.category_id && styles.categoryButtonTextActive,
                    ]}
                  >
                    General
                  </Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      formData.category_id === category.id && styles.categoryButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, category_id: category.id })}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        formData.category_id === category.id &&
                          styles.categoryButtonTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input
                label="Monto presupuestado"
                placeholder="0"
                value={formData.amount}
                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                keyboardType="numeric"
              />

              <Input
                label="Porcentaje de alerta (%)"
                placeholder="80"
                value={formData.alert_percentage}
                onChangeText={(text) => setFormData({ ...formData, alert_percentage: text })}
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>
                Recibirás una alerta cuando alcances este porcentaje
              </Text>

              {formError ? <ErrorBox message={formError} /> : null}

              <Button
                title="Crear Presupuesto"
                onPress={handleSaveBudget}
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
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  monthText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  listContent: {
    padding: SPACING.md,
  },
  budgetCard: {
    marginBottom: SPACING.md,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  budgetAmount: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textInverse,
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
    minWidth: 40,
    textAlign: 'right',
  },
  budgetStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
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
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  categoryScroll: {
    marginBottom: SPACING.md,
  },
  categoryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundSecondary,
    marginRight: SPACING.sm,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  categoryButtonTextActive: {
    color: COLORS.textInverse,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  saveButton: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
});
