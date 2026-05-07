import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from './Button';
import { Card } from './Card';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import {
  parseBancolombiaExcel,
  parseCSV,
  detectDuplicates,
  suggestTransactionType,
  suggestCategory,
  suggestCategoryWithRules,
  type ParsedRow,
} from '@/lib/importUtils';
import type { Account, Category, ImportJob, ImportRow, ImportTemplate, AutoRule } from '@/lib/types';
import { X, Upload, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, CreditCard as Edit2, Trash2 } from 'lucide-react-native';

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ProcessedRow extends ParsedRow {
  id: string;
  status: 'ready' | 'duplicate_suspected' | 'ignored';
  categoryId?: string;
  type: 'income' | 'expense' | 'transfer';
  duplicateTransactionId?: string;
}

export function ImportModal({ visible, onClose, onSuccess }: ImportModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'select_account' | 'upload' | 'preview' | 'processing' | 'completed'>('select_account');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ProcessedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<ProcessedRow | null>(null);

  useEffect(() => {
    if (visible && user) {
      loadAccounts();
      loadCategories();
      loadRules();
    }
  }, [visible, user]);

  const loadAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadCategories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadRules = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('auto_rules')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .eq('is_active', true)
        .eq('rule_type', 'classification')
        .order('priority', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading rules:', error);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFileName(file.name);
      setLoading(true);

      const response = await fetch(file.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      let parseResult;
      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(arrayBuffer);
        parseResult = parseCSV(text);
      } else {
        parseResult = parseBancolombiaExcel(arrayBuffer);
      }

      if (!parseResult.success) {
        Alert.alert('Error', parseResult.errors.join('\n'));
        setLoading(false);
        return;
      }

      if (parseResult.warnings.length > 0) {
        console.warn('Advertencias:', parseResult.warnings);
      }

      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('transaction_date, amount, description, reference')
        .eq('user_id', user!.id)
        .eq('account_id', selectedAccount!.id)
        .gte('transaction_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      const duplicateIndices = detectDuplicates(parseResult.rows, existingTransactions || []);

      const processed: ProcessedRow[] = parseResult.rows.map((row, index) => {
        const isDuplicate = duplicateIndices.includes(index);
        const type = suggestTransactionType(row.amount);

        const rulesResult = suggestCategoryWithRules(
          row.description,
          row.amount,
          selectedAccount!.id,
          rules
        );

        let categoryId = rulesResult.categoryId;
        let suggestedType = rulesResult.suggestedType || type;

        if (!categoryId) {
          categoryId = suggestCategory(row.description, row.amount, categories) || undefined;
        }

        return {
          ...row,
          id: `temp-${index}`,
          status: isDuplicate ? 'duplicate_suspected' : 'ready',
          type: suggestedType as 'income' | 'expense' | 'transfer',
          categoryId,
        };
      });

      setParsedRows(processed);
      setStep('preview');
      setLoading(false);
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'No se pudo procesar el archivo');
      setLoading(false);
    }
  };

  const handleToggleIgnore = (rowId: string) => {
    setParsedRows(rows =>
      rows.map(row =>
        row.id === rowId
          ? { ...row, status: row.status === 'ignored' ? 'ready' : 'ignored' }
          : row
      )
    );
  };

  const handleImport = async () => {
    if (!user || !selectedAccount) return;

    const rowsToImport = parsedRows.filter(row => row.status === 'ready');

    if (rowsToImport.length === 0) {
      Alert.alert('Aviso', 'No hay filas para importar');
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          account_id: selectedAccount.id,
          file_name: fileName,
          bank_name: 'Bancolombia',
          status: 'processing',
          total_rows: parsedRows.length,
          valid_rows: rowsToImport.length,
          duplicate_rows: parsedRows.filter(r => r.status === 'duplicate_suspected').length,
          ignored_rows: parsedRows.filter(r => r.status === 'ignored').length,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      let imported = 0;
      for (const row of rowsToImport) {
        const { error: transError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            account_id: selectedAccount.id,
            category_id: row.categoryId,
            type: row.type,
            amount: Math.abs(row.amount),
            description: row.description,
            reference: row.reference || undefined,
            transaction_date: row.date,
            origin: 'imported',
            status: 'confirmed',
          });

        if (transError) {
          console.error('Error importing row:', transError);
          continue;
        }

        const balanceChange = row.type === 'income' ? Math.abs(row.amount) : -Math.abs(row.amount);
        await supabase
          .from('accounts')
          .update({ balance: selectedAccount.balance + balanceChange })
          .eq('id', selectedAccount.id);

        imported++;
      }

      await supabase
        .from('import_jobs')
        .update({
          status: 'completed',
          imported_rows: imported,
          processed_rows: rowsToImport.length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      setStep('completed');
      setLoading(false);

      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error importing:', error);
      Alert.alert('Error', 'No se pudo completar la importación');
      setLoading(false);
      setStep('preview');
    }
  };

  const handleClose = () => {
    setStep('select_account');
    setSelectedAccount(null);
    setFileName('');
    setParsedRows([]);
    setEditingRow(null);
    onClose();
  };

  const stats = {
    total: parsedRows.length,
    ready: parsedRows.filter(r => r.status === 'ready').length,
    duplicates: parsedRows.filter(r => r.status === 'duplicate_suspected').length,
    ignored: parsedRows.filter(r => r.status === 'ignored').length,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Importar Extracto</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {step === 'select_account' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.stepTitle}>Selecciona la cuenta</Text>
            <Text style={styles.stepDescription}>
              Elige la cuenta a la que pertenece el extracto que vas a importar
            </Text>

            {accounts.map(account => (
              <TouchableOpacity
                key={account.id}
                style={[
                  styles.accountCard,
                  selectedAccount?.id === account.id && styles.accountCardSelected,
                ]}
                onPress={() => setSelectedAccount(account)}
              >
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountBalance}>{formatCurrency(account.balance)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {selectedAccount && (
              <Button
                title="Continuar"
                onPress={() => setStep('upload')}
                style={{ marginTop: SPACING.lg }}
              />
            )}
          </ScrollView>
        )}

        {step === 'upload' && (
          <View style={styles.content}>
            <Text style={styles.stepTitle}>Selecciona el archivo</Text>
            <Text style={styles.stepDescription}>
              Formatos soportados: Excel (.xlsx, .xls) o CSV (.csv)
            </Text>
            <Text style={styles.stepDescription}>
              Plantilla: Bancolombia (Fecha, Descripción, Referencia, Valor)
            </Text>

            <TouchableOpacity style={styles.uploadArea} onPress={handleSelectFile} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : (
                <>
                  <Upload size={48} color={COLORS.primary} />
                  <Text style={styles.uploadText}>
                    {fileName || 'Toca para seleccionar archivo'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Button
              title="Volver"
              onPress={() => setStep('select_account')}
              variant="outline"
              style={{ marginTop: SPACING.lg }}
            />
          </View>
        )}

        {step === 'preview' && (
          <View style={styles.fullContent}>
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: COLORS.success + '20' }]}>
                <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.ready}</Text>
                <Text style={styles.statLabel}>Listas</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: COLORS.warning + '20' }]}>
                <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.duplicates}</Text>
                <Text style={styles.statLabel}>Duplicados</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: COLORS.textSecondary + '20' }]}>
                <Text style={[styles.statValue, { color: COLORS.textSecondary }]}>{stats.ignored}</Text>
                <Text style={styles.statLabel}>Ignoradas</Text>
              </View>
            </View>

            <ScrollView style={styles.rowsList}>
              {parsedRows.map(row => (
                <Card key={row.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <View style={styles.rowStatus}>
                      {row.status === 'ready' && <CheckCircle2 size={16} color={COLORS.success} />}
                      {row.status === 'duplicate_suspected' && <AlertTriangle size={16} color={COLORS.warning} />}
                      {row.status === 'ignored' && <XCircle size={16} color={COLORS.textSecondary} />}
                      <Text style={styles.rowDate}>{new Date(row.date).toLocaleDateString('es-CO')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleToggleIgnore(row.id)}>
                      <Text style={styles.ignoreButton}>
                        {row.status === 'ignored' ? 'Incluir' : 'Ignorar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.rowDescription} numberOfLines={2}>{row.description}</Text>
                  {row.reference && <Text style={styles.rowReference}>Ref: {row.reference}</Text>}
                  <View style={styles.rowFooter}>
                    <Text style={[
                      styles.rowAmount,
                      { color: row.amount > 0 ? COLORS.income : COLORS.expense }
                    ]}>
                      {formatCurrency(Math.abs(row.amount))}
                    </Text>
                    <Text style={styles.rowType}>
                      {row.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </Text>
                  </View>
                  {row.status === 'duplicate_suspected' && (
                    <Text style={styles.duplicateWarning}>
                      Posible duplicado detectado
                    </Text>
                  )}
                </Card>
              ))}
            </ScrollView>

            <View style={styles.actions}>
              <Button
                title="Cancelar"
                onPress={handleClose}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={`Importar ${stats.ready} filas`}
                onPress={handleImport}
                style={{ flex: 1 }}
                disabled={stats.ready === 0}
              />
            </View>
          </View>
        )}

        {step === 'processing' && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.processingText}>Importando transacciones...</Text>
          </View>
        )}

        {step === 'completed' && (
          <View style={styles.centerContent}>
            <CheckCircle2 size={64} color={COLORS.success} />
            <Text style={styles.completedText}>Importación completada</Text>
            <Text style={styles.completedSubtext}>
              {stats.ready} transacciones importadas correctamente
            </Text>
          </View>
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
  content: {
    padding: SPACING.lg,
  },
  fullContent: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  accountCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  accountCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  accountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  accountBalance: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  uploadText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  rowsList: {
    flex: 1,
    padding: SPACING.md,
  },
  rowCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  rowStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  rowDate: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  ignoreButton: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  rowDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  rowReference: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  rowAmount: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  rowType: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  duplicateWarning: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.warning,
    marginTop: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  processingText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  completedText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  completedSubtext: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});
