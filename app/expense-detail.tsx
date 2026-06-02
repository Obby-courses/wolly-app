import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Alert,
  TextInput, Platform, ActivityIndicator, Switch, LayoutAnimation, Keyboard, KeyboardAvoidingView,
  PanResponder, Animated, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ParsedExpense, SocialContext, LocationType } from '../modules/registration/types';
import { getDomainForCategory, getCategory } from '../constants/categories';
import { translateSocialContext, translateLocationType } from '../constants/i18n';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { SubscriptionRepository } from '../services/database/repositories/SubscriptionRepository';
import { SubscriptionSuggestion } from '../services/groqParser';
import { supabase } from '../services/supabase';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { analytics, ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../services/analytics';
import { COMUNI_ITALIANI, ComuneItem } from '../constants/comuni';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryPill, { getCategoryColor } from '../components/CategoryPill';
import { LinearGradient } from 'expo-linear-gradient';
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

const capitalizeProperNoun = (val: string | null | undefined): string => {
  if (!val) return '';
  return val.trim().replace(/\b\w/g, c => c.toUpperCase());
};

const DEFAULT_EXPENSE = {
  amount: 0,
  net_amount: 0,
  currency: 'EUR',
  payment_method: null,
  direction: 'out',
  category_key: 'altro_altro',
  subcategory_key: 'altro_altro',
  category_confidence: 1.0,
  date: new Date().toISOString().split('T')[0],
  time: null,
  time_of_day: 'afternoon',
  is_weekend: false,
  day_of_week: null,
  social_context: null,
  people_mentioned: [],
  group_size: null,
  is_social: false,
  location_type: null,
  location_name: '',
  city: '',
  address: '',
  is_travel: false,
  is_online: false,
  refund: null,
  split: null,
  reason: '',
  description: '',
  input_method: 'manual',
  raw_input: '',
  holiday: null,
  tags: [],
  is_deleted: false,
  synced_at: null,
} as unknown as ParsedExpense;

export default function ExpenseDetail() {
  const router = useRouter();
  const { data, id, returnTo } = useLocalSearchParams<{ data?: string; id?: string; returnTo?: string }>();
  
  const isEditingExisting = !!id;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editableExpense, setEditableExpense] = useState<ParsedExpense | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSuggestion | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);

  const [dateMode, setDateMode] = useState<'single' | 'periodic'>('single');
  const [periodicName, setPeriodicName] = useState('');
  const [periodicFrequency, setPeriodicFrequency] = useState<'monthly' | 'weekly' | 'biweekly' | 'yearly'>('monthly');
  const [periodicDay, setPeriodicDay] = useState(String(new Date().getDate()));

  // Accordion active state
  const [activeField, setActiveField] = useState<string | null>(null);

  // Inline text field edit mode: tracks which inline row TextInput is currently editable
  const [focusedInlineField, setFocusedInlineField] = useState<string | null>(null);
  
  // Ref to ScrollView for centering
  const scrollViewRef = useRef<ScrollView>(null);

  // Map of input refs and generic focus handler to center focused text inputs when keyboard active
  const inputRefs = useRef<{[key: string]: any}>({});
  const handleInputFocus = (fieldName: string) => {
    setTimeout(() => {
      const inputRef = inputRefs.current[fieldName];
      if (inputRef && scrollViewRef.current) {
        inputRef.measureLayout(
          scrollViewRef.current,
          (x: number, y: number, w: number, h: number) => {
            // Centra l'input nella visualizzazione, lasciando un margine superiore per la tastiera
            const targetY = Math.max(0, y - 120);
            scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
          },
          (err: any) => console.log('measureLayout error for ' + fieldName, err)
        );
      }
    }, 250); // Attendi l'animazione della tastiera
  };

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // City Search State
  const [citySearch, setCitySearch] = useState('');
  const [amountInputText, setAmountInputText] = useState('');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const expenseDateOnly = editableExpense?.date ? editableExpense.date.split('T')[0] : todayStr;
  const isFuture = expenseDateOnly > todayStr;

  // Custom Tag Creation State
  const [newTagInput, setNewTagInput] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);

  // Dynamic Tags List State
  const [availableTags, setAvailableTags] = useState<string[]>(['lavoro', 'trasferta']);

  // Custom Person Creation State
  const [newPersonInput, setNewPersonInput] = useState('');
  const [showNewPersonInput, setShowNewPersonInput] = useState(false);

  // Dynamic People List State
  const [availablePeople, setAvailablePeople] = useState<string[]>(['mamma', 'papà']);

  const handleBack = () => {
    if (!isEditingExisting && returnTo) {
      router.replace(returnTo as any);
    } else {
      router.back();
    }
  };

  // Fetch distinct tags and people on mount
  useEffect(() => {
    const loadTagsAndPeople = async () => {
      try {
        const dbTags = await TransactionRepository.getDistinctTags();
        const combinedTags = Array.from(new Set(['lavoro', 'trasferta', ...dbTags]))
          .filter(t => t !== 'viaggio' && t.trim() !== '');
        setAvailableTags(combinedTags);

        const dbPeople = await TransactionRepository.getDistinctPeople();
        const combinedPeople = Array.from(new Set(['mamma', 'papà', ...dbPeople]))
          .filter(p => p.trim() !== '');
        setAvailablePeople(combinedPeople);
      } catch (e) {
        console.error('Errore nel caricamento di tag/persone:', e);
      }
    };
    loadTagsAndPeople();
  }, []);

  // Reset calendar to current month when collapsed
  useEffect(() => {
    if (activeField !== 'date') {
      const d = new Date();
      setCalendarDate({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [activeField]);

  useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.EXPENSE_DETAIL);
  }, []);

  // Inizializza lo stato con i dati ricevuti (sia da parsing che da DB esistente)
  useEffect(() => {
    if (id) {
      // MODE: Modifica transazione esistente
      const loadExistingTransaction = async () => {
        try {
          const row = await TransactionRepository.getById(id);
          if (row) {
            const mapped: ParsedExpense = {
              id: row.id,
              created_at: row.created_at,
              amount: row.amount,
              net_amount: row.net_amount ?? row.amount,
              currency: row.currency || 'EUR',
              payment_method: row.payment_method || '',
              direction: row.direction as 'in' | 'out',
              category_key: row.category_key,
              subcategory_key: row.subcategory_key || row.category_key,
              category_confidence: row.category_confidence ?? 1.0,
              date: row.date,
              time: row.time || null,
              time_of_day: row.time_of_day || 'afternoon',
              is_weekend: row.is_weekend === 1,
              day_of_week: row.day_of_week || 'monday',
              social_context: (row.social_context || null) as SocialContext,
              people_mentioned: row.people_mentioned ? row.people_mentioned.split(',') : [],
              group_size: row.group_size ?? null,
              is_social: row.social_context !== 'alone' && !!row.social_context,
              location_type: (row.location_type || null) as LocationType,
              location_name: row.location_name || '',
              city: sanitizeLocationField(row.city || ''),
              address: sanitizeLocationField(row.address || ''),
              is_travel: row.is_travel === 1,
              is_online: row.is_online === 1,
              refund: null,
              split: row.split_people ? {
                total_people: row.split_people,
                user_share: row.amount / row.split_people,
                pending_from: row.people_mentioned ? row.people_mentioned.split(',') : []
              } : null,
              reason: row.description || '',
              description: row.description || '',
              input_method: row.input_method || 'manual',
              raw_input: row.raw_input || '',
              holiday: row.holiday || null,
              tags: row.tags ? row.tags.split(',') : [],
              is_deleted: row.is_deleted === 1,
              synced_at: row.synced_at || null,
            };
            setEditableExpense(mapped);
            
            // Imposta lo stato del calendario in base alla data
            if (row.date) {
              const d = new Date(row.date);
              if (!isNaN(d.getTime())) {
                setCalendarDate({ year: d.getFullYear(), month: d.getMonth() });
              }
            }
          } else {
            Alert.alert('Errore', 'Transazione non trovata nel database.');
            router.back();
          }
        } catch (error) {
          console.error(error);
          Alert.alert('Errore', 'Impossibile caricare la transazione dal database.');
        }
      };
      loadExistingTransaction();
    } else if (data) {
      // MODE: Nuova transazione da parsing
      try {
        const parsed = JSON.parse(data);
        console.log('👀 [Tracking] Dati parsing caricati in Detail:', JSON.stringify(parsed, null, 2));
        
        const merged: ParsedExpense = {
          ...DEFAULT_EXPENSE,
          ...parsed,
          city: sanitizeLocationField(parsed.city),
          address: sanitizeLocationField(parsed.address),
          tags: parsed.tags || [],
          people_mentioned: parsed.people_mentioned || [],
        };

        setEditableExpense(merged);
        
        // Imposta stato calendario in base alla data del parser
        if (parsed.date) {
          const d = new Date(parsed.date);
          if (!isNaN(d.getTime())) {
            setCalendarDate({ year: d.getFullYear(), month: d.getMonth() });
          }
        }

        // Rileva suggerimenti abbonamento
        if (parsed.subscription?.suggest_subscription) {
          setSubscription(parsed.subscription);
          setIsSubscriptionActive(true);
          // Pre-fill periodic mode
          setDateMode('periodic');
          setPeriodicName(parsed.subscription.subscription_name || '');
          setPeriodicFrequency(parsed.subscription.subscription_frequency || 'monthly');
          setPeriodicDay(String(parsed.subscription.subscription_day || new Date().getDate()));
        }
      } catch (e) {
        console.error('Errore parsing dati in ingresso');
      }
    }
  }, [data, id]);

  useEffect(() => {
    if (editableExpense && editableExpense.amount !== undefined) {
      const parsedCurrentLocal = parseFloat(amountInputText.replace(',', '.')) || 0;
      if (parsedCurrentLocal !== editableExpense.amount) {
        setAmountInputText(editableExpense.amount > 0 ? String(editableExpense.amount) : '');
      }
    }
  }, [editableExpense?.amount]);
  
  if (!editableExpense) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.secondary }}>Caricamento dati...</Text>
      </View>
    );
  }

  const domain = getDomainForCategory(editableExpense.category_key);
  const category = getCategory(editableExpense.category_key);
  const isIncome = editableExpense.direction === 'in';

  const updateField = (field: keyof ParsedExpense, value: any) => {
    setEditableExpense(prev => prev ? { ...prev, [field]: value } : null);
  };

  const toggleField = (field: string, yOffset: number) => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (activeField === field) {
      setActiveField(null);
    } else {
      setActiveField(field);
      // Attendiamo l'espansione e centriaamo la visuale
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
      }, 100);
    }
  };

  const handleConfirm = async () => {
    try {
      if (!editableExpense.amount || editableExpense.amount <= 0) {
        Alert.alert('Attenzione', 'L\'importo della transazione è obbligatorio.');
        return;
      }

      // Validazione abbonamento periodico
      if (dateMode === 'periodic' && !periodicName.trim()) {
        Alert.alert('Attenzione', 'Inserisci un nome per la spesa periodica (es. Netflix, Affitto...).');
        return;
      }

      analytics.trackClick(ANALYTICS_BUTTONS.SAVE_TRANSACTION, ANALYTICS_SCREENS.EXPENSE_DETAIL, {
        is_existing: isEditingExisting,
        amount: editableExpense.amount,
        category: editableExpense.category_key,
        direction: editableExpense.direction,
      });

      setIsSaving(true);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const expenseToSave: ParsedExpense = {
        ...editableExpense,
        date: editableExpense.date || todayStr,
        // Se è una spesa periodica e non ha orario, usa 12:00 come default
        time: editableExpense.time || (dateMode === 'periodic' || isSubscriptionActive ? '12:00' : null),
      };

      if (isEditingExisting) {
        // Aggiorna record esistente
        await TransactionRepository.update(id!, expenseToSave);
      } else {
        // Inserisce nuovo record transazione
        expenseToSave.id = editableExpense.id || (require('react-native-uuid').default.v4().toString());
        expenseToSave.created_at = editableExpense.created_at || new Date().toISOString();

        const txId = await TransactionRepository.insert(expenseToSave);

        // Gestione abbonamento: periodic mode o AI-detected
        // Nota: isSubscriptionActive viene resettato quando si torna a 'single', quindi non c'è doppio salvataggio
        let subscription_id: string | null = null;

        if (dateMode === 'periodic') {
          // Clampa il giorno di ricorrenza al range valido
          const isWeekly = periodicFrequency === 'weekly' || periodicFrequency === 'biweekly';
          const rawDay = parseInt(periodicDay);
          const clampedDay = isWeekly
            ? Math.max(0, Math.min(6, isNaN(rawDay) ? 0 : rawDay))
            : Math.max(1, Math.min(28, isNaN(rawDay) ? 1 : rawDay)); // max 28 per sicurezza su tutti i mesi
          const subId = await SubscriptionRepository.insert({
            name: periodicName.trim(),
            amount: expenseToSave.amount,
            currency: 'EUR',
            direction: expenseToSave.direction as 'in' | 'out',
            category_key: expenseToSave.category_key,
            frequency: periodicFrequency,
            recurrence_day: clampedDay,
            start_date: expenseToSave.date,
            auto_detected: false,
          });
          subscription_id = subId;
        } else if (isSubscriptionActive && subscription?.suggest_subscription) {
          const subId = await SubscriptionRepository.insert({
            name: subscription.subscription_name || expenseToSave.description || 'Abbonamento',
            amount: expenseToSave.amount,
            currency: 'EUR',
            direction: expenseToSave.direction as 'in' | 'out',
            category_key: expenseToSave.category_key,
            frequency: subscription.subscription_frequency || 'monthly',
            recurrence_day: subscription.subscription_day || null,
            start_date: expenseToSave.date,
            auto_detected: true,
          });
          subscription_id = subId;
        }

        if (subscription_id) {
          await TransactionRepository.update(txId, { subscription_id });
        }
      }

      if (!isEditingExisting && returnTo) {
        router.replace(returnTo as any);
      } else {
        router.back();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Errore', 'Impossibile salvare sul database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Elimina Transazione', 'Sei sicuro di voler eliminare questa transazione?', [
      { text: 'Annulla', style: 'cancel' },
      { 
        text: 'Elimina', 
        style: 'destructive', 
        onPress: async () => {
          analytics.trackClick(ANALYTICS_BUTTONS.DELETE_TRANSACTION, ANALYTICS_SCREENS.EXPENSE_DETAIL, {
            id: id
          });
          try {
            setIsDeleting(true);
            await TransactionRepository.softDelete(id!);
            router.back();
          } catch {
            Alert.alert('Errore', 'Impossibile eliminare la transazione.');
          } finally {
            setIsDeleting(false);
          }
        } 
      }
    ]);
  };

  // --- CALENDAR HELPERS ---
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
  };

  const handleDaySelect = (day: number) => {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(calendarDate.month + 1).padStart(2, '0');
    const dateStr = `${calendarDate.year}-${monthStr}-${dayStr}`;
    updateField('date', dateStr);

    const d = new Date(calendarDate.year, calendarDate.month, day);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    updateField('day_of_week', daysOfWeek[d.getDay()]);
    updateField('is_weekend', d.getDay() === 0 || d.getDay() === 6);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveField(null);
  };

  const changeMonth = (dir: 'next' | 'prev') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarDate(curr => {
      let m = curr.month + (dir === 'next' ? 1 : -1);
      let y = curr.year;
      if (m > 11) { m = 0; y += 1; }
      if (m < 0) { m = 11; y -= 1; }
      return { year: y, month: m };
    });
  };

  // --- TIME HELPERS ---
  const handleHourSelect = (h: number) => {
    const minutes = editableExpense.time ? editableExpense.time.split(':')[1] : '00';
    const newTime = `${String(h).padStart(2, '0')}:${minutes}`;
    updateField('time', newTime);
    updateTimeOfDay(h);
  };

  const handleMinuteSelect = (m: number) => {
    const hours = editableExpense.time ? editableExpense.time.split(':')[0] : '12';
    const newTime = `${hours}:${String(m).padStart(2, '0')}`;
    updateField('time', newTime);
  };

  const updateTimeOfDay = (hours: number) => {
    let tod: ParsedExpense['time_of_day'] = 'morning';
    if (hours >= 13 && hours < 18) tod = 'afternoon';
    else if (hours >= 18 && hours < 24) tod = 'evening';
    else if (hours >= 0 && hours < 6) tod = 'night';
    updateField('time_of_day', tod);
  };

  // --- CITY HELPERS ---
  const filteredCities = citySearch.length >= 2
    ? COMUNI_ITALIANI.filter(c => c.n.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 6)
    : [];

  const handleCitySelect = (comune: ComuneItem) => {
    updateField('city', sanitizeLocationField(comune.n));
    // Don't append region/country, keep address empty or for street input
    updateField('address', '');
    setCitySearch('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveField(null);
  };

  // --- CUSTOM TAG HELPERS ---
  const handleAddCustomTag = () => {
    const cleanTag = newTagInput.trim().toLowerCase();
    if (cleanTag) {
      const currentTags = editableExpense.tags || [];
      if (!currentTags.includes(cleanTag)) {
        updateField('tags', [...currentTags, cleanTag]);
      }
      setNewTagInput('');
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowNewTagInput(false);
    }
  };

  const toggleTagChip = (tagStr: string) => {
    const currentTags = editableExpense.tags || [];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (currentTags.includes(tagStr)) {
      updateField('tags', currentTags.filter(t => t !== tagStr));
    } else {
      updateField('tags', [...currentTags, tagStr]);
    }
  };

  const togglePersonChip = (personStr: string) => {
    const currentPeople = editableExpense.people_mentioned || [];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (currentPeople.includes(personStr)) {
      updateField('people_mentioned', currentPeople.filter(p => p !== personStr));
    } else {
      updateField('people_mentioned', [...currentPeople, personStr]);
    }
  };

  const handleAddCustomPerson = () => {
    if (!newPersonInput.trim()) return;
    const cleanPerson = newPersonInput.trim().toLowerCase();
    const currentPeople = editableExpense.people_mentioned || [];
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!currentPeople.includes(cleanPerson)) {
      updateField('people_mentioned', [...currentPeople, cleanPerson]);
    }
    
    if (!availablePeople.includes(cleanPerson)) {
      setAvailablePeople([...availablePeople, cleanPerson]);
    }
    
    setNewPersonInput('');
    setShowNewPersonInput(false);
  };

  const MONTHS_IT = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const currentHour = editableExpense.time ? parseInt(editableExpense.time.split(':')[0], 10) : 12;
  const currentMinute = editableExpense.time ? parseInt(editableExpense.time.split(':')[1], 10) : 0;

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backIcon}>
          <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditingExisting ? 'Modifica Transazione' : 'Verifica Dati'}
        </Text>
        <View style={styles.headerRightContainer}>
          {isEditingExisting && (
            <Pressable onPress={handleDelete} disabled={isDeleting || isSaving} style={styles.headerActionBtn}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              )}
            </Pressable>
          )}
          <Pressable onPress={handleConfirm} disabled={isSaving || isDeleting} style={styles.headerSaveBtn}>
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.headerSaveText}>Salva</Text>
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.container} 
          contentContainerStyle={styles.content} 
          showsVerticalScrollIndicator={false}
        >
        
        {/* SECTION: GENERALE */}
        <Text style={styles.sectionTitle}>GENERALE</Text>
        <View style={styles.card}>
          {/* DIRECTION SLIDER */}
          <View style={styles.sliderContainer}>
            <Pressable 
              onPress={() => updateField('direction', 'out')}
              style={[styles.sliderBtn, !isIncome && styles.sliderBtnOut]}
            >
              <Text style={[styles.sliderText, !isIncome && styles.sliderTextActive]}>Spesa</Text>
            </Pressable>
            <Pressable 
              onPress={() => updateField('direction', 'in')}
              style={[styles.sliderBtn, isIncome && styles.sliderBtnIn]}
            >
              <Text style={[styles.sliderText, isIncome && styles.sliderTextActive]}>Entrata</Text>
            </Pressable>
          </View>

          {/* AMOUNT */}
          <View style={styles.amountContainer}>
             <Text style={[styles.currency, { color: isIncome ? COLORS.success : COLORS.primary }]}>€</Text>
             <TextInput 
                ref={ref => inputRefs.current['amount'] = ref}
                style={[styles.amountInput, { color: isIncome ? COLORS.success : COLORS.primary }]}
                value={amountInputText}
                onChangeText={(val) => {
                  // Permette solo cifre e UN singolo separatore decimale (virgola o punto)
                  let cleaned = val.replace(/[^0-9,.]/g, '');
                  // Blocca il secondo separatore: mantieni solo il primo tra virgola e punto
                  const firstComma = cleaned.indexOf(',');
                  const firstDot = cleaned.indexOf('.');
                  if (firstComma !== -1 && firstDot !== -1) {
                    // Se ci sono entrambi, rimuovi il secondo
                    if (firstComma < firstDot) {
                      cleaned = cleaned.replace(/\./g, '');
                    } else {
                      cleaned = cleaned.replace(/,/g, '');
                    }
                  }
                  // Blocca separatori multipli dello stesso tipo
                  cleaned = cleaned.replace(/(,.*),/g, '$1').replace(/(\..*)\./, '$1');
                  setAmountInputText(cleaned);
                  const numericVal = parseFloat(cleaned.replace(',', '.')) || 0;
                  updateField('amount', numericVal);
                }}
                keyboardType="decimal-pad"
                onFocus={() => handleInputFocus('amount')}
             />
          </View>

          {/* CLASSIFICATION ROW - single tap opens full picker */}
          <SwipeableRow 
            enabled={editableExpense.category_key !== 'altro_altro'}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('category_key', 'altro_altro');
              updateField('subcategory_key', 'altro_altro');
            }}
          >
            <Pressable
              style={[styles.detailItemVertical, styles.detailItemBorder]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <View style={styles.detailTextContainer}>
                <View style={styles.classificationRow}>
                  {editableExpense.category_key ? (
                    <>
                      <View style={[styles.classificationDot, { backgroundColor: getCategoryColor(editableExpense.category_key) }]} />
                      <Text style={styles.detailValue}>
                        {category ? (category.label.charAt(0).toUpperCase() + category.label.slice(1).toLowerCase()) : (domain ? (domain.label.charAt(0).toUpperCase() + domain.label.slice(1).toLowerCase()) : 'Altro')}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.detailValue}>----</Text>
                  )}
                </View>
                <Text style={styles.detailLabel}>Classificazione</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
            </Pressable>
          </SwipeableRow>

          <CategoryPickerModal
            visible={showCategoryPicker}
            currentCategoryKey={editableExpense.category_key}
            direction={editableExpense.direction}
            onSelect={(key) => { updateField('category_key', key); updateField('subcategory_key', key); }}
            onClose={() => setShowCategoryPicker(false)}
          />

          {/* DATE ACCORDION */}
          <SwipeableRow 
            enabled={editableExpense.date !== null}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('date', null);
              updateField('day_of_week', null);
              updateField('is_weekend', false);
            }}
          >
            <Pressable 
              style={[styles.detailItemVertical, activeField !== 'date' && styles.detailItemBorder]}
              onPress={() => toggleField('date', 110)}
            >
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailValue}>
                  {editableExpense.date 
                    ? new Date(editableExpense.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Oggi (default)'}
                </Text>
                <Text style={styles.detailLabel}>Data</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {isFuture && dateMode === 'single' && (
                  <View style={styles.scheduledBadge}>
                    <Ionicons name="calendar-outline" size={12} color="#0A74FF" style={{ marginRight: 4 }} />
                    <Text style={styles.scheduledBadgeText}>(programmato)</Text>
                  </View>
                )}
                {dateMode === 'periodic' && (
                  <View style={[styles.scheduledBadge, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                    <Ionicons name="repeat" size={12} color="#16A34A" style={{ marginRight: 4 }} />
                    <Text style={[styles.scheduledBadgeText, { color: '#16A34A' }]}>
                      (periodica · {periodicFrequency === 'monthly' ? 'mensile' : periodicFrequency === 'weekly' ? 'settimanale' : periodicFrequency === 'yearly' ? 'annuale' : 'bisettimanale'})
                    </Text>
                  </View>
                )}
                <Ionicons name={activeField === 'date' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
              </View>
            </Pressable>
          </SwipeableRow>

          {activeField === 'date' && (
            <View style={[styles.calendarContainer, styles.expandedSection, styles.detailItemBorder]}>
              {/* Tab selector: Una tantum / Periodica */}
              <View style={styles.dateModeTabs}>
                <Pressable 
                  style={[styles.dateModeTab, dateMode === 'single' && styles.dateModeTabActive]}
                  onPress={() => {
                    setDateMode('single');
                    // Fix #13: resetta il flag AI-subscription se l'utente torna a Una tantum
                    setIsSubscriptionActive(false);
                  }}
                >
                  <Ionicons name="calendar-outline" size={14} color={dateMode === 'single' ? '#FFFFFF' : COLORS.secondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.dateModeTabText, dateMode === 'single' && styles.dateModeTabTextActive]}>Una tantum</Text>
                </Pressable>
                <Pressable 
                  style={[styles.dateModeTab, dateMode === 'periodic' && styles.dateModeTabActive, dateMode === 'periodic' && { backgroundColor: '#16A34A' }]}
                  onPress={() => setDateMode('periodic')}
                >
                  <Ionicons name="repeat" size={14} color={dateMode === 'periodic' ? '#FFFFFF' : COLORS.secondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.dateModeTabText, dateMode === 'periodic' && styles.dateModeTabTextActive]}>Periodica</Text>
                </Pressable>
              </View>

              {dateMode === 'single' ? (
                <>
                  <View style={styles.calendarHeader}>
                    <Pressable onPress={() => changeMonth('prev')} style={styles.calNavBtn}>
                      <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
                    </Pressable>
                    <Text style={styles.calendarHeaderTitle}>
                      {MONTHS_IT[calendarDate.month]} {calendarDate.year}
                    </Text>
                    <Pressable onPress={() => changeMonth('next')} style={styles.calNavBtn}>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                    </Pressable>
                  </View>
                  
                  <View style={styles.weekdaysRow}>
                    {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                      <Text key={i} style={styles.weekdayText}>{d}</Text>
                    ))}
                  </View>

                  <View style={styles.daysGrid}>
                    {(() => {
                      const days = getDaysInMonth(calendarDate.year, calendarDate.month);
                      const firstDay = getFirstDayOfMonth(calendarDate.year, calendarDate.month);
                      const grid = [];
                      for (let i = 0; i < firstDay; i++) {
                        grid.push(<View key={`empty-${i}`} style={styles.dayCellEmpty} />);
                      }
                      for (let i = 1; i <= days; i++) {
                        const isSelected = editableExpense.date === `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                        grid.push(
                          <Pressable 
                            key={`day-${i}`} 
                            onPress={() => handleDaySelect(i)}
                            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                          >
                            <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                              {i}
                            </Text>
                          </Pressable>
                        );
                      }
                      return grid;
                    })()}
                  </View>
                </>
              ) : (
                <View style={styles.periodicForm}>
                  <Text style={styles.periodicLabel}>Nome abbonamento *</Text>
                  <TextInput
                    ref={ref => inputRefs.current['periodicName'] = ref}
                    style={[styles.periodicInput, !periodicName.trim() && { borderColor: '#FCA5A5', borderWidth: 1 }]}
                    placeholder="es. Netflix, Stipendio, Affitto"
                    placeholderTextColor={COLORS.secondary}
                    value={periodicName}
                    onChangeText={setPeriodicName}
                    onFocus={() => handleInputFocus('periodicName')}
                  />
                  {!periodicName.trim() && (
                    <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Campo obbligatorio</Text>
                  )}

                  <Text style={[styles.periodicLabel, { marginTop: 14 }]}>Frequenza</Text>
                  <View style={styles.periodicChipRow}>
                    {([['weekly', 'Settimanale'], ['biweekly', 'Bisettimanale'], ['monthly', 'Mensile'], ['yearly', 'Annuale']] as const).map(([key, label]) => (
                      <Pressable
                        key={key}
                        style={[styles.periodicChip, periodicFrequency === key && styles.periodicChipActive]}
                        onPress={() => {
                          setPeriodicFrequency(key as any);
                          // Reset giorno al default quando cambia frequenza
                          setPeriodicDay(key === 'weekly' || key === 'biweekly' ? '0' : '1');
                        }}
                      >
                        <Text style={[styles.periodicChipText, periodicFrequency === key && styles.periodicChipTextActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Picker giorno — chip visive invece di TextInput libero */}
                  {(periodicFrequency === 'weekly' || periodicFrequency === 'biweekly') ? (
                    <>
                      <Text style={[styles.periodicLabel, { marginTop: 14 }]}>Giorno della settimana</Text>
                      <View style={[styles.periodicChipRow, { flexWrap: 'wrap' }]}>
                        {(['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const).map((label, idx) => (
                          <Pressable
                            key={idx}
                            style={[styles.periodicChip, periodicDay === String(idx) && styles.periodicChipActive, { minWidth: 44 }]}
                            onPress={() => setPeriodicDay(String(idx))}
                          >
                            <Text style={[styles.periodicChipText, periodicDay === String(idx) && styles.periodicChipTextActive]}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.periodicLabel, { marginTop: 14 }]}>Giorno del mese</Text>
                      <Text style={{ fontSize: 11, color: COLORS.secondary, marginBottom: 8 }}>Limitato al 28° per compatibilità con tutti i mesi</Text>
                      <View style={[styles.periodicChipRow, { flexWrap: 'wrap' }]}>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                          <Pressable
                            key={day}
                            style={[styles.periodicChip, periodicDay === String(day) && styles.periodicChipActive, { minWidth: 36, justifyContent: 'center', alignItems: 'center' }]}
                            onPress={() => setPeriodicDay(String(day))}
                          >
                            <Text style={[styles.periodicChipText, periodicDay === String(day) && styles.periodicChipTextActive]}>{day}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TIME ACCORDION - VERTICAL ALARM SCROLL WHEEL */}
          <SwipeableRow 
            enabled={editableExpense.time !== null}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('time', null);
              updateField('time_of_day', null);
            }}
          >
            <Pressable 
              style={[styles.detailItemVertical, activeField !== 'time' && styles.detailItemBorder]}
              onPress={() => toggleField('time', 150)}
            >
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailValue}>
                  {editableExpense.time || '----'}
                </Text>
                <Text style={styles.detailLabel}>Orario</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={activeField === 'time' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
              </View>
            </Pressable>
          </SwipeableRow>

          {activeField === 'time' && (
            <View style={[styles.timePickerContainer, styles.expandedSection, styles.detailItemBorder]}>
              <View style={styles.wheelHeaders}>
                <Text style={styles.wheelHeaderLabel}>ORE</Text>
                <Text style={styles.wheelHeaderLabel}>MINUTI</Text>
              </View>

              <View style={styles.timePickerWheelContainer}>
                {/* HOURS COLUMN */}
                <ScrollView 
                  style={styles.wheelColumn} 
                  contentContainerStyle={styles.wheelContent}
                  showsVerticalScrollIndicator={false}
                >
                  {hoursArray.map((h) => {
                    const isSelected = currentHour === h;
                    return (
                      <Pressable 
                        key={h} 
                        onPress={() => handleHourSelect(h)} 
                        style={[styles.wheelItem, isSelected && styles.wheelItemSelected]}
                      >
                        <Text style={[styles.wheelItemText, isSelected && styles.wheelItemTextSelected]}>
                          {String(h).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* MINUTES COLUMN */}
                <ScrollView 
                  style={styles.wheelColumn} 
                  contentContainerStyle={styles.wheelContent}
                  showsVerticalScrollIndicator={false}
                >
                  {minutesArray.map((m) => {
                    const isSelected = currentMinute === m;
                    return (
                      <Pressable 
                        key={m} 
                        onPress={() => handleMinuteSelect(m)} 
                        style={[styles.wheelItem, isSelected && styles.wheelItemSelected]}
                      >
                        <Text style={[styles.wheelItemText, isSelected && styles.wheelItemTextSelected]}>
                          {String(m).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* LOCALITY / CITY ACCORDION */}
          <SwipeableRow 
            enabled={!!editableExpense.city || !!editableExpense.address}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('city', '');
              updateField('address', '');
              setCitySearch('');
            }}
          >
            <Pressable 
              style={styles.detailItemVertical}
              onPress={() => toggleField('city', 220)}
            >
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailValue}>
                  {editableExpense.city 
                    ? `${capitalizeProperNoun(editableExpense.city)}${editableExpense.address ? `, ${capitalizeProperNoun(editableExpense.address)}` : ''}` 
                    : '----'}
                </Text>
                <Text style={styles.detailLabel}>Località</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={activeField === 'city' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
              </View>
            </Pressable>
          </SwipeableRow>

          {activeField === 'city' && (
            <View style={[styles.citySearchContainer, styles.expandedSection]}>
              <Text style={styles.editorLabel}>Città (Comune)</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <TextInput
                  ref={ref => inputRefs.current['citySearch'] = ref}
                  style={styles.cityInput}
                  placeholder="Cerca comune italiano (es. Vimercate, Milano...)"
                  placeholderTextColor={COLORS.secondary}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  autoFocus
                  onFocus={() => handleInputFocus('citySearch')}
                />
              </View>

              {filteredCities.length > 0 && (
                <View style={styles.cityResultsList}>
                  {filteredCities.map((c, i) => (
                    <Pressable
                      key={i}
                      onPress={() => handleCitySelect(c)}
                      style={styles.cityResultItem}
                    >
                      <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.cityResultText}>
                        <Text style={{ fontWeight: '700' }}>{c.n}</Text> ({c.s})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.editorLabel, { marginTop: 15 }]}>Via / Indirizzo specifico</Text>
              <TextInput
                ref={ref => inputRefs.current['address'] = ref}
                style={styles.inlineTextInput}
                placeholder="es. Via Garibaldi, 10"
                placeholderTextColor={COLORS.secondary}
                value={editableExpense.address || ''}
                onChangeText={(v) => updateField('address', sanitizeLocationField(v))}
                onFocus={() => handleInputFocus('address')}
              />
            </View>
          )}
        </View>



        {/* SECTION: DETTAGLI */}
        <Text style={styles.sectionTitle}>DETTAGLI</Text>
        <View style={styles.card}>
          
          {/* NOTA E NEGOZIO - CAMPI DI TESTO DIRETTI SULLA RIGA */}
          <SwipeableRow 
            enabled={!!(editableExpense.description || editableExpense.reason)}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('description', '');
              updateField('reason', '');
              setFocusedInlineField(null);
            }}
          >
            <View style={[styles.detailItemVertical, styles.detailItemBorder]}>
              <View style={styles.detailTextContainer}>
                <View style={styles.textInputFadeContainer}>
                  <TextInput
                    ref={ref => inputRefs.current['description'] = ref}
                    style={styles.rowTextInput}
                    placeholder="----"
                    placeholderTextColor={COLORS.primary}
                    value={editableExpense.description || editableExpense.reason || ''}
                    onChangeText={(v) => updateField('description', v)}
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
                    style={styles.rightFadeOverlay}
                    pointerEvents="none"
                  />
                </View>
                <Text style={styles.detailLabel}>Nota</Text>
              </View>
            </View>
          </SwipeableRow>

          <SwipeableRow 
            enabled={!!editableExpense.location_name}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('location_name', '');
              setFocusedInlineField(null);
            }}
          >
            <View style={[styles.detailItemVertical, styles.detailItemBorder]}>
              <View style={styles.detailTextContainer}>
                <View style={styles.textInputFadeContainer}>
                  <TextInput
                    ref={ref => inputRefs.current['location_name'] = ref}
                    style={styles.rowTextInput}
                    placeholder="----"
                    placeholderTextColor={COLORS.primary}
                    value={capitalizeProperNoun(editableExpense.location_name)}
                    onChangeText={(v) => updateField('location_name', capitalizeProperNoun(v))}
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
                    style={styles.rightFadeOverlay}
                    pointerEvents="none"
                  />
                </View>
                <Text style={styles.detailLabel}>Negozio</Text>
              </View>
            </View>
          </SwipeableRow>

          {/* PAYMENT METHOD ACCORDION - ONLY CHIPS SELECT, NO TEXT INPUT */}
          <SwipeableRow 
            enabled={!!editableExpense.payment_method}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('payment_method', null);
            }}
          >
            <Pressable 
              style={[styles.detailItemVertical, activeField !== 'payment_method' && styles.detailItemBorder]}
              onPress={() => toggleField('payment_method', 380)}
            >
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailValue}>
                  {editableExpense.payment_method 
                    ? editableExpense.payment_method.charAt(0).toUpperCase() + editableExpense.payment_method.slice(1).toLowerCase()
                    : '----'}
                </Text>
                <Text style={styles.detailLabel}>Metodo Pagamento</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={activeField === 'payment_method' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
              </View>
            </Pressable>
          </SwipeableRow>

          {activeField === 'payment_method' && (
            <View style={[styles.editorExpandContainer, styles.expandedSection, styles.detailItemBorder]}>
              <View style={styles.quickChipsRow}>
                {['Contanti', 'Bancomat', 'Bonifico', 'Altro'].map(m => {
                  const isSel = (editableExpense.payment_method || '').toLowerCase() === m.toLowerCase();
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        updateField('payment_method', m.toLowerCase());
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setActiveField(null);
                      }}
                      style={[styles.quickChip, isSel && styles.quickChipActive]}
                    >
                      <Text style={[styles.quickChipText, isSel && styles.quickChipTextActive]}>{m}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* SOCIAL CONTEXT ACCORDION */}
          <SwipeableRow 
            enabled={!!editableExpense.social_context}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('social_context', null);
              updateField('is_social', false);
              updateField('people_mentioned', []);
              updateField('split', null);
            }}
          >
            <Pressable 
              style={[styles.detailItemVertical, activeField !== 'social_context' && styles.detailItemBorder]}
              onPress={() => toggleField('social_context', 440)}
            >
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailValue}>
                  {editableExpense.social_context 
                    ? (() => { const s = translateSocialContext(editableExpense.social_context); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); })()
                    : '----'}
                </Text>
                <Text style={styles.detailLabel}>Livello Sociale</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={activeField === 'social_context' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
              </View>
            </Pressable>
          </SwipeableRow>

          {activeField === 'social_context' && (
            <View style={[styles.editorExpandContainer, styles.expandedSection, editableExpense.is_social && styles.detailItemBorder]}>
              <View style={styles.quickChipsRow}>
                {[
                  { key: 'alone', label: 'Da solo' },
                  { key: 'friends', label: 'Amici' },
                  { key: 'couple', label: 'In coppia' },
                  { key: 'family', label: 'In famiglia' },
                  { key: 'colleagues', label: 'Colleghi' }
                ].map(item => {
                  const isSel = editableExpense.social_context === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        updateField('social_context', item.key as SocialContext);
                        updateField('is_social', item.key !== 'alone');
                        setActiveField(null);
                      }}
                      style={[styles.quickChip, isSel && styles.quickChipActive]}
                    >
                      <Text style={[styles.quickChipText, isSel && styles.quickChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* PERSONE ACCORDION - ATTIVO E VISIBILE SOLO SE IL CONTESTO SOCIALE E DIVERSO DA SOLO E NULLO */}
          {editableExpense.social_context && editableExpense.social_context !== 'alone' && (
            <>
              <SwipeableRow 
                enabled={editableExpense.people_mentioned.length > 0}
                onReset={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  updateField('people_mentioned', []);
                }}
              >
                <Pressable 
                  style={[styles.detailItemVertical, activeField !== 'people_mentioned' && styles.detailItemBorder]}
                  onPress={() => toggleField('people_mentioned', 480)}
                >
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailValue}>
                      {editableExpense.people_mentioned.length > 0 
                        ? editableExpense.people_mentioned.map(p => capitalizeProperNoun(p)).join(', ') 
                        : '----'}
                    </Text>
                    <Text style={styles.detailLabel}>Persone con cui viene fatto</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={activeField === 'people_mentioned' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
                  </View>
                </Pressable>
              </SwipeableRow>
 
              {activeField === 'people_mentioned' && (
                <View style={[styles.editorExpandContainer, styles.expandedSection, styles.detailItemBorder]}>
                  <Text style={styles.editorLabel}>Seleziona o aggiungi persone</Text>
                  <View style={styles.quickChipsRow}>
                    {/* Render dynamic unique people loaded from DB or default */}
                    {availablePeople.map((personStr) => {
                      const isSel = (editableExpense.people_mentioned || []).includes(personStr);
                      return (
                        <Pressable
                          key={personStr}
                          onPress={() => togglePersonChip(personStr)}
                          style={[styles.quickChip, isSel && styles.quickChipActive]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.quickChipText, isSel && styles.quickChipTextActive]}>
                              {capitalizeProperNoun(personStr)}
                            </Text>
                            {isSel && (
                              <Ionicons name="close-circle" size={14} color="#FFF" style={{ marginLeft: 6 }} />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
 
                    {/* Render any other custom people in the array that are not in availablePeople yet */}
                    {(editableExpense.people_mentioned || []).map((customPerson) => {
                      if (availablePeople.includes(customPerson)) return null;
                      return (
                        <Pressable
                          key={customPerson}
                          onPress={() => togglePersonChip(customPerson)}
                          style={[styles.quickChip, styles.quickChipActive]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.quickChipText, styles.quickChipTextActive]}>
                              {capitalizeProperNoun(customPerson)}
                            </Text>
                            <Ionicons name="close-circle" size={14} color="#FFF" style={{ marginLeft: 6 }} />
                          </View>
                        </Pressable>
                      );
                    })}

                    {/* "+ Nuova Persona" Chip button */}
                    <Pressable
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setShowNewPersonInput(!showNewPersonInput);
                      }}
                      style={[styles.quickChip, { borderStyle: 'dashed', borderColor: COLORS.primary }]}
                    >
                      <Text style={[styles.quickChipText, { color: COLORS.primary }]}>
                        + Nuova Persona
                      </Text>
                    </Pressable>
                  </View>

                  {/* Inline person creator input */}
                  {showNewPersonInput && (
                    <View style={styles.inlineTagInputContainer}>
                      <TextInput
                        ref={ref => inputRefs.current['newPersonInput'] = ref}
                        style={styles.inlineTagInput}
                        placeholder="Nome (es. Mario, Elena...)"
                        placeholderTextColor={COLORS.secondary}
                        value={newPersonInput}
                        onChangeText={setNewPersonInput}
                        autoFocus
                        onSubmitEditing={handleAddCustomPerson}
                        onFocus={() => handleInputFocus('newPersonInput')}
                      />
                      <Pressable 
                        onPress={handleAddCustomPerson}
                        style={styles.addTagButton}
                      >
                        <Ionicons name="checkmark" size={20} color="#FFF" />
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {editableExpense.split && (
             <DetailItem 
               label="Split" 
               value={`€ ${editableExpense.split.user_share.toFixed(2)} / persona (${editableExpense.split.total_people} persone)`} 
             />
          )}

          {/* LOCATION TYPE ACCORDION - ONLY TWO OPTIONS */}
          <SwipeableRow 
            enabled={!!editableExpense.location_type}
            onReset={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              updateField('location_type', null);
              updateField('is_online', false);
            }}
          >
            <Pressable 
              style={[styles.detailItemVertical, activeField !== 'location_type' && styles.detailItemBorder]}
              onPress={() => toggleField('location_type', 500)}
            >
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailValue}>
                  {editableExpense.location_type 
                    ? (() => { const s = translateLocationType(editableExpense.location_type); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); })()
                    : '----'}
                </Text>
                <Text style={styles.detailLabel}>Tipo Location</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={activeField === 'location_type' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
              </View>
            </Pressable>
          </SwipeableRow>

          {activeField === 'location_type' && (
            <View style={[styles.editorExpandContainer, styles.expandedSection]}>
              <View style={styles.quickChipsRow}>
                {[
                  { key: 'physical_store', label: 'Negozio fisico' },
                  { key: 'online', label: 'Online' }
                ].map(item => {
                  const isSel = editableExpense.location_type === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        updateField('location_type', item.key as LocationType);
                        updateField('is_online', item.key === 'online');
                        setActiveField(null);
                      }}
                      style={[styles.quickChip, isSel && styles.quickChipActive]}
                    >
                      <Text style={[styles.quickChipText, isSel && styles.quickChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

        </View>

        {/* SECTION: TAG AGGIUNTIVI (ALL CHIPS, NO TOGGLES, SUPPORTS CREATING NEW ONES INLINE) */}
        <Text style={styles.sectionTitle}>TAG AGGIUNTIVI</Text>
        <View style={styles.card}>
          <View style={styles.quickChipsRow}>
            {/* Tag Viaggio */}
            <Pressable
              onPress={() => updateField('is_travel', !editableExpense.is_travel)}
              style={[styles.quickChip, editableExpense.is_travel && styles.quickChipActive]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.quickChipText, editableExpense.is_travel && styles.quickChipTextActive]}>
                  Viaggio
                </Text>
                {editableExpense.is_travel && (
                  <Ionicons name="close-circle" size={14} color="#FFF" style={{ marginLeft: 6 }} />
                )}
              </View>
            </Pressable>
 
            {/* Render dynamic unique tags loaded from DB or default */}
            {availableTags.map((tagStr) => {
              const isSel = (editableExpense.tags || []).includes(tagStr);
              return (
                <Pressable
                  key={tagStr}
                  onPress={() => toggleTagChip(tagStr)}
                  style={[styles.quickChip, isSel && styles.quickChipActive]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.quickChipText, isSel && styles.quickChipTextActive]}>
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
            {(editableExpense.tags || []).map((customTag) => {
              if (availableTags.includes(customTag)) return null;
              return (
                <Pressable
                  key={customTag}
                  onPress={() => toggleTagChip(customTag)}
                  style={[styles.quickChip, styles.quickChipActive]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.quickChipText, styles.quickChipTextActive]}>
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
              style={[styles.quickChip, { borderStyle: 'dashed', borderColor: COLORS.primary }]}
            >
              <Text style={[styles.quickChipText, { color: COLORS.primary }]}>
                + Nuovo
              </Text>
            </Pressable>
          </View>

          {/* Inline tag creator input */}
          {showNewTagInput && (
            <View style={styles.inlineTagInputContainer}>
              <TextInput
                ref={ref => inputRefs.current['newTagInput'] = ref}
                style={styles.inlineTagInput}
                placeholder="Nome nuovo tag (es. regali, auto...)"
                placeholderTextColor={COLORS.secondary}
                value={newTagInput}
                onChangeText={setNewTagInput}
                autoFocus
                onSubmitEditing={handleAddCustomTag}
                onFocus={() => handleInputFocus('newTagInput')}
              />
              <Pressable 
                onPress={handleAddCustomTag}
                style={styles.addTagButton}
              >
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </Pressable>
            </View>
          )}
        </View>


        
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
  );
}

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
        // Capture horizontal swipe gestures immediately to bypass children interception (e.g. TextInput)
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
          // Snap back immediately with spring animation and call onReset right away
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
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.resetBackground, { opacity }]}>
        <Ionicons name="refresh-outline" size={20} color="#FFF" style={styles.resetIcon} />
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

const DetailItem = ({ label, value, onPress, isLast }: { label: string, value: string | number | null, onPress?: () => void, isLast?: boolean }) => (
  <Pressable 
    style={[styles.detailItemVertical, !isLast && styles.detailItemBorder]} 
    onPress={onPress} 
    disabled={!onPress}
  >
    <View style={styles.detailTextContainer}>
      <Text style={styles.detailValue}>{value || '----'}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    {onPress && <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />}
  </Pressable>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: COLORS.surface,
  },
  backIcon: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: COLORS.secondary, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 10,
    marginLeft: 0
  },
  card: { 
    backgroundColor: 'transparent', 
    paddingVertical: 16, 
    paddingHorizontal: 0, 
    marginBottom: 20,
  },
  sliderContainer: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.background, 
    borderRadius: 16, 
    padding: 4, 
    marginBottom: 24,
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
    borderBottomColor: COLORS.border
  },
  currency: { fontSize: 24, fontWeight: '700', marginRight: 5 },
  amountInput: { fontSize: 44, fontWeight: '800', minWidth: 100, textAlign: 'center' },
  detailItemVertical: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14
  },
  detailItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
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
  classificationArrow: { fontSize: 14, color: COLORS.secondary, marginRight: 6, fontWeight: '300' },
  categoryInlineText: { fontSize: 13, color: COLORS.primary, fontWeight: '500', flexShrink: 1 },
  
  // Direct Input Styles (Nota & Negozio)
  directInputGroup: {
    width: '100%',
  },
  directInputLabel: {
    fontSize: 10,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  directTextInput: {
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
  rowTextInput: {
    flex: 1,
    textAlign: 'left',
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily,
    paddingVertical: 4,
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
  classificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  // Accordion Editors Style
  expandedSection: {
    backgroundColor: '#F9FAFB',
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

  // Calendar Styling
  calendarContainer: {},
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scheduledBadgeText: {
    color: '#0A74FF',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    padding: 6,
  },
  calendarHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekdayText: {
    width: 32,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  dayCellEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
  },
  dayText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },

  // Date Mode Tabs
  dateModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    gap: 3,
  },
  dateModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  dateModeTabActive: {
    backgroundColor: '#0A74FF',
  },
  dateModeTabText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  dateModeTabTextActive: {
    color: '#FFFFFF',
  },
  periodicForm: {
    paddingTop: 4,
  },
  periodicLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  periodicInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    textAlign: 'left',
  },
  periodicChipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  periodicChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  periodicChipActive: {
    backgroundColor: '#16A34A',
  },
  periodicChipText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  periodicChipTextActive: {
    color: '#FFFFFF',
  },

  // Vertical Alarm Clock Scroll Wheel Styling
  timePickerContainer: {
    alignItems: 'center',
  },
  wheelHeaders: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  wheelHeaderLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: 1,
    width: '50%',
    textAlign: 'center',
  },
  timePickerWheelContainer: {
    flexDirection: 'row',
    height: 160,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
  },
  wheelColumn: {
    flex: 1,
  },
  wheelContent: {
    paddingVertical: 10,
  },
  wheelItem: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  wheelItemSelected: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  wheelItemText: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  wheelItemTextSelected: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // City Search Styling
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

  // Inline Tag Input styling
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

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, paddingHorizontal: 5 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  tagText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  debugSection: { padding: 15, opacity: 0.5, marginBottom: 20 },
  debugLabel: { fontSize: 10, fontWeight: '900', color: COLORS.secondary, marginBottom: 5 },
  debugText: { fontSize: 11, color: COLORS.secondary, fontStyle: 'italic' },
  confirmButton: { backgroundColor: COLORS.primary, paddingVertical: 20, borderRadius: 24, alignItems: 'center', marginBottom: 20 },
  confirmButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 17 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  subscriptionCard: {
    borderColor: '#DDD6FE',
    borderWidth: 1,
    backgroundColor: '#F5F3FF',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  subscriptionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Delete header icon button
  deleteHeaderBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sticky footer buttons styles
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  footerBackButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBackButtonText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 16,
  },
  footerSaveButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  footerSaveButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSaveBtn: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
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
});
