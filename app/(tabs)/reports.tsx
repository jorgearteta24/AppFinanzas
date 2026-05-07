import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { BarChart } from '@/components/BarChart';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ListFilter as Filter } from 'lucide-react-native';
import type { Account, Category, Transaction } from '@/lib/types';

interface MonthlyData {
  income: number;
  expenses: number;
  balance: number;
}

interface CategoryData {
  category: string;
  amount: number;
  color: string;
  percentage: number;
}

interface MonthComparison {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    income: 0,
    expenses: 0,
    balance: 0,
  });
  const [expensesByCategory, setExpensesByCategory] = useState<CategoryData[]>([]);
  const [incomeByCategory, setIncomeByCategory] = useState<CategoryData[]>([]);
  const [monthComparison, setMonthComparison] = useState<MonthComparison[]>([]);
  const [budgetAnalysis, setBudgetAnalysis] = useState<{
    budgeted: number;
    spent: number;
    remaining: number;
  }>({ budgeted: 0, spent: 0, remaining: 0 });
  const [savingsAccumulated, setSavingsAccumulated] = useState(0);

  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      let transactionsQuery = supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('transaction_date', startOfMonth.toISOString())
        .lte('transaction_date', endOfMonth.toISOString());

      if (selectedAccount !== 'all') {
        transactionsQuery = transactionsQuery.eq('account_id', selectedAccount);
      }

      if (selectedCategory !== 'all') {
        transactionsQuery = transactionsQuery.eq('category_id', selectedCategory);
      }

      const { data: transactions, error: transError } = await transactionsQuery;
      if (transError) throw transError;

      const income = transactions
        ?.filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      const expenses = transactions
        ?.filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      setMonthlyData({
        income,
        expenses,
        balance: income - expenses,
      });

      const expenseCategoryMap = new Map<string, { amount: number; color: string }>();
      transactions
        ?.filter((t) => t.type === 'expense' && t.category)
        .forEach((t) => {
          const catName = t.category?.name || 'Sin categoría';
          const existing = expenseCategoryMap.get(catName) || { amount: 0, color: t.category?.color || COLORS.textSecondary };
          expenseCategoryMap.set(catName, {
            amount: existing.amount + t.amount,
            color: existing.color,
          });
        });

      const totalExpenses = Array.from(expenseCategoryMap.values()).reduce((sum, cat) => sum + cat.amount, 0);
      const expensesData = Array.from(expenseCategoryMap.entries())
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          color: data.color,
          percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setExpensesByCategory(expensesData);

      const incomeCategoryMap = new Map<string, { amount: number; color: string }>();
      transactions
        ?.filter((t) => t.type === 'income' && t.category)
        .forEach((t) => {
          const catName = t.category?.name || 'Sin categoría';
          const existing = incomeCategoryMap.get(catName) || { amount: 0, color: t.category?.color || COLORS.income };
          incomeCategoryMap.set(catName, {
            amount: existing.amount + t.amount,
            color: existing.color,
          });
        });

      const totalIncome = Array.from(incomeCategoryMap.values()).reduce((sum, cat) => sum + cat.amount, 0);
      const incomeData = Array.from(incomeCategoryMap.entries())
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          color: data.color,
          percentage: totalIncome > 0 ? (data.amount / totalIncome) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setIncomeByCategory(incomeData);

      const comparisonData: MonthComparison[] = [];
      for (let i = 5; i >= 0; i--) {
        const compareDate = new Date(year, month - 1 - i, 1);
        const compareYear = compareDate.getFullYear();
        const compareMonth = compareDate.getMonth() + 1;
        const compareStart = new Date(compareYear, compareMonth - 1, 1);
        const compareEnd = new Date(compareYear, compareMonth, 0, 23, 59, 59);

        const { data: compareTrans } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .gte('transaction_date', compareStart.toISOString())
          .lte('transaction_date', compareEnd.toISOString());

        const monthIncome = compareTrans?.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
        const monthExpenses = compareTrans?.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;

        comparisonData.push({
          month: compareDate.toLocaleDateString('es-CO', { month: 'short' }),
          income: monthIncome,
          expenses: monthExpenses,
          savings: monthIncome - monthExpenses,
        });
      }

      setMonthComparison(comparisonData);

      const { data: budgets } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('month', month)
        .eq('year', year);

      const totalBudgeted = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;
      const budgetSpent = expenses;
      setBudgetAnalysis({
        budgeted: totalBudgeted,
        spent: budgetSpent,
        remaining: totalBudgeted - budgetSpent,
      });

      const { data: goals } = await supabase
        .from('savings_goals')
        .select('current_amount')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const totalSavings = goals?.reduce((sum, g) => sum + g.current_amount, 0) || 0;
      setSavingsAccumulated(totalSavings);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, year, month, selectedAccount, selectedCategory]);

  const loadFilters = useCallback(async () => {
    if (!user) return;

    try {
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .order('name');

      setAccounts(accountsData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  }, [user]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    setCurrentDate(new Date(year, month, 1));
  };

  const monthName = currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Reportes</Text>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Filter size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={previousMonth} style={styles.monthButton}>
            <ChevronLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{monthName}</Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={[styles.monthButton, year === new Date().getFullYear() && month === new Date().getMonth() + 1 && styles.monthButtonDisabled]}
          >
            <ChevronRight size={24} color={year === new Date().getFullYear() && month === new Date().getMonth() + 1 ? COLORS.textTertiary : COLORS.text} />
          </TouchableOpacity>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Resumen del Mes</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ingresos</Text>
              <Text style={[styles.summaryValue, { color: COLORS.income }]}>{formatCurrency(monthlyData.income)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gastos</Text>
              <Text style={[styles.summaryValue, { color: COLORS.expense }]}>{formatCurrency(monthlyData.expenses)}</Text>
            </View>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={[styles.balanceValue, { color: monthlyData.balance >= 0 ? COLORS.income : COLORS.expense }]}>
              {formatCurrency(monthlyData.balance)}
            </Text>
          </View>
        </Card>

        {expensesByCategory.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Gastos por Categoría</Text>
            <BarChart
              data={expensesByCategory.slice(0, 5).map((cat) => ({
                label: cat.category,
                value: cat.amount,
                color: cat.color,
              }))}
              height={200}
            />
            <View style={styles.categoryList}>
              {expensesByCategory.map((cat, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.categoryName}>{cat.category}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
                    <Text style={styles.categoryPercentage}>{cat.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {incomeByCategory.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Ingresos por Categoría</Text>
            <View style={styles.categoryList}>
              {incomeByCategory.map((cat, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.categoryName}>{cat.category}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
                    <Text style={styles.categoryPercentage}>{cat.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {monthComparison.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Comparación Mensual (últimos 6 meses)</Text>
            <BarChart
              data={monthComparison.map((m) => ({
                label: m.month,
                value: m.expenses,
                color: COLORS.expense,
              }))}
              height={180}
            />
            <View style={styles.comparisonList}>
              {monthComparison.map((m, index) => (
                <View key={index} style={styles.comparisonItem}>
                  <Text style={styles.comparisonMonth}>{m.month}</Text>
                  <View style={styles.comparisonValues}>
                    <Text style={[styles.comparisonValue, { color: COLORS.income }]}>+{formatCurrency(m.income)}</Text>
                    <Text style={[styles.comparisonValue, { color: COLORS.expense }]}>-{formatCurrency(m.expenses)}</Text>
                    <Text style={[styles.comparisonValue, { color: m.savings >= 0 ? COLORS.income : COLORS.expense }]}>
                      {formatCurrency(m.savings)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {budgetAnalysis.budgeted > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Presupuesto vs Real</Text>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Presupuestado</Text>
              <Text style={styles.budgetValue}>{formatCurrency(budgetAnalysis.budgeted)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Gastado</Text>
              <Text style={[styles.budgetValue, { color: COLORS.expense }]}>{formatCurrency(budgetAnalysis.spent)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Restante</Text>
              <Text style={[styles.budgetValue, { color: budgetAnalysis.remaining >= 0 ? COLORS.income : COLORS.expense }]}>
                {formatCurrency(budgetAnalysis.remaining)}
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min((budgetAnalysis.spent / budgetAnalysis.budgeted) * 100, 100)}%`,
                    backgroundColor: budgetAnalysis.spent > budgetAnalysis.budgeted ? COLORS.error : COLORS.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {((budgetAnalysis.spent / budgetAnalysis.budgeted) * 100).toFixed(1)}% utilizado
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Ahorro Acumulado</Text>
          <View style={styles.savingsContainer}>
            <Text style={styles.savingsAmount}>{formatCurrency(savingsAccumulated)}</Text>
            <Text style={styles.savingsLabel}>Total en metas de ahorro activas</Text>
          </View>
        </Card>
      </ScrollView>

      <Modal visible={showFilters} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtros</Text>

            <Text style={styles.filterLabel}>Cuenta</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, selectedAccount === 'all' && styles.filterOptionActive]}
                onPress={() => setSelectedAccount('all')}
              >
                <Text style={[styles.filterOptionText, selectedAccount === 'all' && styles.filterOptionTextActive]}>Todas</Text>
              </TouchableOpacity>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.filterOption, selectedAccount === account.id && styles.filterOptionActive]}
                  onPress={() => setSelectedAccount(account.id)}
                >
                  <Text style={[styles.filterOptionText, selectedAccount === account.id && styles.filterOptionTextActive]}>{account.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Categoría</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, selectedCategory === 'all' && styles.filterOptionActive]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.filterOptionText, selectedCategory === 'all' && styles.filterOptionTextActive]}>Todas</Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.filterOption, selectedCategory === category.id && styles.filterOptionActive]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <Text style={[styles.filterOptionText, selectedCategory === category.id && styles.filterOptionTextActive]}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Limpiar filtros"
                onPress={() => {
                  setSelectedAccount('all');
                  setSelectedCategory('all');
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title="Aplicar"
                onPress={() => {
                  setShowFilters(false);
                  loadData();
                }}
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
  filterButton: {
    padding: SPACING.sm,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  monthButton: {
    padding: SPACING.sm,
  },
  monthButtonDisabled: {
    opacity: 0.3,
  },
  monthText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  card: {
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  balanceRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  balanceValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  categoryList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    flex: 1,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs / 2,
  },
  categoryAmount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  categoryPercentage: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  comparisonList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  comparisonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  comparisonMonth: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    width: 60,
    textTransform: 'capitalize',
  },
  comparisonValues: {
    flexDirection: 'row',
    gap: SPACING.md,
    flex: 1,
    justifyContent: 'flex-end',
  },
  comparisonValue: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  budgetLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  budgetValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  progressContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    marginVertical: SPACING.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  savingsContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  savingsAmount: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  savingsLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
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
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  filterOptionTextActive: {
    color: COLORS.background,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
});
