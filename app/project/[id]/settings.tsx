import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorBox } from '@/components/ErrorBox';
import { supabase } from '@/lib/supabase';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { SALE_TYPE_LABELS } from '@/lib/projectPricing';

export default function ProjectSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName]         = useState('');
  const [code, setCode]         = useState('');
  const [client, setClient]     = useState('');
  const [saleType, setSaleType] = useState('fabricacion');
  const [commission, setCommission] = useState('0');
  const [discount, setDiscount]     = useState('0');
  const [rounding, setRounding]     = useState('1000');
  const [status, setStatus]         = useState('active');

  const [applyIva, setApplyIva]               = useState(false);
  const [applyReteIva, setApplyReteIva]       = useState(false);
  const [applyReteIca, setApplyReteIca]       = useState(false);
  const [applyReteFuente, setApplyReteFuente] = useState(false);
  const [apply4pct, setApply4pct]             = useState(false);
  const [apply5pct, setApply5pct]             = useState(false);

  const [ivaRate, setIvaRate]               = useState('19');
  const [reteIvaRate, setReteIvaRate]       = useState('15');
  const [reteIcaRate, setReteIcaRate]       = useState('1.2875');
  const [reteFuenteRate, setReteFuenteRate] = useState('4');
  const [rate4pct, setRate4pct]             = useState('4');
  const [rate5pct, setRate5pct]             = useState('5');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      if (data) {
        setName(data.name); setCode(data.code || ''); setClient(data.client_name || '');
        setSaleType(data.sale_type); setStatus(data.status);
        setCommission(String((data.commission_pct * 100).toFixed(2)));
        setDiscount(String((data.discount_pct * 100).toFixed(2)));
        setRounding(String(data.rounding_to));
        setApplyIva(data.apply_iva); setApplyReteIva(data.apply_rete_iva);
        setApplyReteIca(data.apply_rete_ica); setApplyReteFuente(data.apply_rete_fuente);
        setApply4pct(data.apply_4pct); setApply5pct(data.apply_5pct_renta);
        setIvaRate(String((data.iva_rate * 100).toFixed(4)));
        setReteIvaRate(String((data.rete_iva_rate * 100).toFixed(2)));
        setReteIcaRate(String((data.rete_ica_rate * 100).toFixed(4)));
        setReteFuenteRate(String((data.rete_fuente_rate * 100).toFixed(2)));
        setRate4pct(String((data.rate_4pct * 100).toFixed(2)));
        setRate5pct(String((data.rate_5pct_renta * 100).toFixed(2)));
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) { setFormError('El nombre es requerido'); return; }
    setFormError(''); setSaving(true);
    try {
      const { error } = await supabase.from('projects').update({
        name: name.trim(), code: code.trim() || null,
        client_name: client.trim() || null,
        sale_type: saleType, status,
        commission_pct: (parseFloat(commission) || 0) / 100,
        discount_pct:   (parseFloat(discount) || 0) / 100,
        rounding_to:    parseInt(rounding) || 1000,
        apply_iva: applyIva, apply_rete_iva: applyReteIva,
        apply_rete_ica: applyReteIca, apply_rete_fuente: applyReteFuente,
        apply_4pct: apply4pct, apply_5pct_renta: apply5pct,
        iva_rate:          (parseFloat(ivaRate) || 19) / 100,
        rete_iva_rate:     (parseFloat(reteIvaRate) || 15) / 100,
        rete_ica_rate:     (parseFloat(reteIcaRate) || 1.2875) / 100,
        rete_fuente_rate:  (parseFloat(reteFuenteRate) || 4) / 100,
        rate_4pct:         (parseFloat(rate4pct) || 4) / 100,
        rate_5pct_renta:   (parseFloat(rate5pct) || 5) / 100,
      }).eq('id', id);
      if (error) throw error;
      router.back();
    } catch (e: any) { setFormError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const TaxRow = ({ label, value, onToggle, rate, onRate, rateLabel = '%' }: any) => (
    <View style={styles.taxRow}>
      <View style={styles.taxLeft}>
        <Switch value={value} onValueChange={onToggle} trackColor={{ true: COLORS.primary }} />
        <Text style={styles.taxLabel}>{label}</Text>
      </View>
      {value && (
        <View style={styles.taxRate}>
          <Input value={rate} onChangeText={onRate} keyboardType="numeric" style={styles.rateInput} />
          <Text style={styles.rateLabel}>{rateLabel}</Text>
        </View>
      )}
    </View>
  );

  if (loading) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración del Proyecto</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>General</Text>
        <Input label="Código" value={code} onChangeText={setCode} placeholder="0344" />
        <Input label="Nombre" value={name} onChangeText={setName} placeholder="Nombre del proyecto" />
        <Input label="Cliente" value={client} onChangeText={setClient} placeholder="Nombre del cliente" />

        <Text style={styles.section}>Estado</Text>
        <View style={styles.statusRow}>
          {(['active','paused','completed','cancelled'] as const).map(s => (
            <TouchableOpacity key={s} style={[styles.statusOpt, status === s && styles.statusOptSel]} onPress={() => setStatus(s)}>
              <Text style={[styles.statusText, status === s && styles.statusTextSel]}>
                {{ active:'Activo', paused:'Pausado', completed:'Completado', cancelled:'Cancelado' }[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Tipo de venta</Text>
        <View style={styles.typeGrid}>
          {Object.entries(SALE_TYPE_LABELS).map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.typeOpt, saleType === k && styles.typeOptSel]} onPress={() => setSaleType(k)}>
              <Text style={[styles.typeText, saleType === k && styles.typeTextSel]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Financiero</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Input label="Comisión (%)" value={commission} onChangeText={setCommission} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><Input label="Descuento (%)" value={discount} onChangeText={setDiscount} keyboardType="numeric" /></View>
        </View>
        <Input label="Redondear precio al múltiplo de" value={rounding} onChangeText={setRounding} keyboardType="numeric" placeholder="1000" />

        <Text style={styles.section}>Impuestos y retenciones</Text>
        <TaxRow label="IVA" value={applyIva} onToggle={setApplyIva} rate={ivaRate} onRate={setIvaRate} rateLabel="% (del subtotal)" />
        <TaxRow label="Rete IVA" value={applyReteIva} onToggle={setApplyReteIva} rate={reteIvaRate} onRate={setReteIvaRate} rateLabel="% (del IVA)" />
        <TaxRow label="Rete ICA" value={applyReteIca} onToggle={setApplyReteIca} rate={reteIcaRate} onRate={setReteIcaRate} rateLabel="% (del subtotal)" />
        <TaxRow label="Rete Fuente" value={applyReteFuente} onToggle={setApplyReteFuente} rate={reteFuenteRate} onRate={setReteFuenteRate} rateLabel="%" />
        <TaxRow label="4% GMF" value={apply4pct} onToggle={setApply4pct} rate={rate4pct} onRate={setRate4pct} rateLabel="%" />
        <TaxRow label="5% Renta" value={apply5pct} onToggle={setApply5pct} rate={rate5pct} onRate={setRate5pct} rateLabel="%" />

        {formError ? <ErrorBox message={formError} /> : null}
        <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Button title="Cancelar" variant="outline" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Guardar" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  content: { padding: SPACING.md },
  section: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary, textTransform: 'uppercase', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusOpt: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  statusOptSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text },
  statusTextSel: { color: COLORS.background },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  typeOpt: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeOptSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text },
  typeTextSel: { color: COLORS.background },
  taxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  taxLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  taxLabel: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text },
  taxRate: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  rateInput: { width: 70 },
  rateLabel: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
});
