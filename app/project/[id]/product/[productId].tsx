import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, ChevronRight, Trash2, Calculator } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorBox } from '@/components/ErrorBox';
import { Card } from '@/components/Card';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { calcularPrecio, resolveConfig, SALE_TYPE_LABELS } from '@/lib/projectPricing';

interface ProductItem { id: string; name: string; description: string | null; sort_order: number; }
interface Provider { id: string; item_id: string; provider_name: string; provider_type: string; unit_value: number; quantity: number; amount_paid: number; }

const ITEM_CATALOG_DEFAULTS = [
  'Estructura metálica', 'Instalación eléctrica', 'Pintura electrostática',
  'Tapizado / Tejido', 'Vidrio / Cristal', 'Madera / Carpintería',
  'Instalación / Montaje', 'Transporte', 'Diseño',
];

export default function ProductDetailScreen() {
  const { id: projectId, productId } = useLocalSearchParams<{ id: string; productId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [project, setProject]   = useState<any>(null);
  const [product, setProduct]   = useState<any>(null);
  const [items, setItems]       = useState<ProductItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [itemName, setItemName] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !productId) return;
    try {
      const [projRes, prodRes, itemsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_products').select('*').eq('id', productId).single(),
        supabase.from('product_items').select('*').eq('product_id', productId).order('sort_order'),
      ]);
      setProject(projRes.data);
      setProduct(prodRes.data);
      const itemList = itemsRes.data || [];
      setItems(itemList);
      if (itemList.length > 0) {
        const { data: provData } = await supabase
          .from('item_providers')
          .select('*')
          .in('item_id', itemList.map((i: ProductItem) => i.id));
        setProviders(provData || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId, productId]);

  useEffect(() => { load(); }, [load]);

  const handleAddItem = async () => {
    if (!itemName.trim()) { setFormError('El nombre del ítem es requerido'); return; }
    setFormError(''); setSaving(true);
    try {
      const { error } = await supabase.from('product_items').insert({
        product_id: productId, name: itemName.trim(),
      });
      if (error) throw error;
      setShowItemModal(false); setItemName(''); load();
    } catch (e: any) { setFormError(e.message || 'Error al crear ítem'); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    Alert.alert('Eliminar ítem', `¿Eliminar "${itemName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('product_items').delete().eq('id', itemId);
        load();
      }},
    ]);
  };

  // Calcular costo total del producto
  const totalCost = providers.reduce((sum, p) => sum + p.unit_value * p.quantity, 0);
  const totalPaid = providers.reduce((sum, p) => sum + p.amount_paid, 0);

  // Calcular precio con la config del proyecto/producto
  const pricing = project && product ? (() => {
    const cfg = resolveConfig(project, product);
    return calcularPrecio({
      costo_total:    totalCost,
      sale_type:      cfg.sale_type,
      commission_pct: cfg.commission_pct,
      discount_pct:   cfg.discount_pct,
      rounding_to:    cfg.rounding_to,
      quantity:       product.quantity,
      taxes:          cfg,
    });
  })() : null;

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
          <Text style={styles.headerTitle} numberOfLines={1}>{product?.name}</Text>
          <Text style={styles.headerSub}>{product?.quantity} {product?.unit}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Resumen de precio */}
        {pricing && totalCost > 0 && (
          <Card style={styles.pricingCard}>
            <View style={styles.pricingHeader}>
              <Calculator size={18} color={COLORS.primary} />
              <Text style={styles.pricingTitle}>Resumen de precio</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Costo total</Text>
              <Text style={styles.pricingValue}>{formatCurrency(pricing.costo_total)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tipo: {SALE_TYPE_LABELS[project?.sale_type]}</Text>
              <Text style={styles.pricingValue}>Margen {(pricing.margen_tipo_venta * 100).toFixed(0)}%</Text>
            </View>
            {pricing.comision_total > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Comisión real</Text>
                <Text style={styles.pricingValue}>{formatCurrency(pricing.comision_total)}</Text>
              </View>
            )}
            <View style={[styles.pricingRow, styles.pricingDivider]}>
              <Text style={styles.pricingLabel}>Precio unitario</Text>
              <Text style={[styles.pricingValue, { color: COLORS.primary }]}>{formatCurrency(pricing.precio_con_descuento)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Subtotal × {product?.quantity}</Text>
              <Text style={[styles.pricingValue, { fontWeight: TYPOGRAPHY.fontWeight.bold }]}>{formatCurrency(pricing.subtotal)}</Text>
            </View>
            {pricing.iva_amount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>+ IVA 19%</Text>
                <Text style={styles.pricingValue}>{formatCurrency(pricing.iva_amount)}</Text>
              </View>
            )}
            <View style={[styles.pricingRow, styles.pricingDivider]}>
              <Text style={[styles.pricingLabel, { fontWeight: TYPOGRAPHY.fontWeight.bold }]}>Total factura</Text>
              <Text style={[styles.pricingValue, { fontWeight: TYPOGRAPHY.fontWeight.bold, fontSize: TYPOGRAPHY.fontSize.lg }]}>{formatCurrency(pricing.total_factura)}</Text>
            </View>
            {pricing.total_retenciones > 0 && (
              <>
                {pricing.rete_fuente_amount > 0 && <View style={styles.pricingRow}><Text style={styles.retLabel}>− Rete fuente (4%)</Text><Text style={styles.retValue}>{formatCurrency(pricing.rete_fuente_amount)}</Text></View>}
                {pricing.rete_ica_amount > 0 && <View style={styles.pricingRow}><Text style={styles.retLabel}>− Rete ICA</Text><Text style={styles.retValue}>{formatCurrency(pricing.rete_ica_amount)}</Text></View>}
                {pricing.rete_iva_amount > 0 && <View style={styles.pricingRow}><Text style={styles.retLabel}>− Rete IVA</Text><Text style={styles.retValue}>{formatCurrency(pricing.rete_iva_amount)}</Text></View>}
                {pricing.amount_4pct > 0 && <View style={styles.pricingRow}><Text style={styles.retLabel}>− 4%</Text><Text style={styles.retValue}>{formatCurrency(pricing.amount_4pct)}</Text></View>}
                {pricing.amount_5pct_renta > 0 && <View style={styles.pricingRow}><Text style={styles.retLabel}>− Renta 5%</Text><Text style={styles.retValue}>{formatCurrency(pricing.amount_5pct_renta)}</Text></View>}
                <View style={[styles.pricingRow, styles.pricingDivider]}>
                  <Text style={styles.pricingLabel}>Neto a recibir</Text>
                  <Text style={[styles.pricingValue, { color: COLORS.success }]}>{formatCurrency(pricing.neto_recibido)}</Text>
                </View>
              </>
            )}
            <View style={[styles.pricingRow, { backgroundColor: COLORS.success + '10', borderRadius: RADIUS.sm, padding: SPACING.xs, marginTop: SPACING.xs }]}>
              <Text style={[styles.pricingLabel, { color: COLORS.success }]}>Utilidad bruta</Text>
              <Text style={[styles.pricingValue, { color: COLORS.success, fontWeight: TYPOGRAPHY.fontWeight.bold }]}>
                {formatCurrency(pricing.utilidad_bruta)} ({(pricing.utilidad_pct * 100).toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Pagado a proveedores</Text>
              <Text style={[styles.pricingValue, { color: totalPaid >= totalCost ? COLORS.success : COLORS.warning }]}>{formatCurrency(totalPaid)}</Text>
            </View>
          </Card>
        )}

        {/* Ítems (tipos) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ítems ({items.length})</Text>
          <TouchableOpacity style={styles.addSmallBtn} onPress={() => { setItemName(''); setFormError(''); setShowItemModal(true); }}>
            <Plus size={18} color={COLORS.background} />
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <Card style={styles.emptyCard}><Text style={styles.emptyText}>Sin ítems. Agrega el primero.</Text></Card>
        ) : (
          items.map(item => {
            const itemProviders = providers.filter(p => p.item_id === item.id);
            const itemCost = itemProviders.reduce((s, p) => s + p.unit_value * p.quantity, 0);
            const itemPaid = itemProviders.reduce((s, p) => s + p.amount_paid, 0);
            return (
              <TouchableOpacity key={item.id} onPress={() => router.push(`/project/${projectId}/product/${productId}/item/${item.id}` as any)} activeOpacity={0.7}>
                <Card style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemCosts}>
                        <Text style={styles.itemCostText}>Costo: {formatCurrency(itemCost)}</Text>
                        {itemCost > 0 && (
                          <Text style={[styles.itemCostText, { color: itemPaid >= itemCost ? COLORS.success : COLORS.warning }]}>
                            Pagado: {formatCurrency(itemPaid)}
                          </Text>
                        )}
                        <Text style={styles.itemCostText}>{itemProviders.length} proveedor(es)</Text>
                      </View>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => handleDeleteItem(item.id, item.name)} style={styles.deleteBtn}>
                        <Trash2 size={16} color={COLORS.error} />
                      </TouchableOpacity>
                      <ChevronRight size={18} color={COLORS.textSecondary} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal nuevo ítem */}
      <Modal visible={showItemModal} animationType="slide" transparent onRequestClose={() => setShowItemModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Ítem</Text>
              <TouchableOpacity onPress={() => setShowItemModal(false)}><X size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Input label="Tipo de ítem" placeholder="Ej: Estructura metálica" value={itemName} onChangeText={setItemName} />

              <Text style={styles.catalogLabel}>Sugerencias</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.catalogRow}>
                  {ITEM_CATALOG_DEFAULTS.map(s => (
                    <TouchableOpacity key={s} style={styles.catalogChip} onPress={() => setItemName(s)}>
                      <Text style={styles.catalogChipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {formError ? <ErrorBox message={formError} /> : null}
              <View style={[styles.modalActions, { paddingBottom: insets.bottom + SPACING.md }]}>
                <Button title="Cancelar" variant="outline" onPress={() => setShowItemModal(false)} style={{ flex: 1 }} />
                <Button title="Crear" onPress={handleAddItem} loading={saving} style={{ flex: 1 }} />
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
  content: { padding: SPACING.md },
  pricingCard: { padding: SPACING.md, marginBottom: SPACING.lg },
  pricingHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.md },
  pricingTitle: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  pricingDivider: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.xs, paddingTop: SPACING.xs },
  pricingLabel: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  pricingValue: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text, fontWeight: TYPOGRAPHY.fontWeight.medium },
  retLabel: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.error },
  retValue: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.error },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  addSmallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: SPACING.lg, alignItems: 'center' },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  itemCard: { marginBottom: SPACING.sm, padding: SPACING.md },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text },
  itemCosts: { flexDirection: 'row', gap: SPACING.md, marginTop: 4, flexWrap: 'wrap' },
  itemCostText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  deleteBtn: { padding: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  catalogLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.xs },
  catalogRow: { flexDirection: 'row', gap: SPACING.sm },
  catalogChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full ?? 20, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  catalogChipText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.primary },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
});
