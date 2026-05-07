import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { scanForDuplicates } from '@/lib/rulesEngine';
import type { DuplicateMatch, Transaction } from '@/lib/types';
import { X, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Scan } from 'lucide-react-native';

interface DuplicateReconciliationProps {
  visible: boolean;
  onClose: () => void;
}

interface DuplicateMatchWithTransactions extends DuplicateMatch {
  transaction1?: Transaction;
  transaction2?: Transaction;
}

export function DuplicateReconciliation({ visible, onClose }: DuplicateReconciliationProps) {
  const { user } = useAuth();
  const [duplicates, setDuplicates] = useState<DuplicateMatchWithTransactions[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadDuplicates();
    }
  }, [visible, user]);

  const loadDuplicates = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('duplicate_matches')
        .select(`
          *,
          transaction1:transaction1_id(id, transaction_date, amount, description, reference, type),
          transaction2:transaction2_id(id, transaction_date, amount, description, reference, type)
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('similarity_score', { ascending: false });

      if (error) throw error;
      setDuplicates(data || []);
    } catch (error) {
      console.error('Error loading duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScanDuplicates = async () => {
    if (!user) return;

    try {
      setScanning(true);
      const count = await scanForDuplicates(user.id, supabase);
      Alert.alert(
        'Escaneo completado',
        `Se encontraron ${count} posibles duplicados nuevos`
      );
      loadDuplicates();
    } catch (error) {
      console.error('Error scanning duplicates:', error);
      Alert.alert('Error', 'No se pudo completar el escaneo');
    } finally {
      setScanning(false);
    }
  };

  const handleKeepBoth = async (matchId: string) => {
    try {
      const { error: matchError } = await supabase
        .from('duplicate_matches')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', matchId);

      if (matchError) throw matchError;

      const match = duplicates.find(d => d.id === matchId);
      if (match) {
        await supabase.from('duplicate_resolutions').insert({
          user_id: user?.id,
          match_id: matchId,
          kept_transaction_id: match.transaction1_id,
          action: 'keep_both',
          notes: 'Usuario confirmó que no son duplicados',
        });
      }

      loadDuplicates();
    } catch (error) {
      console.error('Error resolving duplicate:', error);
      Alert.alert('Error', 'No se pudo resolver el duplicado');
    }
  };

  const handleMergeDuplicates = async (matchId: string, keepId: string, removeId: string) => {
    Alert.alert(
      'Confirmar fusión',
      '¿Estás seguro de eliminar la transacción duplicada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: toDelete } = await supabase
                .from('transactions')
                .select('amount, type, account_id')
                .eq('id', removeId)
                .single();

              if (toDelete) {
                const balanceChange =
                  toDelete.type === 'income'
                    ? -toDelete.amount
                    : toDelete.amount;

                await supabase
                  .from('accounts')
                  .update({
                    balance: supabase.rpc('increment_balance', {
                      account_id: toDelete.account_id,
                      amount: balanceChange,
                    }),
                  })
                  .eq('id', toDelete.account_id);
              }

              const { error: deleteError } = await supabase
                .from('transactions')
                .delete()
                .eq('id', removeId);

              if (deleteError) throw deleteError;

              const { error: matchError } = await supabase
                .from('duplicate_matches')
                .update({
                  status: 'merged',
                  resolved_at: new Date().toISOString(),
                  resolved_by: user?.id,
                })
                .eq('id', matchId);

              if (matchError) throw matchError;

              await supabase.from('duplicate_resolutions').insert({
                user_id: user?.id,
                match_id: matchId,
                kept_transaction_id: keepId,
                removed_transaction_id: removeId,
                action: 'delete_duplicate',
                notes: 'Transacción duplicada eliminada',
              });

              loadDuplicates();
            } catch (error) {
              console.error('Error merging duplicates:', error);
              Alert.alert('Error', 'No se pudo eliminar el duplicado');
            }
          },
        },
      ]
    );
  };

  const handleIgnoreMatch = async (matchId: string) => {
    try {
      const { error } = await supabase
        .from('duplicate_matches')
        .update({
          status: 'ignored',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', matchId);

      if (error) throw error;
      loadDuplicates();
    } catch (error) {
      console.error('Error ignoring match:', error);
      Alert.alert('Error', 'No se pudo ignorar la coincidencia');
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return COLORS.error;
    if (score >= 0.7) return COLORS.warning;
    return COLORS.textSecondary;
  };

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.9) return 'Muy alta';
    if (score >= 0.7) return 'Alta';
    return 'Media';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Conciliación de Duplicados</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {duplicates.length} coincidencias pendientes
            </Text>
          </View>
          <Button
            title="Escanear"
            onPress={handleScanDuplicates}
            loading={scanning}
            size="sm"
            variant="outline"
            icon={<Scan size={16} color={COLORS.primary} />}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Cargando coincidencias...</Text>
          </View>
        ) : duplicates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CheckCircle2 size={64} color={COLORS.success} />
            <Text style={styles.emptyText}>No hay duplicados pendientes</Text>
            <Text style={styles.emptySubtext}>
              Todas las transacciones están conciliadas
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.duplicatesList}>
            {duplicates.map(duplicate => (
              <Card key={duplicate.id} style={styles.duplicateCard}>
                <View style={styles.duplicateHeader}>
                  <View style={styles.similarityBadge}>
                    <AlertTriangle
                      size={16}
                      color={getSimilarityColor(duplicate.similarity_score)}
                    />
                    <Text
                      style={[
                        styles.similarityText,
                        { color: getSimilarityColor(duplicate.similarity_score) },
                      ]}
                    >
                      Similitud {getSimilarityLabel(duplicate.similarity_score)} (
                      {Math.round(duplicate.similarity_score * 100)}%)
                    </Text>
                  </View>
                </View>

                <View style={styles.matchReasons}>
                  {duplicate.match_reason.date_match && (
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonText}>Fecha similar</Text>
                    </View>
                  )}
                  {duplicate.match_reason.amount_match && (
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonText}>Mismo monto</Text>
                    </View>
                  )}
                  {duplicate.match_reason.same_account && (
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonText}>Misma cuenta</Text>
                    </View>
                  )}
                  {(duplicate.match_reason.description_similarity || 0) > 0.7 && (
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonText}>Descripción similar</Text>
                    </View>
                  )}
                </View>

                <View style={styles.transactionsCompare}>
                  <View style={styles.transactionBox}>
                    <Text style={styles.transactionLabel}>Transacción 1</Text>
                    <Text style={styles.transactionDescription}>
                      {duplicate.transaction1?.description}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(duplicate.transaction1?.transaction_date || '').toLocaleDateString('es-CO')}
                    </Text>
                    <Text style={styles.transactionAmount}>
                      {formatCurrency(duplicate.transaction1?.amount || 0)}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.transactionBox}>
                    <Text style={styles.transactionLabel}>Transacción 2</Text>
                    <Text style={styles.transactionDescription}>
                      {duplicate.transaction2?.description}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(duplicate.transaction2?.transaction_date || '').toLocaleDateString('es-CO')}
                    </Text>
                    <Text style={styles.transactionAmount}>
                      {formatCurrency(duplicate.transaction2?.amount || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <Button
                    title="Mantener ambas"
                    onPress={() => handleKeepBoth(duplicate.id)}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Eliminar 1"
                    onPress={() =>
                      handleMergeDuplicates(
                        duplicate.id,
                        duplicate.transaction2_id,
                        duplicate.transaction1_id
                      )
                    }
                    variant="ghost"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Eliminar 2"
                    onPress={() =>
                      handleMergeDuplicates(
                        duplicate.id,
                        duplicate.transaction1_id,
                        duplicate.transaction2_id
                      )
                    }
                    variant="ghost"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>

                <TouchableOpacity
                  style={styles.ignoreButton}
                  onPress={() => handleIgnoreMatch(duplicate.id)}
                >
                  <Text style={styles.ignoreButtonText}>Ignorar coincidencia</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  closeButton: {
    padding: SPACING.xs,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsContainer: {
    flex: 1,
  },
  statsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  duplicatesList: {
    flex: 1,
    padding: SPACING.md,
  },
  duplicateCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  duplicateHeader: {
    marginBottom: SPACING.sm,
  },
  similarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  similarityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  matchReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  reasonBadge: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: RADIUS.sm,
  },
  reasonText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  transactionsCompare: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  transactionBox: {
    flex: 1,
    padding: SPACING.sm,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.md,
  },
  divider: {
    width: SPACING.sm,
  },
  transactionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
  },
  transactionDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs / 2,
  },
  transactionDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
  },
  transactionAmount: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  ignoreButton: {
    padding: SPACING.sm,
    alignItems: 'center',
  },
  ignoreButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
});
