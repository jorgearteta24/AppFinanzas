import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle, TrendingUp, TrendingDown, CircleAlert as AlertCircle, ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { BarChart } from '@/components/BarChart';
import { supabase } from '@/lib/supabase';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getTransactionColor } from '@/lib/utils';

interface CategorySpending {
  category_id: string;
  category_name: string;
  category_color: string;
  total: number;
}

interface BudgetAlert {
  id: string;
  category_name: string;
  budgeted: number;
  spent: number;
  percentage: number;
  alert_percentage: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    totalBalance: 0,
    monthIncome: 0,
    monthExpense: 0,
    accountsCount: 0,
    recentTransactions: [] as any[],
    topCategories: [] as CategorySpending[],
    weeklyFlow: [] as { week: string; income: number; expense: number }[],
    budgetAlerts: [] as BudgetAlert[],
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      const [
        accountsRes,
        transactionsRes,
        monthTransactionsRes,
        categorySpendingRes,
        budgetsRes,
      ] = await Promise.all([
        supabase
          .from('accounts')
          .select('balance')
          .eq('user_id', user.id)
          .eq('is_active', true),

        supabase
          .from('transactions')
          .select(
            `
            *,
            account:accounts!transactions_account_id_fkey(name, color),
            category:categories(name, color)
          `
          )
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('transactions')
          .select('type, amount, transaction_date, category_id')
          .eq('user_id', user.id)
          .gte('transaction_date', firstDayOfMonth)
          .lte('transaction_date', lastDayOfMonth),

        supabase
          .from('transactions')
          .select(
            `
            amount,
            category:categories(id, name, color)
          `
          )
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('transaction_date', firstDayOfMonth)
          .lte('transaction_date', lastDayOfMonth),

        supabase
          .from('budgets')
          .select('id, category_id, amount, alert_percentage, categories(name)')
          .eq('user_id', user.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .eq('is_active', true),
      ]);

      const totalBalance =
        accountsRes.data?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;

      const monthIncome =
        monthTransactionsRes.data
          ?.filter((t) => t.type === 'income' || t.type === 'refund')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const monthExpense =
        monthTransactionsRes.data
          ?.filter(
            (t) =>
              t.type === 'expense' ||
              t.type === 'debt_payment' ||
              t.type === 'bank_fee' ||
              t.type === 'savings_deposit'
          )
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const categoryMap = new Map<string, CategorySpending>();
      categorySpendingRes.data?.forEach((tx: any) => {
        const category = Array.isArray(tx.category) ? tx.category[0] : tx.category;
        if (category) {
          const existing = categoryMap.get(category.id);
          if (existing) {
            existing.total += Number(tx.amount);
          } else {
            categoryMap.set(category.id, {
              category_id: category.id,
              category_name: category.name,
              category_color: category.color,
              total: Number(tx.amount),
            });
          }
        }
      });

      const topCategories = Array.from(categoryMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const weeks = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
      const weeklyFlow = weeks.map((week, index) => {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), index * 7 + 1);
        const weekEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          Math.min((index + 1) * 7, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())
        );

        const weekTransactions = monthTransactionsRes.data?.filter((t) => {
          const txDate = new Date(t.transaction_date);
          return txDate >= weekStart && txDate <= weekEnd;
        });

        const income =
          weekTransactions
            ?.filter((t) => t.type === 'income' || t.type === 'refund')
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const expense =
          weekTransactions
            ?.filter(
              (t) =>
                t.type === 'expense' ||
                t.type === 'debt_payment' ||
                t.type === 'bank_fee' ||
                t.type === 'savings_deposit'
            )
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        return { week, income, expense };
      });

      const budgetAlerts: BudgetAlert[] = [];
      budgetsRes.data?.forEach((budget) => {
        const spent = budget.category_id
          ? monthTransactionsRes.data
              ?.filter(
                (t) =>
                  t.category_id === budget.category_id &&
                  (t.type === 'expense' ||
                    t.type === 'debt_payment' ||
                    t.type === 'bank_fee' ||
                    t.type === 'savings_deposit')
              )
              .reduce((sum, t) => sum + Number(t.amount), 0) || 0
          : monthExpense;

        const percentage = (spent / Number(budget.amount)) * 100;
        const alertPercentage = budget.alert_percentage || 80;

        if (percentage >= alertPercentage) {
          budgetAlerts.push({
            id: budget.id,
            category_name: budget.category_id
              ? (budget.categories as any)?.name || 'Categoría'
              : 'Presupuesto General',
            budgeted: Number(budget.amount),
            spent,
            percentage,
            alert_percentage: alertPercentage,
          });
        }
      });

      setData({
        totalBalance,
        monthIncome,
        monthExpense,
        accountsCount: accountsRes.data?.length || 0,
        recentTransactions: transactionsRes.data || [],
        topCategories,
        weeklyFlow,
        budgetAlerts,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => loadDashboardData(true);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const monthBalance = data.monthIncome - data.monthExpense;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola</Text>
            <Text style={styles.title}>Tus Finanzas</Text>
          </View>
          <View style={styles.accountsIndicator}>
            <Wallet size={20} color={COLORS.primary} />
            <Text style={styles.accountsCount}>{data.accountsCount}</Text>
          </View>
        </View>

        {data.budgetAlerts.length > 0 && (
          <Card style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <AlertCircle size={20} color={COLORS.warning} />
              <Text style={styles.alertTitle}>Alertas de Presupuesto</Text>
            </View>
            {data.budgetAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertItem}>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertCategory}>{alert.category_name}</Text>
                  <Text style={styles.alertText}>
                    {formatCurrency(alert.spent)} de {formatCurrency(alert.budgeted)} (
                    {alert.percentage.toFixed(0)}%)
                  </Text>
                </View>
                <View
                  style={[
                    styles.alertBadge,
                    {
                      backgroundColor:
                        alert.percentage >= 100 ? COLORS.error : COLORS.warning,
                    },
                  ]}
                >
                  <Text style={styles.alertBadgeText}>
                    {alert.percentage >= 100 ? 'Excedido' : 'Alerta'}
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.viewBudgetsButton}
              onPress={() => router.push('/(tabs)/goals' as any)}
            >
              <Text style={styles.viewBudgetsText}>Ver Presupuestos</Text>
              <ChevronRight size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </Card>
        )}

        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance Total</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(data.totalBalance)}</Text>
          <View style={styles.balanceFooter}>
            <View style={styles.balanceIndicator}>
              {monthBalance >= 0 ? (
                <TrendingUp size={16} color={COLORS.income} />
              ) : (
                <TrendingDown size={16} color={COLORS.expense} />
              )}
              <Text
                style={[
                  styles.balanceChange,
                  { color: monthBalance >= 0 ? COLORS.income : COLORS.expense },
                ]}
              >
                {formatCurrency(Math.abs(monthBalance))} este mes
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.row}>
          <Card style={styles.summaryCard}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.income + '20' }]}>
              <ArrowUpCircle size={20} color={COLORS.income} />
            </View>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.income }]}>
              {formatCurrency(data.monthIncome)}
            </Text>
            <Text style={styles.summaryPeriod}>Este mes</Text>
          </Card>

          <Card style={styles.summaryCard}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.expense + '20' }]}>
              <ArrowDownCircle size={20} color={COLORS.expense} />
            </View>
            <Text style={styles.summaryLabel}>Gastos</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.expense }]}>
              {formatCurrency(data.monthExpense)}
            </Text>
            <Text style={styles.summaryPeriod}>Este mes</Text>
          </Card>
        </View>

        {data.topCategories.length > 0 && (
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top Categorías de Gasto</Text>
            <BarChart
              data={data.topCategories.map((cat) => ({
                label: cat.category_name,
                value: cat.total,
                color: cat.category_color,
              }))}
              height={180}
              showValues
            />
          </Card>
        )}

        {data.weeklyFlow.some((w) => w.income > 0 || w.expense > 0) && (
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Flujo Semanal</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.income }]} />
                <Text style={styles.legendText}>Ingresos</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.expense }]} />
                <Text style={styles.legendText}>Gastos</Text>
              </View>
            </View>
            <View style={styles.weeklyContainer}>
              {data.weeklyFlow.map((week, index) => (
                <View key={index} style={styles.weekItem}>
                  <Text style={styles.weekLabel}>{week.week}</Text>
                  <View style={styles.weekBars}>
                    <View style={styles.weekBarContainer}>
                      <View
                        style={[
                          styles.weekBar,
                          {
                            height: Math.max(
                              (week.income / Math.max(data.monthIncome, data.monthExpense)) *
                                60,
                              4
                            ),
                            backgroundColor: COLORS.income,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.weekBarContainer}>
                      <View
                        style={[
                          styles.weekBar,
                          {
                            height: Math.max(
                              (week.expense / Math.max(data.monthIncome, data.monthExpense)) *
                                60,
                              4
                            ),
                            backgroundColor: COLORS.expense,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card style={styles.transactionsCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Movimientos Recientes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions' as any)}>
              <Text style={styles.seeAllText}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {data.recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No hay movimientos aún</Text>
          ) : (
            data.recentTransactions.map((transaction) => {
              const color = getTransactionColor(transaction.type);
              const isIncome = transaction.type === 'income' || transaction.type === 'refund';

              return (
                <View key={transaction.id} style={styles.transactionItem}>
                  <View style={[styles.transactionIcon, { backgroundColor: color + '20' }]}>
                    {isIncome ? (
                      <ArrowUpCircle size={18} color={color} />
                    ) : (
                      <ArrowDownCircle size={18} color={color} />
                    )}
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription} numberOfLines={1}>
                      {transaction.description}
                    </Text>
                    <Text style={styles.transactionDate} numberOfLines={1}>
                      {formatDate(transaction.transaction_date)}
                      {transaction.account && ` · ${transaction.account.name}`}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, { color }]}>
                    {isIncome ? '+' : '-'}
                    {formatCurrency(Number(transaction.amount))}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
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
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.xs / 2,
  },
  accountsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.background,
    borderRadius: 20,
  },
  accountsCount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  alertCard: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.warning + '10',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  alertInfo: {
    flex: 1,
  },
  alertCategory: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  alertText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  alertBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 12,
  },
  alertBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textInverse,
  },
  viewBudgetsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  viewBudgetsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  balanceCard: {
    marginBottom: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  balanceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  balanceAmount: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  balanceFooter: {
    marginTop: SPACING.md,
  },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  balanceChange: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  summaryAmount: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.xs / 2,
  },
  summaryPeriod: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textTertiary,
  },
  chartCard: {
    marginBottom: SPACING.md,
  },
  chartTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  weeklyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  weekItem: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  weekBars: {
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'flex-end',
    height: 80,
  },
  weekBarContainer: {
    width: 16,
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  transactionsCard: {
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
  },
  transactionDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  transactionAmount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
