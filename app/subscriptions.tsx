import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  TextInput, Modal, Alert, ActivityIndicator, Keyboard
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { SubscriptionRepository, Subscription, Frequency } from '../services/database/repositories/SubscriptionRepository';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { getDomainForCategory, getCategory } from '../constants/categories';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryPill from '../components/CategoryPill';
import TransactionPreview from '../components/TransactionPreview';

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
  today.setHours(0, 0, 0, 0);
  const day = sub.recurrence_day;

  switch (sub.frequency) {
    case 'monthly': {
      if (day == null) break;
      // Try current month first, if already passed try next month
      const tryDate = (year: number, month: number) => {
        const maxDay = new Date(year, month + 1, 0).getDate();
        const effectiveDay = Math.min(day, maxDay);
        return new Date(year, month, effectiveDay);
      };
      let year = today.getFullYear();
      let month = today.getMonth();
      let candidate = tryDate(year, month);
      if (candidate <= today) {
        month++;
        if (month > 11) { month = 0; year++; }
        candidate = tryDate(year, month);
      }
      return candidate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }
    case 'yearly': {
      const start = new Date(sub.start_date);
      const startMonth = start.getMonth();
      const startDay = start.getDate();
      let year = today.getFullYear();
      const maxDay = new Date(year, startMonth + 1, 0).getDate();
      const effectiveDay = Math.min(startDay, maxDay);
      let candidate = new Date(year, startMonth, effectiveDay);
      if (candidate <= today) {
        year++;
        const maxDayNext = new Date(year, startMonth + 1, 0).getDate();
        candidate = new Date(year, startMonth, Math.min(startDay, maxDayNext));
      }
      return candidate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }
    case 'weekly': {
      const targetDow = day ?? 0;
      const currentDow = (today.getDay() + 6) % 7;
      const diff = (targetDow - currentDow + 7) % 7 || 7;
      const result = new Date(today);
      result.setDate(today.getDate() + diff);
      return result.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }
    case 'biweekly': {
      const targetDow = day ?? 0;
      const currentDow = (today.getDay() + 6) % 7;
      const diff = (targetDow - currentDow + 14) % 14 || 14;
      const result = new Date(today);
      result.setDate(today.getDate() + diff);
      return result.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }
  }
  return '—';
}

function monthlyEquivalent(sub: Subscription): number {
  switch (sub.frequency) {
    case 'weekly':    return sub.amount * 4.33;
    case 'biweekly':  return sub.amount * 2.17;
    case 'yearly':    return sub.amount / 12;
    default:          return sub.amount;
  }
}

function daysRemainingLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Domani';
  if (diffDays < 0) return 'Scaduta';
  return `Tra ${diffDays} giorni`;
}

// ─── Add/Edit Modal ────────────────────────────────────────────────────────

interface SubFormState {
  name: string;
  amount: string;
  direction: 'in' | 'out';
  category_key: string;
  frequency: Frequency;
  recurrence_day: string;
  start_date: string;
  is_active?: boolean;
}

const EMPTY_FORM: SubFormState = {
  name: '',
  amount: '',
  direction: 'out',
  category_key: 'libri_audio_abbonamenti',
  frequency: 'monthly',
  recurrence_day: String(new Date().getDate()),
  start_date: new Date().toISOString().split('T')[0],
  is_active: true,
};

const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

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

  // Calendar State for start_date (used for yearly)
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  React.useEffect(() => {
    setForm(initial || EMPTY_FORM);
    if (initial?.start_date) {
      const d = new Date(initial.start_date);
      if (!isNaN(d.getTime())) setCalendarDate({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [initial, visible]);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
  };
  const changeMonth = (dir: 'next' | 'prev') => {
    setCalendarDate(curr => {
      let m = curr.month + (dir === 'next' ? 1 : -1);
      let y = curr.year;
      if (m > 11) { m = 0; y += 1; }
      if (m < 0) { m = 11; y -= 1; }
      return { year: y, month: m };
    });
  };

  const set = (k: keyof SubFormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return Alert.alert('', 'Nome e importo sono obbligatori.');
    Keyboard.dismiss();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    Keyboard.dismiss();
    if (onDelete) {
      onDelete();
    }
  };

  const category = getCategory(form.category_key);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modal.container}>
        <View style={modal.header}>
          <Pressable onPress={handleClose}><Ionicons name="close" size={26} color={COLORS.primary} /></Pressable>
          <Text style={modal.title}>{initial ? 'Gestisci Periodica' : 'Nuova Periodica'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={handleSave} disabled={saving}>
              <Text style={[modal.save, saving && { opacity: 0.5 }]}>{saving ? '...' : 'Salva'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={modal.content}>
          {/* Direction toggle */}
          <Text style={modal.label}>Tipo</Text>
          <View style={modal.chipRow}>
            <Pressable
              style={[modal.chip, form.direction === 'out' && { backgroundColor: '#FEE2E2', borderColor: '#F87171', borderWidth: 1 }]}
              onPress={() => set('direction', 'out')}
            >
              <Text style={[modal.chipText, form.direction === 'out' && { color: '#991B1B', fontWeight: '900' }]}>Spesa</Text>
            </Pressable>
            <Pressable
              style={[modal.chip, form.direction === 'in' && { backgroundColor: '#D1FAE5', borderColor: '#34D399', borderWidth: 1 }]}
              onPress={() => set('direction', 'in')}
            >
              <Text style={[modal.chipText, form.direction === 'in' && { color: '#065F46', fontWeight: '900' }]}>Entrata</Text>
            </Pressable>
          </View>

          <Text style={modal.label}>Nome</Text>
          <TextInput
            style={modal.input}
            placeholder="es. Netflix, Stipendio, Affitto"
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

          {/* STATO PERIODICA */}
          {!!initial && (
            <>
              <Text style={modal.label}>Stato Periodica</Text>
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
            {form.frequency === 'monthly'
              ? 'Giorno del mese (1–31)'
              : form.frequency === 'yearly'
              ? 'Data rinnovo annuale'
              : 'Giorno della settimana'}
          </Text>
          {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
            <Text style={modal.fieldHint}>
              Per giorni oltre il 28°: se il mese è più corto, il rinnovo avviene l'ultimo giorno disponibile (es. il 31 in aprile → 30 apr).
            </Text>
          )}

          {form.frequency === 'weekly' || form.frequency === 'biweekly' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => {
                const isSelected = form.recurrence_day === String(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => set('recurrence_day', String(i))}
                    style={[
                      modal.chip,
                      { paddingHorizontal: 0, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
                      isSelected && modal.chipActive
                    ]}
                  >
                    <Text style={[modal.chipText, isSelected && modal.chipTextActive]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : form.frequency === 'yearly' ? (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Pressable onPress={() => changeMonth('prev')} style={{ padding: 4 }}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
                </Pressable>
                <Text style={{ fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary, fontSize: 14 }}>
                  {MONTHS_IT[calendarDate.month]} {calendarDate.year}
                </Text>
                <Pressable onPress={() => changeMonth('next')} style={{ padding: 4 }}>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: COLORS.secondary, fontFamily: TYPOGRAPHY.fontBold }}>{d}</Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(() => {
                  const days = getDaysInMonth(calendarDate.year, calendarDate.month);
                  const firstDay = getFirstDayOfMonth(calendarDate.year, calendarDate.month);
                  const grid = [];
                  for (let i = 0; i < firstDay; i++) {
                    grid.push(<View key={`empty-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />);
                  }
                  for (let i = 1; i <= days; i++) {
                    const dateStr = `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const isSelected = form.start_date === dateStr;
                    grid.push(
                      <Pressable 
                        key={`day-${i}`} 
                        onPress={() => {
                          set('start_date', dateStr);
                          set('recurrence_day', String(i));
                        }}
                        style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <View style={[{ width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, isSelected && { backgroundColor: COLORS.primary }]}>
                          <Text style={[{ fontSize: 14, color: COLORS.primary, fontFamily: TYPOGRAPHY.fontFamily }, isSelected && { color: '#FFF', fontFamily: TYPOGRAPHY.fontBold }]}>{i}</Text>
                        </View>
                      </Pressable>
                    );
                  }
                  return grid;
                })()}
              </View>
            </View>
          ) : (
            <TextInput
              style={modal.input}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={COLORS.secondary}
              value={form.recurrence_day}
              onChangeText={v => set('recurrence_day', v)}
            />
          )}

          {form.frequency !== 'yearly' && (
            <>
              <Text style={modal.label}>Data inizio (YYYY-MM-DD)</Text>
              <TextInput
                style={modal.input}
                placeholder="2026-01-01"
                placeholderTextColor={COLORS.secondary}
                value={form.start_date}
                onChangeText={v => set('start_date', v)}
              />
            </>
          )}

          {/* PULSANTE ELIMINA PERIODICA */}
          {!!initial && onDelete && (
            <Pressable 
              style={modal.deleteButton} 
              onPress={handleDeleteClick}
            >
              <Ionicons name="trash-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={modal.deleteButtonText}>Elimina Periodica</Text>
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
  const insets = useSafeAreaInsets();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [scheduledExpenses, setScheduledExpenses] = useState<any[]>([]);
  const [scheduledSortBy, setScheduledSortBy] = useState<'date' | 'amount_asc' | 'amount_desc'>('date');
  const [loading, setLoading] = useState(true);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);
  const [editTarget, setEditTarget] = useState<Subscription | null>(null);

  const load = async (orderBy = scheduledSortBy) => {
    setLoading(true);
    try {
      const all = await SubscriptionRepository.getAll();
      setSubs(all);
      const total = await SubscriptionRepository.getTotalMonthly();
      setTotalMonthly(total);
      const totalIn = await SubscriptionRepository.getTotalMonthlyIncome();
      setTotalMonthlyIncome(totalIn);
      
      const sched = await TransactionRepository.getScheduledExpenses(orderBy);
      setScheduledExpenses(sched);
    } catch (err) {
      console.error('Error loading subscriptions and scheduled expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.SUBSCRIPTIONS);
    load(scheduledSortBy);
  }, [scheduledSortBy]));

  const activeOut = subs.filter(s => s.is_active && (s.direction || 'out') === 'out');
  const activeIn = subs.filter(s => s.is_active && s.direction === 'in');
  const inactive = subs.filter(s => !s.is_active);
  const totalActive = activeOut.length + activeIn.length;

  const handleEdit = async (form: SubFormState) => {
    if (!editTarget?.id) return;
    await SubscriptionRepository.update(editTarget.id, {
      name: form.name.trim(),
      amount: parseFloat(form.amount.replace(',', '.')),
      direction: form.direction,
      category_key: form.category_key,
      frequency: form.frequency,
      recurrence_day: parseInt(form.recurrence_day) || null,
      start_date: form.start_date,
      is_active: form.is_active !== false,
    });
    setEditTarget(null);
    load(scheduledSortBy);
  };

  const handleToggle = async (sub: Subscription) => {
    if (!sub.id) return;
    await SubscriptionRepository.setIsActive(sub.id, !sub.is_active);
    load(scheduledSortBy);
  };

  const handleDelete = (sub: Subscription) => {
    Alert.alert(
      'Elimina periodica',
      `Vuoi eliminare "${sub.name}"? Le transazioni già generate resteranno invariate.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina', style: 'destructive',
          onPress: async () => {
            if (sub.id) await SubscriptionRepository.delete(sub.id);
            load(scheduledSortBy);
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
    direction: (editTarget.direction || 'out') as 'in' | 'out',
    category_key: editTarget.category_key,
    frequency: editTarget.frequency,
    recurrence_day: String(editTarget.recurrence_day ?? ''),
    start_date: editTarget.start_date,
    is_active: editTarget.is_active !== false,
  } : undefined;

  const renderCard = (sub: Subscription) => {
    const nextDateStr = nextOccurrenceLabel(sub);
    const isActive = sub.is_active !== false;

    return (
      <TransactionPreview
        key={sub.id}
        item={{
          ...sub,
          isSubscription: true,
          displayDate: isActive ? `Prossimo: ${nextDateStr}` : 'Inattivo',
        }}
        onPress={() => openEdit(sub)}
      />
    );
  };

  const renderScheduledCard = (tx: any) => {
    return (
      <TransactionPreview
        key={tx.id}
        item={{
          ...tx,
          displayDate: `${tx.date} · ${daysRemainingLabel(tx.date)}`,
        }}
        onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })}
      />
    );
  };

  return (
    <View style={styles.container}>
      {loading && subs.length === 0 && scheduledExpenses.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0A74FF" /></View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Header Sfumato Blu Premium */}
          <LinearGradient
            colors={['#0A74FF', '#0857C3']}
            style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Periodiche e Programmate</Text>
            </View>
            <Text style={styles.subtitle}>Gestisci le tue uscite ricorrenti e le spese programmate</Text>
          </LinearGradient>

          {/* Overlapping Bottom Sheet */}
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 48 }]}>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* SEZIONE: PERIODICHE */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.macroSectionLabel}>PERIODICHE</Text>
              </View>

              {activeOut.length > 0 && (
                <>
                  <Text style={styles.subSectionLabel}>Uscite ({activeOut.length})</Text>
                  {activeOut.map(renderCard)}
                </>
              )}

              {activeIn.length > 0 && (
                <>
                  <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>Entrate ({activeIn.length})</Text>
                  {activeIn.map(renderCard)}
                </>
              )}

              {inactive.length > 0 && (
                <>
                  <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>Disattivate ({inactive.length})</Text>
                  {inactive.map(renderCard)}
                </>
              )}

              {subs.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="repeat-outline" size={40} color={COLORS.secondary} />
                  <Text style={styles.emptyText}>Nessuna periodica registrata</Text>
                  <Text style={styles.emptySubtext}>Usa il + e la voce per aggiungerne una</Text>
                </View>
              )}

              {/* SEZIONE: SPESE PROGRAMMATE */}
              <View style={[styles.sectionHeaderRow, { marginTop: SPACING.xl }]}>
                <Text style={styles.macroSectionLabel}>SPESE PROGRAMMATE</Text>
                
                {scheduledExpenses.length > 0 && (
                  <View style={styles.sortContainer}>
                    <Pressable 
                      style={[styles.sortButton, scheduledSortBy === 'date' && styles.sortButtonActive]}
                      onPress={() => setScheduledSortBy('date')}
                    >
                      <Text style={[styles.sortButtonText, scheduledSortBy === 'date' && styles.sortButtonTextActive]}>Data</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.sortButton, scheduledSortBy === 'amount_desc' && styles.sortButtonActive]}
                      onPress={() => setScheduledSortBy('amount_desc')}
                    >
                      <Ionicons name="arrow-down" size={10} color={scheduledSortBy === 'amount_desc' ? '#FFFFFF' : COLORS.secondary} />
                      <Text style={[styles.sortButtonText, scheduledSortBy === 'amount_desc' && styles.sortButtonTextActive]}>€ Max</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.sortButton, scheduledSortBy === 'amount_asc' && styles.sortButtonActive]}
                      onPress={() => setScheduledSortBy('amount_asc')}
                    >
                      <Ionicons name="arrow-up" size={10} color={scheduledSortBy === 'amount_asc' ? '#FFFFFF' : COLORS.secondary} />
                      <Text style={[styles.sortButtonText, scheduledSortBy === 'amount_asc' && styles.sortButtonTextActive]}>€ Min</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {scheduledExpenses.length > 0 ? (
                scheduledExpenses.map(renderScheduledCard)
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={40} color={COLORS.secondary} />
                  <Text style={styles.emptyText}>Nessuna spesa programmata</Text>
                  <Text style={styles.emptySubtext}>Le spese con data futura compariranno qui</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 6,
  },
  netWorthHeaderContainer: {
    marginTop: 20,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  netWorthLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  netWorthValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  netWorthValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: -0.5,
  },
  netWorthSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 4,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  cardAccent: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    padding: SPACING.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    flex: 1,
  },
  autoPill: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  autoPillText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cardAmount: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  cardSep: {
    color: COLORS.secondary,
    fontSize: TYPOGRAPHY.sizes.base,
  },
  cardFrequency: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  cardNextOccurrence: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 4,
  },
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
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  macroSectionLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  subSectionLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
    marginLeft: 4,
    marginTop: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
    gap: 2,
  },
  sortButtonActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.soft,
  },
  sortButtonText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  sortButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  scheduledTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: SPACING.lg,
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
  fieldHint: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    lineHeight: 16,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
});
