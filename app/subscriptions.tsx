import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  TextInput, Modal, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { SubscriptionRepository, Subscription, Frequency } from '../services/database/repositories/SubscriptionRepository';
import { ALL_CATEGORIES, getDomainForCategory, getCategory } from '../constants/categories';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryPill from '../components/CategoryPill';

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'monthly',       label: 'Mensile' },
  { key: 'weekly',        label: 'Settimanale' },
  { key: 'biweekly',      label: 'Bisettimanale' },
  { key: 'yearly',        label: 'Annuale' },
];

const DOMAIN_COLORS: Record<string, string> = {
  cibo_bevande: '#6366F1', acquisti: '#06B6D4', alloggio: '#8B5CF6',
  trasporti: '#3B82F6', veicolo: '#F59E0B', vita_intrattenimento: '#EC4899',
  comunicazione_pc: '#10B981', spese_finanziarie: '#EF4444',
  investimenti: '#D97706', entrata: '#059669', default: '#9CA3AF',
};

function getCategoryColor(key: string): string {
  const domain = getDomainForCategory(key);
  return domain ? (DOMAIN_COLORS[domain.key] || DOMAIN_COLORS.default) : DOMAIN_COLORS.default;
}

function nextOccurrenceLabel(sub: Subscription): string {
  const today = new Date();
  const result = new Date(today);
  const day = sub.recurrence_day;

  switch (sub.frequency) {
    case 'monthly': {
      if (day != null) {
        result.setDate(day);
        if (result <= today) result.setMonth(result.getMonth() + 1);
      }
      break;
    }
    case 'yearly': {
      const start = new Date(sub.start_date);
      result.setMonth(start.getMonth());
      result.setDate(start.getDate());
      if (result <= today) result.setFullYear(result.getFullYear() + 1);
      break;
    }
    case 'weekly': {
      const targetDow = day ?? 0;
      const currentDow = (today.getDay() + 6) % 7;
      const diff = (targetDow - currentDow + 7) % 7 || 7;
      result.setDate(today.getDate() + diff);
      break;
    }
    case 'biweekly': {
      const targetDow = day ?? 0;
      const currentDow = (today.getDay() + 6) % 7;
      const diff = (targetDow - currentDow + 14) % 14 || 14;
      result.setDate(today.getDate() + diff);
      break;
    }
  }
  return result.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function monthlyEquivalent(sub: Subscription): number {
  switch (sub.frequency) {
    case 'weekly':    return sub.amount * 4.33;
    case 'biweekly':  return sub.amount * 2.17;
    case 'yearly':    return sub.amount / 12;
    default:          return sub.amount;
  }
}

// ─── Add/Edit Modal ────────────────────────────────────────────────────────

interface SubFormState {
  name: string;
  amount: string;
  category_key: string;
  frequency: Frequency;
  recurrence_day: string;
  start_date: string;
  is_active?: boolean;
}

const EMPTY_FORM: SubFormState = {
  name: '',
  amount: '',
  category_key: 'libri_audio_abbonamenti',
  frequency: 'monthly',
  recurrence_day: String(new Date().getDate()),
  start_date: new Date().toISOString().split('T')[0],
  is_active: true,
};

function SubModal({
  visible, onClose, onSave, onDelete, initial
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (form: SubFormState) => Promise<void>;
  onDelete?: () => void;
  initial?: SubFormState;
}) {
  const [form, setForm] = useState<SubFormState>(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  React.useEffect(() => {
    setForm(initial || EMPTY_FORM);
  }, [initial, visible]);

  const set = (k: keyof SubFormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return Alert.alert('', 'Nome e importo sono obbligatori.');
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      onDelete();
    }
  };

  const category = getCategory(form.category_key);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modal.container}>
        <View style={modal.header}>
          <Pressable onPress={onClose}><Ionicons name="close" size={26} color={COLORS.primary} /></Pressable>
          <Text style={modal.title}>{initial ? 'Gestisci Abbonamento' : 'Nuovo Abbonamento'}</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={[modal.save, saving && { opacity: 0.5 }]}>{saving ? '...' : 'Salva'}</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={modal.content}>
          <Text style={modal.label}>Nome</Text>
          <TextInput
            style={modal.input}
            placeholder="es. Netflix, Affitto"
            placeholderTextColor={COLORS.secondary}
            value={form.name}
            onChangeText={v => set('name', v)}
          />

          <Text style={modal.label}>Importo (€)</Text>
          <TextInput
            style={modal.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={COLORS.secondary}
            value={form.amount}
            onChangeText={v => set('amount', v)}
          />

          {/* STATO ABBONAMENTO */}
          {!!initial && (
            <>
              <Text style={modal.label}>Stato Abbonamento</Text>
              <View style={modal.chipRow}>
                <Pressable
                  style={[
                    modal.chip,
                    form.is_active !== false && { backgroundColor: '#D1FAE5', borderColor: '#34D399', borderWidth: 1 }
                  ]}
                  onPress={() => set('is_active', true)}
                >
                  <Text style={[
                    modal.chipText,
                    form.is_active !== false && { color: '#065F46', fontWeight: '900' }
                  ]}>
                    Attivo
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    modal.chip,
                    form.is_active === false && { backgroundColor: '#FEE2E2', borderColor: '#F87171', borderWidth: 1 }
                  ]}
                  onPress={() => set('is_active', false)}
                >
                  <Text style={[
                    modal.chipText,
                    form.is_active === false && { color: '#991B1B', fontWeight: '900' }
                  ]}>
                    Disattivato (In pausa)
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={modal.label}>Classificazione</Text>
          <Pressable style={modal.pickerTrigger} onPress={() => setShowPicker(true)}>
            <CategoryPill categoryKey={form.category_key} />
            {category && <Text style={modal.categoryLabel}>{category.label}</Text>}
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} style={{ marginLeft: 'auto' }} />
          </Pressable>

          <CategoryPickerModal
            visible={showPicker}
            currentCategoryKey={form.category_key}
            onSelect={(key) => { set('category_key', key); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />

          <Text style={modal.label}>Frequenza</Text>
          <View style={modal.chipRow}>
            {FREQUENCIES.map(f => (
              <Pressable
                key={f.key}
                style={[modal.chip, form.frequency === f.key && modal.chipActive]}
                onPress={() => set('frequency', f.key)}
              >
                <Text style={[modal.chipText, form.frequency === f.key && modal.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={modal.label}>
            {form.frequency === 'monthly' || form.frequency === 'yearly'
              ? 'Giorno del mese (1–31)'
              : 'Giorno della settimana (0=Lun…6=Dom)'}
          </Text>
          <TextInput
            style={modal.input}
            keyboardType="number-pad"
            placeholder={form.frequency === 'monthly' || form.frequency === 'yearly' ? '1' : '0'}
            placeholderTextColor={COLORS.secondary}
            value={form.recurrence_day}
            onChangeText={v => set('recurrence_day', v)}
          />

          <Text style={modal.label}>Data inizio (YYYY-MM-DD)</Text>
          <TextInput
            style={modal.input}
            placeholder="2026-01-01"
            placeholderTextColor={COLORS.secondary}
            value={form.start_date}
            onChangeText={v => set('start_date', v)}
          />

          {/* PULSANTE ELIMINA ABBONAMENTO */}
          {!!initial && onDelete && (
            <Pressable 
              style={modal.deleteButton} 
              onPress={handleDeleteClick}
            >
              <Ionicons name="trash-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={modal.deleteButtonText}>Elimina Abbonamento</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Subscription | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    setLoading(true);
    const all = await SubscriptionRepository.getAll();
    setSubs(all);
    const total = await SubscriptionRepository.getTotalMonthly();
    setTotalMonthly(total);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const active = subs.filter(s => s.is_active);
  const inactive = subs.filter(s => !s.is_active);

  const handleAdd = async (form: SubFormState) => {
    await SubscriptionRepository.insert({
      name: form.name.trim(),
      amount: parseFloat(form.amount.replace(',', '.')),
      category_key: form.category_key,
      frequency: form.frequency,
      recurrence_day: parseInt(form.recurrence_day) || null,
      start_date: form.start_date,
    });
    setShowModal(false);
    load();
  };

  const handleEdit = async (form: SubFormState) => {
    if (!editTarget?.id) return;
    await SubscriptionRepository.update(editTarget.id, {
      name: form.name.trim(),
      amount: parseFloat(form.amount.replace(',', '.')),
      category_key: form.category_key,
      frequency: form.frequency,
      recurrence_day: parseInt(form.recurrence_day) || null,
      start_date: form.start_date,
      is_active: form.is_active !== false,
    });
    setEditTarget(null);
    load();
  };

  const handleToggle = async (sub: Subscription) => {
    if (!sub.id) return;
    await SubscriptionRepository.setIsActive(sub.id, !sub.is_active);
    load();
  };

  const handleDelete = (sub: Subscription) => {
    Alert.alert(
      'Elimina abbonamento',
      `Vuoi eliminare "${sub.name}"? Le transazioni già generate resteranno invariate.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina', style: 'destructive',
          onPress: async () => {
            if (sub.id) await SubscriptionRepository.delete(sub.id);
            load();
          }
        }
      ]
    );
  };

  const openEdit = (sub: Subscription) => {
    setEditTarget(sub);
  };

  const editForm: SubFormState | undefined = editTarget ? {
    name: editTarget.name,
    amount: String(editTarget.amount),
    category_key: editTarget.category_key,
    frequency: editTarget.frequency,
    recurrence_day: String(editTarget.recurrence_day ?? ''),
    start_date: editTarget.start_date,
    is_active: editTarget.is_active !== false,
  } : undefined;

  const renderCard = (sub: Subscription) => {
    const color = getCategoryColor(sub.category_key);
    const freqLabel = FREQUENCIES.find(f => f.key === sub.frequency)?.label || sub.frequency;
    const isActive = sub.is_active !== false;

    return (
      <Pressable 
        key={sub.id} 
        style={[styles.card, !isActive && { opacity: 0.55 }]}
        onPress={() => openEdit(sub)}
      >
        <View style={[styles.cardAccent, { backgroundColor: isActive ? color : '#9CA3AF' }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardName, !isActive && { color: COLORS.secondary }]}>{sub.name}</Text>
            {!isActive && (
              <View style={[styles.autoPill, { backgroundColor: '#E5E7EB', marginLeft: 8 }]}>
                <Text style={[styles.autoPillText, { color: COLORS.secondary }]}>Inattivo</Text>
              </View>
            )}
          </View>
          <View style={styles.cardMeta}>
            <Text style={[styles.cardAmount, !isActive && { color: COLORS.secondary }]}>€{sub.amount.toFixed(2)}</Text>
            <Text style={styles.cardSep}>·</Text>
            <Text style={styles.cardFrequency}>{freqLabel}</Text>
          </View>
          {isActive && (
            <Text style={styles.cardNextOccurrence}>Prossimo: {nextOccurrenceLabel(sub)}</Text>
          )}
        </View>
        <View style={{ justifyContent: 'center', paddingRight: SPACING.lg }}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TOTAL MONTHLY ESTIMATE</Text>
            <Text style={styles.summaryValue}>€{totalMonthly.toFixed(2)}</Text>
            <Text style={styles.summaryCount}>{active.length} active subscription/s</Text>
          </View>

          {/* Active List */}
          {active.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ATTIVI</Text>
              {active.map(renderCard)}
            </>
          )}

          {/* Inactive List */}
          {inactive.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>DISATTIVATI</Text>
              {inactive.map(renderCard)}
            </>
          )}

          {subs.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="repeat-outline" size={48} color={COLORS.secondary} />
              <Text style={styles.emptyText}>Nessun abbonamento registrato</Text>
              <Text style={styles.emptySubText}>Tocca + per aggiungerne uno</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Modal */}
      <SubModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleAdd}
      />

      {/* Edit Modal */}
      <SubModal
        visible={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEdit}
        onDelete={editTarget ? () => {
          const target = editTarget;
          setEditTarget(null);
          handleDelete(target);
        } : undefined}
        initial={editForm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 44,
    fontFamily: TYPOGRAPHY.fontBold,
    marginBottom: 4,
  },
  summaryCount: {
    color: '#6B7280',
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...SHADOWS.soft,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: SPACING.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    flex: 1,
  },
  autoPill: {
    backgroundColor: '#DDD6FE',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  autoPillText: { fontSize: 10, fontFamily: TYPOGRAPHY.fontBold, color: '#7C3AED' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardAmount: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  cardSep: { color: COLORS.secondary, fontSize: TYPOGRAPHY.sizes.base },
  cardFrequency: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.secondary, fontFamily: TYPOGRAPHY.fontFamily },
  cardNextOccurrence: { fontSize: TYPOGRAPHY.sizes.xs, color: COLORS.secondary, fontFamily: TYPOGRAPHY.fontFamily, marginTop: 4 },
  cardActions: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingRight: SPACING.md,
    gap: SPACING.sm,
  },
  cardButton: { padding: 6 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  emptySubText: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.secondary, fontFamily: TYPOGRAPHY.fontFamily },
  inactiveToggle: {
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  inactiveToggleText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: { fontSize: TYPOGRAPHY.sizes.lg, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  save: { fontSize: TYPOGRAPHY.sizes.base, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.accent },
  content: { padding: SPACING.xl, paddingBottom: 80 },
  label: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.secondary },
  chipTextActive: { color: '#FFF' },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  categoryLabel: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 40,
    ...SHADOWS.medium,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
    fontWeight: '700',
  },
});
