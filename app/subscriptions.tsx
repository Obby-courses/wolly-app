import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  TextInput, Modal, Alert, ActivityIndicator, Keyboard, Switch,
  Platform, LayoutAnimation, Dimensions, PanResponder, Animated
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { SubscriptionRepository, Subscription, Frequency } from '../services/database/repositories/SubscriptionRepository';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { getDomainForCategory, getCategory } from '../constants/categories';
import { translateLocationType } from '../constants/i18n';
import { COMUNI_ITALIANI, ComuneItem } from '../constants/comuni';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryPill from '../components/CategoryPill';
import TransactionPreview from '../components/TransactionPreview';
import PeriodicDateSelector from '../components/PeriodicDateSelector';
import { useToast } from '../components/Toast';
import { INPUT_MAX_LENGTH } from '../constants/accessibility';

const capitalizeProperNoun = (val: string | null | undefined): string => {
  if (!val) return '';
  return val.trim().replace(/\b\w/g, c => c.toUpperCase());
};

const sanitizeLocationField = (val: string | null | undefined): string => {
  if (!val) return '';
  const blacklist = [
    'italia', 'italy', 'abruzzo', 'basilicata', 'calabria', 'campania', 
    'emilia-romagna', 'emilia romagna', 'friuli-venezia giulia', 'friuli venezia giulia', 'lazio', 
    'liguria', 'lombardia', 'marche', 'molise', 'piemonte', 'puglia', 
    'sardegna', 'sicilia', 'toscana', 'trentino-alto adige', 'trentino alto adige', 'trentino', 'alto adige', 'umbria', 
    'valle d\'aosta', 'valle daosta', 'veneto'
  ];
  return val
    .split(/[,;]/)
    .map(part => part.trim())
    .filter(part => {
      const lower = part.toLowerCase();
      return !blacklist.some(blacklisted => lower === blacklisted || lower.includes(blacklisted));
    })
    .join(', ');
};

interface SwipeableRowProps {
  children: React.ReactNode;
  onReset: () => void;
  enabled?: boolean;
}

const SwipeableRow = ({ children, onReset, enabled = true }: SwipeableRowProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!enabled) return false;
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dy) < 10 && gestureState.dx < 0;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled) return false;
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dy) < 10 && gestureState.dx < 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const drag = gestureState.dx;
          const cappedDrag = drag < -80 ? -80 + (drag + 80) * 0.2 : drag;
          translateX.setValue(cappedDrag);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -30) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
          onReset();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const opacity = translateX.interpolate({
    inputRange: [-50, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={modal.swipeContainer}>
      <Animated.View style={[modal.resetBackground, { opacity }]}>
        <Ionicons name="refresh-outline" size={20} color="#FFF" style={modal.resetIcon} />
      </Animated.View>
      <Animated.View
        style={{
          transform: [{ translateX }],
          backgroundColor: '#FFF',
        }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

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
      if (!day) break;
      const currentDow = (today.getDay() + 6) % 7;
      let diff = 7;
      for (let i = 1; i <= 7; i++) { // strictly future
        const d = (currentDow + i) % 7;
        if ((day & (1 << d)) !== 0) {
          diff = i;
          break;
        }
      }
      const result = new Date(today);
      result.setDate(today.getDate() + diff);
      return result.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }
    case 'biweekly': {
      if (!day) break;
      let diff = 14;
      for (let i = 1; i <= 14; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        
        const fDow = (futureDate.getDay() + 6) % 7;
        if ((day & (1 << fDow)) === 0) continue;
        
        const getMonday = (d: Date) => {
          const date = new Date(d);
          const dow = (date.getDay() + 6) % 7;
          date.setDate(date.getDate() - dow);
          date.setHours(0,0,0,0);
          return date;
        };
        const startMonday = getMonday(new Date(sub.start_date));
        const futureMonday = getMonday(futureDate);
        const weeksSinceStart = Math.round((futureMonday.getTime() - startMonday.getTime()) / (7 * 86400000));
        
        if (weeksSinceStart >= 0 && weeksSinceStart % 2 === 0) {
          diff = i;
          break;
        }
      }
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
  description: string;
  tags: string[];
  location_name: string;
  location_type: 'physical_store' | 'online' | '';
  city: string;
  address: string;
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
  description: '',
  tags: [],
  location_name: '',
  location_type: '',
  city: '',
  address: '',
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

  // Ensure start_date exists for non-yearly when form is initialized
  React.useEffect(() => {
    setForm(initial || EMPTY_FORM);
  }, [initial, visible]);

  const set = (k: keyof SubFormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const [activeField, setActiveField] = useState<string | null>(null);
  const [focusedInlineField, setFocusedInlineField] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState('');
  
  // Custom Tag Creation State
  const [newTagInput, setNewTagInput] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>(['lavoro', 'trasferta']);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<{[key: string]: any}>({});

  useEffect(() => {
    if (visible) {
      const loadTags = async () => {
        try {
          const dbTags = await TransactionRepository.getDistinctTags();
          const combinedTags = Array.from(new Set(['lavoro', 'trasferta', ...dbTags]))
            .filter(t => t !== 'viaggio' && t.trim() !== '');
          setAvailableTags(combinedTags);
        } catch (e) {
          console.error('Errore nel caricamento di tag:', e);
        }
      };
      loadTags();
      // Reset layout states
      setActiveField(null);
      setFocusedInlineField(null);
      setCitySearch('');
      setNewTagInput('');
      setShowNewTagInput(false);
    }
  }, [visible]);

  const handleInputFocus = (fieldName: string) => {
    setTimeout(() => {
      const inputRef = inputRefs.current[fieldName];
      if (inputRef && scrollViewRef.current) {
        inputRef.measureLayout(
          scrollViewRef.current,
          (x: number, y: number, w: number, h: number) => {
            const targetY = Math.max(0, y - 120);
            scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
          },
          (err: any) => console.log('measureLayout error for ' + fieldName, err)
        );
      }
    }, 250);
  };

  const toggleField = (field: string, scrollOffset: number = 0) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (activeField === field) {
      setActiveField(null);
    } else {
      setActiveField(field);
      if (scrollOffset > 0) {
        handleInputFocus(field);
      }
    }
  };

  const toggleTagChip = (tagStr: string) => {
    const currentTags = form.tags || [];
    let nextTags: string[];
    if (currentTags.includes(tagStr)) {
      nextTags = currentTags.filter(t => t !== tagStr);
    } else {
      nextTags = [...currentTags, tagStr];
    }
    set('tags', nextTags);
  };

  const handleAddCustomTag = () => {
    const cleanTag = newTagInput.trim().toLowerCase();
    if (!cleanTag) return;
    
    if (!availableTags.includes(cleanTag)) {
      setAvailableTags(curr => [...curr, cleanTag]);
    }
    const currentTags = form.tags || [];
    if (!currentTags.includes(cleanTag)) {
      set('tags', [...currentTags, cleanTag]);
    }
    setNewTagInput('');
    setShowNewTagInput(false);
  };

  const filteredCities = citySearch.length >= 2
    ? COMUNI_ITALIANI.filter(c => c.n.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 6)
    : [];

  const handleCitySelect = (comune: ComuneItem) => {
    set('city', sanitizeLocationField(comune.n));
    set('address', '');
    setCitySearch('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveField(null);
  };

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
  const isIncome = form.direction === 'in';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" accessibilityViewIsModal={true}>
      <SafeAreaView style={modal.container}>
        <View style={modal.header}>
          <Pressable onPress={handleClose} style={modal.backIcon} accessibilityRole="button" accessibilityLabel="Chiudi">
            <Ionicons name="close" size={20} color={COLORS.primary} />
          </Pressable>
          <Text style={modal.headerTitle}>
            {initial ? 'Gestisci Periodica' : 'Nuova Periodica'}
          </Text>
          <View style={modal.headerRightContainer}>
            {!!initial && onDelete && (
              <Pressable onPress={handleDeleteClick} style={modal.headerActionBtn} accessibilityRole="button" accessibilityLabel="Elimina periodica">
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </Pressable>
            )}
            <Pressable onPress={handleSave} disabled={saving} style={modal.headerSaveBtn} accessibilityRole="button" accessibilityLabel="Salva periodica">
              <Text style={modal.headerSaveText}>{saving ? '...' : 'Salva'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentContainerStyle={modal.content} showsVerticalScrollIndicator={false}>
          {/* SECTION: GENERALE */}
          <Text style={modal.sectionTitle}>GENERALE</Text>
          <View style={modal.card}>
            {/* DIRECTION SLIDER */}
            <View style={modal.sliderContainer}>
              <Pressable 
                onPress={() => set('direction', 'out')}
                style={[modal.sliderBtn, !isIncome && modal.sliderBtnOut]}
              >
                <Text style={[modal.sliderText, !isIncome && modal.sliderTextActive]}>Spesa</Text>
              </Pressable>
              <Pressable 
                onPress={() => set('direction', 'in')}
                style={[modal.sliderBtn, isIncome && modal.sliderBtnIn]}
              >
                <Text style={[modal.sliderText, isIncome && modal.sliderTextActive]}>Entrata</Text>
              </Pressable>
            </View>

            {/* AMOUNT */}
            <View style={modal.amountContainer}>
               <Text style={[modal.currency, { color: isIncome ? COLORS.success : COLORS.primary }]}>€</Text>
                <TextInput 
                  style={[modal.amountInput, { color: isIncome ? COLORS.success : COLORS.primary }]}
                  value={form.amount}
                  onChangeText={(val) => {
                    let newVal = val;
                    if (newVal.endsWith('.')) {
                      newVal = newVal.slice(0, -1) + ',';
                    }
                    let raw = newVal.replace(/\./g, '');
                    raw = raw.replace(/[^0-9,]/g, '');
                    raw = raw.replace(/(,.*),/g, '$1');

                    let parts = raw.split(',');
                    if (parts.length > 1) {
                      parts[1] = parts[1].substring(0, 2);
                      raw = parts.join(',');
                    }

                    let intPart = parts[0];
                    if (intPart.length > 9) {
                      intPart = intPart.substring(0, 9);
                    }
                    
                    if (intPart.length > 1 && intPart.startsWith('0')) {
                      intPart = intPart.replace(/^0+/, '');
                      if (intPart === '') intPart = '0';
                    }

                    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    const formatted = parts.length > 1 ? `${formattedInt},${parts[1]}` : formattedInt;

                    set('amount', formatted);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={isIncome ? 'rgba(52, 199, 89, 0.4)' : COLORS.secondary}
                  accessibilityLabel="Importo periodica in euro"
                  accessibilityHint="Inserisci il valore numerico usando la virgola come separatore decimale"
               />
            </View>

            {/* NAME ROW */}
            <View style={[modal.detailItemVertical, modal.detailItemBorder]}>
              <View style={modal.detailTextContainer}>
                <TextInput
                  style={modal.rowTextInput}
                  placeholder="es. Netflix, Stipendio, Affitto"
                  placeholderTextColor={COLORS.secondary}
                  value={form.name}
                  onChangeText={v => set('name', v)}
                  maxLength={INPUT_MAX_LENGTH.subscriptionName}
                  autoCapitalize="words"
                  accessibilityLabel="Nome periodica"
                />
                <Text style={modal.detailLabel}>Nome</Text>
              </View>
            </View>

            {/* ACTIVE STATE ROW */}
            {!!initial && (
              <View style={[modal.detailItemVertical, modal.detailItemBorder]}>
                <View style={modal.detailTextContainer}>
                  <Switch
                    value={form.is_active !== false}
                    onValueChange={v => set('is_active', v)}
                    trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                    thumbColor={'#FFF'}
                  />
                  <Text style={modal.detailLabel}>Stato Attivo</Text>
                </View>
              </View>
            )}

            {/* CLASSIFICATION ROW */}
            <Pressable
              style={modal.detailItemVertical}
              onPress={() => setShowPicker(true)}
            >
              <View style={modal.detailTextContainer}>
                <View style={modal.classificationRow}>
                  <View style={[modal.classificationDot, { backgroundColor: getCategoryColor(form.category_key) }]} />
                  <Text style={modal.detailValue}>
                    {category ? (category.label.charAt(0).toUpperCase() + category.label.slice(1).toLowerCase()) : 'Altro'}
                  </Text>
                </View>
                <Text style={modal.detailLabel}>Classificazione</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
            </Pressable>
          </View>

          <CategoryPickerModal
            visible={showPicker}
            currentCategoryKey={form.category_key}
            direction={form.direction}
            onSelect={(key) => { set('category_key', key); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />

          {/* SECTION: DETTAGLI */}
          <Text style={modal.sectionTitle}>DETTAGLI</Text>
          <View style={modal.card}>
            {/* NOTA ROW */}
            <SwipeableRow 
              enabled={!!form.description}
              onReset={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                set('description', '');
                setFocusedInlineField(null);
              }}
            >
              <View style={[modal.detailItemVertical, modal.detailItemBorder]}>
                <View style={modal.detailTextContainer}>
                  <View style={modal.textInputFadeContainer}>
                    <TextInput
                      ref={ref => { inputRefs.current['description'] = ref; }}
                      style={modal.rowTextInput}
                      placeholder="----"
                      placeholderTextColor={COLORS.secondary}
                      value={form.description}
                      onChangeText={(v) => set('description', v)}
                      maxLength={INPUT_MAX_LENGTH.note}
                      accessibilityLabel="Nota o descrizione"
                      editable={focusedInlineField === 'description'}
                      scrollEnabled={false}
                      onPressIn={() => {
                        if (focusedInlineField !== 'description') {
                          setFocusedInlineField('description');
                          setTimeout(() => inputRefs.current['description']?.focus(), 30);
                        }
                      }}
                      onFocus={() => {
                        setFocusedInlineField('description');
                        handleInputFocus('description');
                      }}
                      onBlur={() => setFocusedInlineField(null)}
                    />
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0)', '#FFFFFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={modal.rightFadeOverlay}
                      pointerEvents="none"
                    />
                  </View>
                  <Text style={modal.detailLabel}>Nota</Text>
                </View>
              </View>
            </SwipeableRow>

            {/* NEGOZIO ROW */}
            <SwipeableRow 
              enabled={!!form.location_name}
              onReset={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                set('location_name', '');
                setFocusedInlineField(null);
              }}
            >
              <View style={[modal.detailItemVertical, modal.detailItemBorder]}>
                <View style={modal.detailTextContainer}>
                  <View style={modal.textInputFadeContainer}>
                    <TextInput
                      ref={ref => { inputRefs.current['location_name'] = ref; }}
                      style={modal.rowTextInput}
                      placeholder="----"
                      placeholderTextColor={COLORS.secondary}
                      value={capitalizeProperNoun(form.location_name)}
                      onChangeText={(v) => set('location_name', capitalizeProperNoun(v))}
                      maxLength={INPUT_MAX_LENGTH.vendor}
                      autoCapitalize="words"
                      accessibilityLabel="Nome negozio o venditore"
                      editable={focusedInlineField === 'location_name'}
                      scrollEnabled={false}
                      onPressIn={() => {
                        if (focusedInlineField !== 'location_name') {
                          setFocusedInlineField('location_name');
                          setTimeout(() => inputRefs.current['location_name']?.focus(), 30);
                        }
                      }}
                      onFocus={() => {
                        setFocusedInlineField('location_name');
                        handleInputFocus('location_name');
                      }}
                      onBlur={() => setFocusedInlineField(null)}
                    />
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0)', '#FFFFFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={modal.rightFadeOverlay}
                      pointerEvents="none"
                    />
                  </View>
                  <Text style={modal.detailLabel}>Negozio</Text>
                </View>
              </View>
            </SwipeableRow>

            {/* LOCALITA ROW */}
            <SwipeableRow 
              enabled={!!form.city || !!form.address}
              onReset={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                set('city', '');
                set('address', '');
                setCitySearch('');
              }}
            >
              <Pressable 
                style={[modal.detailItemVertical, activeField !== 'city' && modal.detailItemBorder]}
                onPress={() => toggleField('city', 220)}
                accessibilityRole="button"
                accessibilityLabel={`Località, attualmente: ${form.city ? `${form.city}${form.address ? `, ${form.address}` : ''}` : 'Non definita'}`}
              >
                <View style={modal.detailTextContainer}>
                  <Text style={modal.detailValue}>
                    {form.city 
                      ? `${capitalizeProperNoun(form.city)}${form.address ? `, ${capitalizeProperNoun(form.address)}` : ''}` 
                      : '----'}
                  </Text>
                  <Text style={modal.detailLabel}>Località</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={activeField === 'city' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
                </View>
              </Pressable>
            </SwipeableRow>

            {activeField === 'city' && (
              <View style={[modal.citySearchContainer, modal.expandedSection, modal.detailItemBorder]}>
                <Text style={modal.editorLabel}>Città (Comune)</Text>
                <View style={modal.searchRow}>
                  <Ionicons name="search" size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                  <TextInput
                    ref={ref => { inputRefs.current['citySearch'] = ref; }}
                    style={modal.cityInput}
                    placeholder="Cerca comune italiano (es. Vimercate, Milano...)"
                    placeholderTextColor={COLORS.secondary}
                    value={citySearch}
                    onChangeText={setCitySearch}
                    maxLength={INPUT_MAX_LENGTH.citySearch}
                    autoCapitalize="words"
                    accessibilityLabel="Cerca comune"
                    autoFocus
                    onFocus={() => handleInputFocus('citySearch')}
                  />
                </View>

                {filteredCities.length > 0 && (
                  <View style={modal.cityResultsList}>
                    {filteredCities.map((c, i) => (
                      <Pressable
                        key={i}
                        onPress={() => handleCitySelect(c)}
                        style={modal.cityResultItem}
                      >
                        <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={modal.cityResultText}>
                          <Text style={{ fontWeight: '700' }}>{c.n}</Text> ({c.s})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {citySearch.length >= 2 && filteredCities.length === 0 && (
                  <Text style={modal.noResultsText}>Nessun comune trovato</Text>
                )}

                <Text style={[modal.editorLabel, { marginTop: 15 }]}>Via / Indirizzo specifico</Text>
                <TextInput
                  ref={ref => { inputRefs.current['address'] = ref; }}
                  style={modal.inlineTextInput}
                  placeholder="es. Via Garibaldi, 10"
                  placeholderTextColor={COLORS.secondary}
                  value={form.address}
                  onChangeText={(v) => set('address', sanitizeLocationField(v))}
                  maxLength={INPUT_MAX_LENGTH.address}
                  autoCapitalize="words"
                  accessibilityLabel="Via o indirizzo specifico"
                  onFocus={() => handleInputFocus('address')}
                />
              </View>
            )}

            {/* LOCATION TYPE ROW */}
            <SwipeableRow 
              enabled={!!form.location_type}
              onReset={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                set('location_type', '');
              }}
            >
              <Pressable 
                style={[modal.detailItemVertical, activeField !== 'location_type' && modal.detailItemBorder]}
                onPress={() => toggleField('location_type', 300)}
                accessibilityRole="button"
                accessibilityLabel={`Tipo Location, attualmente: ${form.location_type ? form.location_type : 'Non definita'}`}
              >
                <View style={modal.detailTextContainer}>
                  <Text style={modal.detailValue}>
                    {form.location_type 
                      ? (() => { const s = translateLocationType(form.location_type); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); })()
                      : '----'}
                  </Text>
                  <Text style={modal.detailLabel}>Tipo Location</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={activeField === 'location_type' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
                </View>
              </Pressable>
            </SwipeableRow>

            {activeField === 'location_type' && (
              <View style={[modal.editorExpandContainer, modal.expandedSection, modal.detailItemBorder]}>
                <View style={modal.quickChipsRow}>
                  {[
                    { key: 'physical_store', label: 'Negozio fisico' },
                    { key: 'online', label: 'Online' }
                  ].map(item => {
                    const isSel = form.location_type === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => {
                          set('location_type', item.key);
                          setActiveField(null);
                        }}
                        style={[modal.quickChip, isSel && modal.quickChipActive]}
                      >
                        <Text style={[modal.quickChipText, isSel && modal.quickChipTextActive]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* SECTION: PROGRAMMAZIONE */}
          <Text style={modal.sectionTitle}>PROGRAMMAZIONE</Text>
          <View style={modal.card}>
            {/* FREQUENCY ROW */}
            <View style={[modal.detailItemVertical, modal.detailItemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={[modal.detailLabel, { textAlign: 'left', marginBottom: 8 }]}>Frequenza</Text>
                <View style={modal.quickChipsRow}>
                  {FREQUENCIES.map(f => (
                    <Pressable
                      key={f.key}
                      style={[modal.quickChip, form.frequency === f.key && modal.quickChipActive]}
                      onPress={() => set('frequency', f.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Frequenza ${f.label}`}
                    >
                      <Text style={[modal.quickChipText, form.frequency === f.key && modal.quickChipTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* DATE SELECTOR */}
            <View style={{ paddingVertical: 6 }}>
              <PeriodicDateSelector
                frequency={form.frequency}
                recurrenceDay={form.recurrence_day}
                startDate={form.start_date || new Date().toISOString().split('T')[0]}
                onChange={(day, date) => {
                  set('recurrence_day', day);
                  if (date) set('start_date', date);
                }}
                labelStyle={modal.label}
                inputStyle={modal.input}
              />
            </View>
          </View>

          {/* SECTION: TAG AGGIUNTIVI */}
          <Text style={modal.sectionTitle}>TAG AGGIUNTIVI</Text>
          <View style={modal.card}>
            <View style={modal.quickChipsRow}>
              {/* Render dynamic unique tags loaded from DB or default */}
              {availableTags.map((tagStr) => {
                const isSel = (form.tags || []).includes(tagStr);
                return (
                  <Pressable
                    key={tagStr}
                    onPress={() => toggleTagChip(tagStr)}
                    style={[modal.quickChip, isSel && modal.quickChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Tag ${tagStr}, ${isSel ? 'selezionato' : 'non selezionato'}`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[modal.quickChipText, isSel && modal.quickChipTextActive]}>
                        {tagStr.charAt(0).toUpperCase() + tagStr.slice(1)}
                      </Text>
                      {isSel && (
                        <Ionicons name="close-circle" size={14} color="#FFF" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* Render any other custom tags in the array that are not in availableTags yet */}
              {(form.tags || []).map((customTag) => {
                if (availableTags.includes(customTag)) return null;
                return (
                  <Pressable
                    key={customTag}
                    onPress={() => toggleTagChip(customTag)}
                    style={[modal.quickChip, modal.quickChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Tag ${customTag}, selezionato`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[modal.quickChipText, modal.quickChipTextActive]}>
                        {customTag.charAt(0).toUpperCase() + customTag.slice(1)}
                      </Text>
                      <Ionicons name="close-circle" size={14} color="#FFF" style={{ marginLeft: 6 }} />
                    </View>
                  </Pressable>
                );
              })}

              {/* "+ Nuovo" Chip button */}
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowNewTagInput(!showNewTagInput);
                }}
                style={[modal.quickChip, { borderStyle: 'dashed', borderColor: COLORS.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Crea nuovo tag"
              >
                <Text style={[modal.quickChipText, { color: COLORS.primary }]}>
                  + Nuovo
                </Text>
              </Pressable>
            </View>

            {/* Inline tag creator input */}
            {showNewTagInput && (
              <View style={modal.inlineTagInputContainer}>
                <TextInput
                  ref={ref => { inputRefs.current['newTagInput'] = ref; }}
                  style={modal.inlineTagInput}
                  placeholder="Nome tag (es. regalo, vacanza...)"
                  placeholderTextColor={COLORS.secondary}
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  maxLength={INPUT_MAX_LENGTH.tag}
                  autoCapitalize="none"
                  accessibilityLabel="Nome nuovo tag"
                  autoFocus
                  onSubmitEditing={handleAddCustomTag}
                  onFocus={() => handleInputFocus('newTagInput')}
                />
                <Pressable 
                  onPress={handleAddCustomTag}
                  style={modal.addTagButton}
                  accessibilityRole="button"
                  accessibilityLabel="Aggiungi tag"
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                </Pressable>
              </View>
            )}
          </View>
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
  const { showToast } = useToast();

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
      amount: parseFloat(form.amount.replace(/\./g, '').replace(',', '.')),
      direction: form.direction,
      category_key: form.category_key,
      frequency: form.frequency,
      recurrence_day: parseInt(form.recurrence_day) || null,
      start_date: form.start_date,
      is_active: form.is_active !== false,
      description: form.description || null,
      tags: form.tags.length > 0 ? form.tags.join(',') : null,
      location_name: form.location_name || null,
      location_type: form.location_type || null,
      city: form.city || null,
      address: form.address || null,
    });
    setEditTarget(null);
    load(scheduledSortBy);
    showToast({ message: 'Abbonamento salvato con successo', type: 'success' });
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
            if (sub.id) {
              await SubscriptionRepository.delete(sub.id);
              showToast({ message: 'Abbonamento eliminato', type: 'success' });
            }
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
    description: editTarget.description || '',
    tags: editTarget.tags ? editTarget.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    location_name: editTarget.location_name || '',
    location_type: (editTarget.location_type || '') as 'physical_store' | 'online' | '',
    city: editTarget.city || '',
    address: editTarget.address || '',
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
            colors={['#5CB5FF', '#0078FF']}
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: 'rgba(28, 28, 30, 0.25)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  headerSaveBtn: { 
    backgroundColor: 'rgba(28, 28, 30, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSaveText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  headerActionBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 20,
    marginLeft: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  sliderContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sliderBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  sliderBtnOut: { backgroundColor: COLORS.primary },
  sliderBtnIn: { backgroundColor: COLORS.success },
  sliderText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  sliderTextActive: { color: '#FFF' },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  currency: { fontSize: 24, fontWeight: '700', marginRight: 5 },
  amountInput: { fontSize: 44, fontWeight: '800', minWidth: 100, textAlign: 'center' },
  detailItemVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'right',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'left',
  },
  classificationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  classificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  rowTextInput: {
    flex: 1,
    textAlign: 'left',
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily,
    paddingVertical: 4,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickChipText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  quickChipTextActive: {
    color: '#FFF',
  },
  label: {
    fontSize: 10,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'left',
  },
  textInputFadeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginRight: 8,
    maxWidth: '75%',
  },
  rightFadeOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
  },
  expandedSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 10,
  },
  editorExpandContainer: {},
  inlineTextInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'left',
  },
  citySearchContainer: {},
  editorLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  cityInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  cityResultsList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  cityResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityResultText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  inlineTagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
  },
  inlineTagInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.primary,
  },
  addTagButton: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  resetBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 24,
  },
  resetIcon: {
    fontWeight: 'bold',
  },
  noResultsText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
