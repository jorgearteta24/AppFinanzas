import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { RulesManager } from '@/components/RulesManager';
import { DuplicateReconciliation } from '@/components/DuplicateReconciliation';
import { ManualMessageProcessor } from '@/components/ManualMessageProcessor';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants/theme';
import {
  ChevronRight,
  Wand as Wand2,
  Copy,
  MessageSquare,
  Upload,
  DollarSign,
  Calendar,
  Globe,
  Palette,
  User,
  LogOut,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [showDuplicateReconciliation, setShowDuplicateReconciliation] = useState(false);
  const [showManualProcessor, setShowManualProcessor] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al cerrar sesión');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Configuración</Text>
          <Text style={styles.subtitle}>Personaliza tu experiencia</Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.profileSection}>
            <View style={styles.profileIconContainer}>
              <User size={24} color={COLORS.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.sectionTitle}>Perfil</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.groupTitle}>Preferencias</Text>

        <Card style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <DollarSign size={20} color={COLORS.textSecondary} />
              <Text style={styles.label}>Moneda</Text>
            </View>
            <Text style={styles.value}>COP</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Calendar size={20} color={COLORS.textSecondary} />
              <Text style={styles.label}>Formato de fecha</Text>
            </View>
            <Text style={styles.value}>DD/MM/YYYY</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Globe size={20} color={COLORS.textSecondary} />
              <Text style={styles.label}>Zona horaria</Text>
            </View>
            <Text style={styles.value}>GMT-5</Text>
          </View>
        </Card>

        <Text style={styles.groupTitle}>Procesamiento Manual</Text>

        <TouchableOpacity onPress={() => setShowManualProcessor(true)}>
          <Card style={styles.actionCard}>
            <View style={styles.actionIconContainer}>
              <MessageSquare size={24} color={COLORS.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Procesar Mensaje Bancario</Text>
              <Text style={styles.actionDescription}>
                Pega manualmente mensajes de tu banco para crear transacciones
              </Text>
            </View>
            <ChevronRight size={20} color={COLORS.textSecondary} />
          </Card>
        </TouchableOpacity>

        <Text style={styles.groupTitle}>Automatización</Text>

        <TouchableOpacity onPress={() => setShowRulesManager(true)}>
          <Card style={styles.actionCard}>
            <View style={styles.actionIconContainer}>
              <Wand2 size={24} color={COLORS.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Reglas de Clasificación</Text>
              <Text style={styles.actionDescription}>
                Configura reglas automáticas para clasificar tus transacciones
              </Text>
            </View>
            <ChevronRight size={20} color={COLORS.textSecondary} />
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowDuplicateReconciliation(true)}>
          <Card style={styles.actionCard}>
            <View style={styles.actionIconContainer}>
              <Copy size={24} color={COLORS.warning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Conciliación de Duplicados</Text>
              <Text style={styles.actionDescription}>
                Revisa y resuelve transacciones duplicadas
              </Text>
            </View>
            <ChevronRight size={20} color={COLORS.textSecondary} />
          </Card>
        </TouchableOpacity>

        <Text style={styles.groupTitle}>Información del Sistema</Text>

        <Card style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Text style={styles.label}>Plataforma</Text>
            </View>
            <Text style={styles.value}>{Platform.OS.toUpperCase()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Text style={styles.label}>Versión</Text>
            </View>
            <Text style={styles.value}>1.0.0</Text>
          </View>
        </Card>

        <Button
          title="Cerrar Sesión"
          variant="outline"
          onPress={handleSignOut}
          fullWidth
          style={styles.signOutButton}
          icon={<LogOut size={20} color={COLORS.primary} />}
        />
      </ScrollView>

      <RulesManager
        visible={showRulesManager}
        onClose={() => setShowRulesManager(false)}
      />

      <DuplicateReconciliation
        visible={showDuplicateReconciliation}
        onClose={() => setShowDuplicateReconciliation(false)}
      />

      <ManualMessageProcessor
        visible={showManualProcessor}
        onClose={() => setShowManualProcessor(false)}
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
  groupTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  card: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  profileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  actionCard: {
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  actionDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  signOutButton: {
    marginTop: SPACING.md,
  },
});
