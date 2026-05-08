import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X, FolderOpen, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorBox } from '@/components/ErrorBox';
import { Card } from '@/components/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { SALE_TYPE_LABELS } from '@/lib/projectPricing';

interface Project {
  id: string;
  code: string | null;
  name: string;
  client_name: string | null;
  status: string;
  sale_type: string;
  commission_pct: number;
  created_at: string;
  product_count?: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', completed: 'Completado',
  cancelled: 'Cancelado', paused: 'Pausado',
};
const STATUS_COLORS: Record<string, string> = {
  active: COLORS.success, completed: '#6366F1',
  cancelled: COLORS.error, paused: COLORS.warning,
};

export default function ProjectsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [saleType, setSaleType] = useState('fabricacion');

  const loadProjects = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);
    } catch (e) {
      console.error('Error loading projects:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleSave = async () => {
    if (!name.trim()) { setFormError('El nombre del proyecto es requerido'); return; }
    setFormError('');
    setSaving(true);
    try {
      const { error } = await supabase.from('projects').insert({
        user_id: user!.id,
        code: code.trim() || null,
        name: name.trim(),
        client_name: client.trim() || null,
        sale_type: saleType,
      });
      if (error) throw error;
      setShowModal(false);
      resetForm();
      loadProjects();
    } catch (e: any) {
      setFormError(e.message || 'Error al crear el proyecto');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCode(''); setName(''); setClient('');
    setSaleType('fabricacion'); setFormError('');
  };

  const renderProject = ({ item }: { item: Project }) => (
    <TouchableOpacity
      onPress={() => router.push(`/project/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <Card style={styles.projectCard}>
        <View style={styles.projectHeader}>
          <View style={styles.projectInfo}>
            {item.code && <Text style={styles.projectCode}>#{item.code}</Text>}
            <Text style={styles.projectName}>{item.name}</Text>
            {item.client_name && (
              <Text style={styles.projectClient}>{item.client_name}</Text>
            )}
          </View>
          <View style={styles.projectRight}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
            <ChevronRight size={18} color={COLORS.textSecondary} style={{ marginTop: 8 }} />
          </View>
        </View>
        <View style={styles.projectFooter}>
          <Text style={styles.projectMeta}>{SALE_TYPE_LABELS[item.sale_type]}</Text>
          {item.commission_pct > 0 && (
            <Text style={styles.projectMeta}>
              Comisión: {(item.commission_pct * 100).toFixed(1)}%
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Proyectos</Text>
          <Text style={styles.subtitle}>{projects.length} proyecto(s)</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setShowModal(true); }}>
          <Plus size={24} color={COLORS.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        renderItem={renderProject}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProjects(); }} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <FolderOpen size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No hay proyectos aún</Text>
            <Button title="Crear primer proyecto" onPress={() => { resetForm(); setShowModal(true); }} style={{ marginTop: SPACING.md }} />
          </View>
        ) : null}
      />

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Proyecto</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Input label="Código (opcional)" placeholder="0344" value={code} onChangeText={setCode} />
              <Input label="Nombre del proyecto" placeholder="Ej: Diseño sala comedor" value={name} onChangeText={setName} />
              <Input label="Cliente (opcional)" placeholder="Nombre del cliente" value={client} onChangeText={setClient} />

              <Text style={styles.label}>Tipo de venta</Text>
              <View style={styles.typeGrid}>
                {Object.entries(SALE_TYPE_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeOption, saleType === key && styles.typeSelected]}
                    onPress={() => setSaleType(key)}
                  >
                    <Text style={[styles.typeText, saleType === key && styles.typeTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formError ? <ErrorBox message={formError} /> : null}

              <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.md }]}>
                <Button title="Cancelar" variant="outline" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
                <Button title="Crear" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, backgroundColor: COLORS.background,
  },
  title: { fontSize: TYPOGRAPHY.fontSize['3xl'], fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  subtitle: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  addButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: SPACING.md },
  projectCard: { marginBottom: SPACING.md, padding: SPACING.md },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  projectInfo: { flex: 1 },
  projectCode: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeight.bold, marginBottom: 2 },
  projectName: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text },
  projectClient: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  projectRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  statusText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  projectFooter: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  projectMeta: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  label: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, marginBottom: SPACING.xs, marginTop: SPACING.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  typeOption: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text, fontWeight: TYPOGRAPHY.fontWeight.medium },
  typeTextSelected: { color: COLORS.background },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
});
