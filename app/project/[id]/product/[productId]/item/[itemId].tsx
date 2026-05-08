import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, Trash2, Edit2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorBox } from '@/components/ErrorBox';
import { Card } from '@/components/Card';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

interface Provider {
  id: string; provider_name: string; provider_type: string;
  unit_value: number; quantity: number; amount_paid: number; notes: string | null;
}

const PROVIDER_TYPES = [
  { value: 'mano_obra',  label: 'Mano de obra' },
  { value: 'materiales', label: 'Materiales' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'otros',      label: 'Otros' },
];

export default function ItemDetailScreen() {
  const { id: projectId, productId, itemId } = useLocalSearchParams<{ id: string; productId: string; itemId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itemData, setItemData] = useState<any>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form
  const [provName, setProvName]   = useState('');
  const [provType, setProvType]   = useState('materiales');
  const [unitVal, setUnitVal]     = useState('');
  const [qty, setQty]             = useState('1');
  const [paid, setPaid]           = useState('0');
  const [notes, setNotes]         = useState('');

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const [itemRes, provRes] = await Promise.all([
        supabase.from('product_items').select('*').eq('id', itemId).single(),
        supabase.from('item_providers').select('*').eq('item_id', itemId).order('created_at'),
      ]);
      setItemData(itemRes.data);
      setProviders(provRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const openModal = (prov?: Provider) => {
    if (prov) {
      setEditingProvider(prov);
      setProvName(prov.provider_name);
      setProvType(prov.provider_type);
      setUnitVal(prov.unit_value.toString());
      setQty(prov.quantity.toString());
      setPaid(prov.amount_paid.toString());
      setNotes(prov.notes || '');
    } else {
      setEditingProvider(null);
      setProvName(''); setProvType('materiales');
      setUnitVal(''); setQty('1'); setPaid('0'); setNotes('');
    }
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!provName.trim()) { setFormError('El nombre del proveedor es requerido'); return; }
    const uv = parseFloat(unitVal);
    if (!uv || uv <= 0) { setFormError('El valor unitario debe ser mayor a cero'); return; }
    setFormError(''); setSaving(true);
    try {
      const payload = {
        item_id: itemId,
        provider_name: provName.trim(),
        provider_type: provType,
        unit_value: uv,
        quantity: parseFloat(qty) || 1,
        amount_paid: parseFloat(paid) || 0,
        notes: notes.trim() || null,
      };
      if (editingProvider) {
        const { error } = await supabase.from('item_providers').update(payload).eq('id', editingProvider.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_providers').insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      load();
    } catch (e: any) { setFormError(e.message || 'Error al guardar proveedor'); }
    finally { setSaving(false); }
  };

  const handleDelete = (prov: Provider) => {
    Alert.alert('Eliminar proveedor', `¿Eliminar "${prov.provider_name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('item_providers').delete().eq('id', prov.id);
        load();
      }},
    ]);
  };

  const totalCost = providers.reduce((s, p) => s + p.unit_value * p.quantity, 0);
  const totalPaid = providers.reduce((s, p) => s + p.amount_paid, 0);
  const pendiente = totalCost - totalPaid;

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{itemData?.name}</Text>
          <Text style={styles.headerSub}>Proveedores y costos</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Plus size={20} color={COLORS.background} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Resumen costos */}
        {providers.length > 0 && (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Costo total del ítem</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalCost)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pagado a la fecha</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>{formatCurrency(totalPaid)}</Text>
            </View>
            {pendiente > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pendiente por pagar</Text>
                <Text style={[styles.summaryValue, { color: COLORS.warning }]}>{formatCurrency(pendiente)}</Text>
              </View>
            )}
            {totalCost > 0 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (totalPaid / totalCost) * 100)}%` as any }]} />
              </View>
            )}
          </Card>
        )}

        {/* Lista de proveedores */}
        {providers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin proveedores. Agrega el primero.</Text>
            <Button title="Agregar proveedor" onPress={() => openModal()} style={{ marginTop: SPACING.sm }} />
          </Card>
        ) : (
          providers.map(prov => {
            const subtotal = prov.unit_value * prov.quantity;
            const typeLabel = PROVIDER_TYPES.find(t => t.value === prov.provider_type)?.label ?? prov.provider_type;
            return (
              <Card key={prov.id} style={styles.provCard}>
                <View style={styles.provHeader}>
                  <View style={styles.provInfo}>
                    <Text style={styles.provName}>{prov.provider_name}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{typeLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.provActions}>
                    <TouchableOpacity onPress={() => openModal(prov)} style={styles.actionBtn}>
                      <Edit2 size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(prov)} style={styles.actionBtn}>
                      <Trash2 size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.provDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Valor unit.</Text>
                    <Text style={styles.detailValue}>{formatCurrency(prov.unit_value)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Cantidad</Text>
                    <Text style={styles.detailValue}>{prov.quantity}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Total</Text>
                    <Text style={[styles.detailValue, { color: COLORS.primary }]}>{formatCurrency(subtotal)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Pagado</Text>
                    <Text style={[styles.detailValue, { color: prov.amount_paid >= subtotal ? COLORS.success : COLORS.warning }]}>
                      {formatCurrency(prov.amount_paid)}
                    </Text>
                  </View>
                </View>
                {prov.notes && <Text style={styles.provNotes}>{prov.notes}</Text>}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Modal proveedor */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Input label="Nombre del proveedor" placeholder="Ej: Mano de obra tejido, Proveedor pintura..." value={provName} onChangeText={setProvName} />

              <Text style={styles.label}>Tipo</Text>
              <View style={styles.typeSelector}>
                {PROVIDER_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeOption, provType === t.value && styles.typeOptionSelected]}
                    onPress={() => setProvType(t.value)}
                  >
                    <Text style={[styles.typeOptionText, provType === t.value && styles.typeOptionTextSelected]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 2 }}>
                  <Input label="Valor unitario cotizado" placeholder="0" value={unitVal} onChangeText={setUnitVal} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Cantidad" placeholder="1" value={qty} onChangeText={setQty} keyboardType="numeric" />
                </View>
              </View>

              <Input label="Valor pagado a la fecha" placeholder="0" value={paid} onChangeText={setPaid} keyboardType="numeric" />
              <Input label="Notas (opcional)" placeholder="Observaciones..." value={notes} onChangeText={setNotes} multiline />

              {formError ? <ErrorBox message={formError} /> : null}
              <View style={[styles.modalActions, { paddingBottom: insets.bottom + SPACING.md }]}>
                <Button title="Cancelar" variant="outline" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
                <Button title={editingProvider ? 'Actualizar' : 'Guardar'} onPress={handleSave} loading={saving} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  headerSub: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.md },
  summaryCard: { padding: SPACING.md, marginBottom: SPACING.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  summaryValue: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  progressBar: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: SPACING.sm, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  emptyCard: { padding: SPACING.lg, alignItems: 'center' },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  provCard: { marginBottom: SPACING.sm, padding: SPACING.md },
  provHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  provInfo: { flex: 1, gap: 4 },
  provName: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.xs, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary + '15' },
  typeText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeight.medium },
  provActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { padding: 4 },
  provDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  detailItem: { minWidth: 80 },
  detailLabel: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary },
  detailValue: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text },
  provNotes: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  label: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, marginBottom: SPACING.xs, marginTop: SPACING.md },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  typeOption: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeOptionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeOptionText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text },
  typeOptionTextSelected: { color: COLORS.background },
  row: { flexDirection: 'row', gap: SPACING.sm },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
});
