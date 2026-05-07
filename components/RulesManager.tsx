import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createAutoRule } from '@/lib/rulesEngine';
import type { AutoRule, Category, TransactionType } from '@/lib/types';
import { Plus, CreditCard as Edit2, Trash2, X, Tag, TrendingUp, TrendingDown } from 'lucide-react-native';

interface RulesManagerProps {
  visible: boolean;
  onClose: () => void;
}

export function RulesManager({ visible, onClose }: RulesManagerProps) {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [newRuleType, setNewRuleType] = useState<TransactionType>('expense');

  useEffect(() => {
    if (visible && user) {
      loadRules();
      loadCategories();
    }
  }, [visible, user]);

  const loadRules = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auto_rules')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .eq('rule_type', 'classification')
        .order('priority', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
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

  const handleToggleRule = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('auto_rules')
        .update({ is_active: !currentStatus })
        .eq('id', ruleId);

      if (error) throw error;
      loadRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      Alert.alert('Error', 'No se pudo actualizar la regla');
    }
  };

  const handleDeleteRule = async (ruleId: string, isDefault: boolean) => {
    if (isDefault) {
      Alert.alert('Aviso', 'No se pueden eliminar reglas predefinidas');
      return;
    }

    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de eliminar esta regla?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('auto_rules')
                .delete()
                .eq('id', ruleId);

              if (error) throw error;
              loadRules();
            } catch (error) {
              console.error('Error deleting rule:', error);
              Alert.alert('Error', 'No se pudo eliminar la regla');
            }
          },
        },
      ]
    );
  };

  const handleSaveRule = async () => {
    if (!user) return;
    if (!newRuleName.trim() || !newRuleKeywords.trim()) {
      Alert.alert('Error', 'Completa todos los campos requeridos');
      return;
    }

    try {
      setLoading(true);

      const keywords = newRuleKeywords
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

      const ruleData = createAutoRule(
        newRuleName,
        keywords,
        newRuleCategory || undefined,
        undefined,
        newRuleType
      );

      const { error } = await supabase
        .from('auto_rules')
        .insert({
          ...ruleData,
          user_id: user.id,
        });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      Alert.alert('Error', 'No se pudo guardar la regla');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewRuleName('');
    setNewRuleKeywords('');
    setNewRuleCategory('');
    setNewRuleType('expense');
    setEditingRule(null);
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      income: 'Ingreso',
      expense: 'Gasto',
      transfer: 'Transferencia',
      bank_fee: 'Comisión',
    };
    return labels[type] || type;
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Sin categoría';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Sin categoría';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reglas de Clasificación</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{rules.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              {rules.filter(r => r.is_active).length}
            </Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>
              {rules.filter(r => !r.is_default).length}
            </Text>
            <Text style={styles.statLabel}>Personalizadas</Text>
          </View>
        </View>

        <ScrollView style={styles.rulesList}>
          {rules.map(rule => (
            <Card key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleName}>{rule.name}</Text>
                  {rule.is_default && (
                    <Text style={styles.defaultBadge}>Predefinida</Text>
                  )}
                </View>
                <Switch
                  value={rule.is_active}
                  onValueChange={() => handleToggleRule(rule.id, rule.is_active)}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  disabled={rule.is_default && !rule.user_id}
                />
              </View>

              <View style={styles.ruleDetails}>
                <View style={styles.ruleDetail}>
                  <Tag size={14} color={COLORS.textSecondary} />
                  <Text style={styles.ruleDetailText}>
                    {getCategoryName(rule.category_id)}
                  </Text>
                </View>
                {rule.suggested_type && (
                  <View style={styles.ruleDetail}>
                    {rule.suggested_type === 'income' ? (
                      <TrendingUp size={14} color={COLORS.income} />
                    ) : (
                      <TrendingDown size={14} color={COLORS.expense} />
                    )}
                    <Text style={styles.ruleDetailText}>
                      {getTypeLabel(rule.suggested_type)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.keywordsContainer}>
                {(rule.conditions.keywords || []).slice(0, 5).map((keyword, index) => (
                  <View key={index} style={styles.keywordChip}>
                    <Text style={styles.keywordText}>{keyword}</Text>
                  </View>
                ))}
                {(rule.conditions.keywords || []).length > 5 && (
                  <Text style={styles.moreKeywords}>
                    +{(rule.conditions.keywords || []).length - 5} más
                  </Text>
                )}
              </View>

              {rule.match_count > 0 && (
                <Text style={styles.matchCount}>
                  {rule.match_count} coincidencias
                </Text>
              )}

              {!rule.is_default && (
                <View style={styles.ruleActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteRule(rule.id, rule.is_default)}
                  >
                    <Trash2 size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Agregar Regla Personalizada"
            onPress={() => setShowAddModal(true)}
            icon={<Plus size={20} color={COLORS.background} />}
          />
        </View>

        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAddModal(false);
            resetForm();
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nueva Regla</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  <X size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.label}>Nombre de la regla</Text>
                <Input
                  value={newRuleName}
                  onChangeText={setNewRuleName}
                  placeholder="Ej: Compras en línea"
                />

                <Text style={styles.label}>Palabras clave (separadas por comas)</Text>
                <Input
                  value={newRuleKeywords}
                  onChangeText={setNewRuleKeywords}
                  placeholder="Ej: amazon, mercadolibre, ebay"
                  multiline
                />

                <Text style={styles.label}>Categoría sugerida</Text>
                <View style={styles.categoryPicker}>
                  {categories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        newRuleCategory === category.id && styles.categoryOptionSelected,
                      ]}
                      onPress={() => setNewRuleCategory(category.id)}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          newRuleCategory === category.id && styles.categoryOptionTextSelected,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Tipo de transacción</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      newRuleType === 'expense' && styles.typeOptionSelected,
                    ]}
                    onPress={() => setNewRuleType('expense')}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        newRuleType === 'expense' && styles.typeOptionTextSelected,
                      ]}
                    >
                      Gasto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      newRuleType === 'income' && styles.typeOptionSelected,
                    ]}
                    onPress={() => setNewRuleType('income')}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        newRuleType === 'income' && styles.typeOptionTextSelected,
                      ]}
                    >
                      Ingreso
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      newRuleType === 'transfer' && styles.typeOptionSelected,
                    ]}
                    onPress={() => setNewRuleType('transfer')}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        newRuleType === 'transfer' && styles.typeOptionTextSelected,
                      ]}
                    >
                      Transferencia
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Guardar"
                  onPress={handleSaveRule}
                  loading={loading}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
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
  statsBar: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stat: {
    flex: 1,
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
  rulesList: {
    flex: 1,
    padding: SPACING.md,
  },
  ruleCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  ruleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  ruleName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  defaultBadge: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ruleDetails: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ruleDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs / 2,
  },
  ruleDetailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  keywordChip: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: RADIUS.sm,
  },
  keywordText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text,
  },
  moreKeywords: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    alignSelf: 'center',
  },
  matchCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    maxHeight: '85%',
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
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  categoryOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  categoryOptionTextSelected: {
    color: COLORS.background,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  typeOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  typeOptionTextSelected: {
    color: COLORS.background,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
