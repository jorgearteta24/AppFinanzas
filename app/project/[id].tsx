import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, ChevronRight, Trash2, Settings } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorBox } from '@/components/ErrorBox';
import { Card } from '@/components/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { SALE_TYPE_LABELS, SALE_TYPE_MARGINS } from '@/lib/projectPricing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Project {
  id: string; code: string | null; name: string; client_name: string | null;
  status: string; sale_type: string; commission_pct: number; discount_pct: number;
  rounding_to: number;
  apply_iva: boolean; apply_rete_iva: boolean; apply_rete_ica: boolean;
  apply_rete_fuente: boolean; apply_4pct: boolean; apply_5pct_renta: boolean;
  iva_rate: number; rete_iva_rate: number; rete_ica_rate: number;
  rete_fuente_rate: number; rate_4pct: number; rate_5pct_renta: number;
}

interface Product {
  id: string; name: string; description: string | null;
  quantity: number; unit: string; sale_type: string | null;
  commission_pct: number | null; discount_pct: number | null;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Product form
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodQty, setProdQty] = useState('1');
  const [prodUnit, setProdUnit] = useState('und');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [projRes, prodRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_products').select('*').eq('project_id', id).order('sort_order'),
      ]);
      if (projRes.error) throw projRes.error;
      setProject(projRes.data);
      setProducts(prodRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAddProduct = async () => {
    if (!prodName.trim()) { setFormError('El nombre del producto es requerido'); return; }
    setFormError(''); setSaving(true);
    try {
      const { error } = await supabase.from('project_products').insert({
        project_id: id,
        name: prodName.trim(),
        description: prodDesc.trim() || null,
        quantity: parseFloat(prodQty) || 1,
        unit: prodUnit.trim() || 'und',
      });
      if (error) throw error;
      setShowProductModal(false);
      setProdName(''); setProdDesc(''); setProdQty('1'); setProdUnit('und');
      load();
    } catch (e: any) { setFormError(e.message || 'Error al crear producto'); }
    finally { setSaving(false); }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    Alert.alert('Eliminar producto', `¿Eliminar "${productName}"? Se perderán todos sus ítems y proveedores.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('project_products').delete().eq('id', productId);
        load();
      }},
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  if (!project) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}><Text style={styles.errorText}>Proyecto no encontrado</Text></View>
    </SafeAreaView>
  );

  const margen = SALE_TYPE_MARGINS[project.sale_type] ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {project.code && <Text style={styles.headerCode}>#{project.code}</Text>}
          <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/project/${id}/settings` as any)}>
          <Settings size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info del proyecto */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue}>{project.client_name || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo de venta</Text>
            <Text style={styles.infoValue}>{SALE_TYPE_LABELS[project.sale_type]}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Margen objetivo</Text>
            <Text style={[styles.infoValue, { color: COLORS.success }]}>{(margen * 100).toFixed(0)}%</Text>
          </View>
          {project.commission_pct > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Comisión</Text>
              <Text style={styles.infoValue}>{(project.commission_pct * 100).toFixed(1)}%</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Redondeo</Text>
            <Text style={styles.infoValue}>Al {formatCurrency(project.rounding_to)} más cercano</Text>
          </View>
          {/* Impuestos activos */}
          <View style={styles.taxRow}>
            {project.apply_iva && <View style={styles.taxBadge}><Text style={styles.taxBadgeText}>IVA 19%</Text></View>}
            {project.apply_rete_iva && <View style={styles.taxBadge}><Text style={styles.taxBadgeText}>Rete IVA</Text></View>}
            {project.apply_rete_ica && <View style={styles.taxBadge}><Text style={styles.taxBadgeText}>Rete ICA</Text></View>}
            {project.apply_rete_fuente && <View style={styles.taxBadge}><Text style={styles.taxBadgeText}>Rete Fuente 4%</Text></View>}
            {project.apply_4pct && <View style={styles.taxBadge}><Text style={styles.taxBadgeText}>4%</Text></View>}
            {project.apply_5pct_renta && <View style={styles.taxBadge}><Text style={styles.taxBadgeText}>Renta 5%</Text></View>}
          </View>
        </Card>

        {/* Productos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Productos ({products.length})</Text>
          <TouchableOpacity style={styles.addSmallBtn} onPress={() => { setFormError(''); setShowProductModal(true); }}>
            <Plus size={18} color={COLORS.background} />
          </TouchableOpacity>
        </View>

        {products.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin productos. Agrega el primero.</Text>
          </Card>
        ) : (
          products.map(product => (
            <TouchableOpacity
              key={product.id}
              onPress={() => router.push(`/project/${id}/product/${product.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.productCard}>
                <View style={styles.productRow}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.description && (
                      <Text style={styles.productDesc} numberOfLines={1}>{product.description}</Text>
                    )}
                    <Text style={styles.productQty}>
                      {product.quantity} {product.unit}
                      {product.sale_type && ` · ${SALE_TYPE_LABELS[product.sale_type]}`}
                    </Text>
                  </View>
                  <View style={styles.productActions}>
                    <TouchableOpacity onPress={() => handleDeleteProduct(product.id, product.name)} style={styles.deleteBtn}>
                      <Trash2 size={16} color={COLORS.error} />
                    </TouchableOpacity>
                    <ChevronRight size={18} color={COLORS.textSecondary} />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal nuevo producto */}
      <Modal visible={showProductModal} animationType="slide" transparent onRequestClose={() => setShowProductModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Producto</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Input label="Nombre del producto" placeholder="Ej: Silla metálica con cordón náutico" value={prodName} onChangeText={setProdName} />
              <Input label="Descripción (opcional)" placeholder="Descripción adicional" value={prodDesc} onChangeText={setProdDesc} multiline />
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                <View style={{ flex: 1 }}>
                  <Input label="Cantidad" placeholder="1" value={prodQty} onChangeText={setProdQty} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Unidad" placeholder="und" value={prodUnit} onChangeText={setProdUnit} />
                </View>
              </View>
              {formError ? <ErrorBox message={formError} /> : null}
              <View style={[styles.modalActions, { paddingBottom: insets.bottom + SPACING.md }]}>
                <Button title="Cancelar" variant="outline" onPress={() => setShowProductModal(false)} style={{ flex: 1 }} />
                <Button title="Crear" onPress={handleAddProduct} loading={saving} style={{ flex: 1 }} />
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
  errorText: { color: COLORS.error, fontSize: TYPOGRAPHY.fontSize.base },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerCode: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeight.bold },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  content: { padding: SPACING.md },
  infoCard: { padding: SPACING.md, marginBottom: SPACING.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  infoLabel: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  infoValue: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text, fontWeight: TYPOGRAPHY.fontWeight.medium },
  taxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  taxBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary + '20' },
  taxBadgeText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  addSmallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: SPACING.lg, alignItems: 'center' },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  productCard: { marginBottom: SPACING.sm, padding: SPACING.md },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productInfo: { flex: 1, marginRight: SPACING.sm },
  productName: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text },
  productDesc: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  productQty: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, marginTop: 4 },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  deleteBtn: { padding: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
});
