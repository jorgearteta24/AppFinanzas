import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ImportModal } from '@/components/ImportModal';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { Upload, Plus } from 'lucide-react-native';
import type { Transaction, Category } from '@/lib/types';

interface TransactionWithCategory extends Transaction {
  category?: Category;
}

export default function TransactionsScreen() {
  const { user } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions();
  }, [loadTransactions]);

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      income: 'Ingreso',
      expense: 'Gasto',
      transfer: 'Transferencia',
      savings_deposit: 'Depósito a ahorro',
      savings_withdrawal: 'Retiro de ahorro',
      debt_payment: 'Pago de deuda',
      adjustment: 'Ajuste',
      refund: 'Reembolso',
      credit_card_payment: 'Pago tarjeta',
      bank_fee: 'Comisión',
    };
    return labels[type] || type;
  };

  const getTransactionColor = (type: string) => {
    if (type === 'income') return COLORS.income;
    if (type === 'expense') return COLORS.expense;
    return COLORS.textSecondary;
  };

  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = new Date(transaction.transaction_date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as { [key: string]: TransactionWithCategory[] });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Movimientos</Text>
            <Text style={styles.subtitle}>Historial de transacciones</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Button
            title="Agregar"
            onPress={() => {}}
            style={styles.button}
            icon={<Plus size={20} color={COLORS.background} />}
          />
          <Button
            title="Importar"
            onPress={() => setShowImportModal(true)}
            variant="outline"
            style={styles.button}
            icon={<Upload size={20} color={COLORS.primary} />}
          />
        </View>

        {transactions.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No hay movimientos registrados</Text>
            <Text style={styles.emptySubtext}>
              Comienza agregando tus ingresos y gastos, o importa un extracto bancario
            </Text>
          </Card>
        ) : (
          Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              {dayTransactions.map(transaction => (
                <Card key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionRow}>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDescription}>
                        {transaction.description}
                      </Text>
                      <View style={styles.transactionMeta}>
                        <Text style={styles.transactionType}>
                          {getTransactionTypeLabel(transaction.type)}
                        </Text>
                        {transaction.category && (
                          <Text style={styles.transactionCategory}>
                            • {transaction.category.name}
                          </Text>
                        )}
                        {transaction.origin === 'imported' && (
                          <Text style={styles.importedBadge}>Importado</Text>
                        )}
                      </View>
                      {transaction.reference && (
                        <Text style={styles.transactionReference}>
                          Ref: {transaction.reference}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.transactionAmount,
                        { color: getTransactionColor(transaction.type) },
                      ]}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <ImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadTransactions}
      />
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
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  button: {
    flex: 1,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  dateGroup: {
    marginBottom: SPACING.lg,
  },
  dateHeader: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'capitalize',
  },
  transactionCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  transactionDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  transactionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs / 2,
  },
  transactionType: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  transactionCategory: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  importedBadge: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  transactionReference: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  transactionAmount: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
