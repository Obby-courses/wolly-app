import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Alert,
  TextInput, Platform, ActivityIndicator, Switch, LayoutAnimation, Keyboard
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
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { COMUNI_ITALIANI, ComuneItem } from '../constants/comuni';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryPill from '../components/CategoryPill';

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
  const { data, id } = useLocalSearchParams<{ data?: string; id?: string }>();
  
  const isEditingExisting = !!id;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editableExpense, setEditableExpense] = useState<ParsedExpense | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSuggestion | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);

  // Accordion active state
  const [activeField, setActiveField] = useState<string | null>(null);
  
  // Ref to ScrollView for centering
  const scrollViewRef = useRef<ScrollView>(null);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // City Search State
  const [citySearch, setCitySearch] = useState('');
  const [amountInputText, setAmountInputText] = useState('');

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
              time: row.time || '12:00',
              time_of_day: row.time_of_day || 'afternoon',
              is_weekend: row.is_weekend === 1,
              day_of_week: row.day_of_week || 'monday',
              social_context: (row.social_context || 'alone') as SocialContext,
              people_mentioned: row.people_mentioned ? row.people_mentioned.split(',') : [],
              group_size: row.group_size ?? null,
              is_social: row.social_context !== 'alone' && !!row.social_context,
              location_type: (row.location_type || 'physical_store') as LocationType,
              location_name: row.location_name || '',
              city: row.city || '',
              address: row.address || '',
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
        
        const merged: ParsedExpense = {
          ...DEFAULT_EXPENSE,
          ...parsed,
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

      setIsSaving(true);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const expenseToSave: ParsedExpense = {
        ...editableExpense,
        date: editableExpense.date || todayStr,
      };

      if (isEditingExisting) {
        // Aggiorna record esistente
        await TransactionRepository.update(id!, expenseToSave);
      } else {
        // Inserisce nuovo record transazione
        expenseToSave.id = editableExpense.id || (require('react-native-uuid').default.v4().toString());
        expenseToSave.created_at = editableExpense.created_at || new Date().toISOString();

        const txId = await TransactionRepository.insert(expenseToSave);

        // Se il toggle abbonamento è attivo, salva anche l'abbonamento e collegalo
        if (isSubscriptionActive && subscription) {
          const today = new Date().toISOString().split('T')[0];
          const subId = await SubscriptionRepository.insert({
            name: subscription.subscription_name || expenseToSave.description || 'Subscription',
            amount: subscription.subscription_amount || expenseToSave.amount,
            currency: expenseToSave.currency,
            direction: expenseToSave.direction as 'in' | 'out',
            category_key: expenseToSave.category_key,
            frequency: subscription.subscription_frequency || 'monthly',
            recurrence_day: subscription.subscription_day ?? new Date().getDate(),
            start_date: today,
            auto_detected: true,
          });
          // Collega la transazione appena creata all'abbonamento
          await TransactionRepository.update(txId, { subscription_id: subId });
        }
      }

      router.back();
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
    updateField('city', comune.n);
    updateField('address', `${comune.r}, Italia`);
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
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>
          {isEditingExisting ? 'Modifica Transazione' : 'Verifica Dati'}
        </Text>
        {isEditingExisting ? (
          <Pressable onPress={handleDelete} disabled={isDeleting} style={styles.deleteHeaderBtn}>
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            )}
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

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
                style={[styles.amountInput, { color: isIncome ? COLORS.success : COLORS.primary }]}
                value={amountInputText}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9,.]/g, '');
                  setAmountInputText(cleaned);
                  const numericVal = parseFloat(cleaned.replace(',', '.')) || 0;
                  updateField('amount', numericVal);
                }}
                keyboardType="decimal-pad"
             />
          </View>

          {/* CLASSIFICATION ROW - single tap opens full picker */}
          <Pressable
            style={[styles.detailItemVertical, styles.detailItemBorder]}
            onPress={() => setShowCategoryPicker(true)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Classificazione</Text>
              <View style={styles.classificationRow}>
                <CategoryPill categoryKey={editableExpense.category_key} />
                {category && <Text style={styles.classificationArrow}>›</Text>}
                {category && (
                  <Text style={styles.categoryInlineText}>{category.label}</Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
          </Pressable>

          <CategoryPickerModal
            visible={showCategoryPicker}
            currentCategoryKey={editableExpense.category_key}
            direction={editableExpense.direction}
            onSelect={(key) => { updateField('category_key', key); updateField('subcategory_key', key); }}
            onClose={() => setShowCategoryPicker(false)}
          />

          {/* DATE ACCORDION */}
          <Pressable 
            style={[styles.detailItemVertical, styles.detailItemBorder]}
            onPress={() => toggleField('date', 110)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Data</Text>
              <Text style={styles.detailValue}>
                {editableExpense.date 
                  ? new Date(editableExpense.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '---'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!!editableExpense.date && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    updateField('date', null);
                    updateField('day_of_week', null);
                    updateField('is_weekend', false);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </Pressable>
              )}
              <Ionicons name={activeField === 'date' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
            </View>
          </Pressable>

          {activeField === 'date' && (
            <View style={styles.calendarContainer}>
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
            </View>
          )}

          {/* TIME ACCORDION - VERTICAL ALARM SCROLL WHEEL */}
          <Pressable 
            style={[styles.detailItemVertical, styles.detailItemBorder]}
            onPress={() => toggleField('time', 150)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Orario</Text>
              <Text style={styles.detailValue}>
                {editableExpense.time || '--:--'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!!editableExpense.time && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    updateField('time', null);
                    updateField('time_of_day', null);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </Pressable>
              )}
              <Ionicons name={activeField === 'time' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
            </View>
          </Pressable>

          {activeField === 'time' && (
            <View style={styles.timePickerContainer}>
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
          <Pressable 
            style={styles.detailItemVertical}
            onPress={() => toggleField('city', 220)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Località</Text>
              <Text style={styles.detailValue}>
                {editableExpense.city 
                  ? `${editableExpense.city}${editableExpense.address ? `, ${editableExpense.address}` : ''}` 
                  : '---'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {(!!editableExpense.city || !!editableExpense.address) && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    updateField('city', '');
                    updateField('address', '');
                    setCitySearch('');
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </Pressable>
              )}
              <Ionicons name={activeField === 'city' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
            </View>
          </Pressable>

          {activeField === 'city' && (
            <View style={styles.citySearchContainer}>
              <Text style={styles.editorLabel}>Città (Comune)</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.cityInput}
                  placeholder="Cerca comune italiano (es. Vimercate, Milano...)"
                  placeholderTextColor={COLORS.secondary}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  autoFocus
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
                        <Text style={{ fontWeight: '700' }}>{c.n}</Text> ({c.s}) · <Text style={{ color: COLORS.secondary, fontSize: 12 }}>{c.r}</Text>
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.editorLabel, { marginTop: 15 }]}>Via / Indirizzo specifico</Text>
              <TextInput
                style={styles.inlineTextInput}
                placeholder="es. Via Garibaldi, 10"
                placeholderTextColor={COLORS.secondary}
                value={editableExpense.address || ''}
                onChangeText={(v) => updateField('address', v)}
              />
            </View>
          )}
        </View>

        {/* SECTION: ABBONAMENTO (Only shown if suggested during new parsing) */}
        {!isEditingExisting && subscription?.suggest_subscription && (
          <>
            <Text style={styles.sectionTitle}>ABBONAMENTO</Text>
            <View style={[styles.card, styles.subscriptionCard]}>
              <View style={styles.subscriptionHeader}>
                <View style={styles.subscriptionIcon}>
                  <Ionicons name="repeat" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subscriptionTitle}>Salva come abbonamento</Text>
                  <Text style={styles.subscriptionSub}>Verrà generato automaticamente ogni {subscription.subscription_frequency === 'monthly' ? 'mese' : subscription.subscription_frequency}</Text>
                </View>
                <Switch
                  value={isSubscriptionActive}
                  onValueChange={setIsSubscriptionActive}
                  trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }}
                  thumbColor={isSubscriptionActive ? '#7C3AED' : '#F9FAFB'}
                />
              </View>
            </View>
          </>
        )}

        {/* SECTION: DETTAGLI */}
        <Text style={styles.sectionTitle}>DETTAGLI</Text>
        <View style={styles.card}>
          
          {/* NOTA E NEGOZIO - CAMPI DI TESTO DIRETTI SENZA ACCORDION */}
          <View style={styles.directInputGroup}>
            <Text style={styles.directInputLabel}>Nota</Text>
            <TextInput
              style={styles.directTextInput}
              placeholder="Inserisci una nota o descrizione"
              placeholderTextColor={COLORS.secondary}
              value={editableExpense.description || editableExpense.reason || ''}
              onChangeText={(v) => updateField('description', v)}
            />
          </View>

          <View style={[styles.directInputGroup, { marginTop: 15 }]}>
            <Text style={styles.directInputLabel}>Negozio</Text>
            <TextInput
              style={styles.directTextInput}
              placeholder="es. Esselunga, Starbucks..."
              placeholderTextColor={COLORS.secondary}
              value={editableExpense.location_name || ''}
              onChangeText={(v) => updateField('location_name', v)}
            />
          </View>

          <View style={{ height: 15 }} />

          {/* PAYMENT METHOD ACCORDION - ONLY CHIPS SELECT, NO TEXT INPUT */}
          <Pressable 
            style={[styles.detailItemVertical, styles.detailItemBorder]}
            onPress={() => toggleField('payment_method', 380)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Metodo Pagamento</Text>
              <Text style={styles.detailValue}>
                {editableExpense.payment_method || 'Non specificato'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!!editableExpense.payment_method && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    updateField('payment_method', null);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </Pressable>
              )}
              <Ionicons name={activeField === 'payment_method' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
            </View>
          </Pressable>

          {activeField === 'payment_method' && (
            <View style={styles.editorExpandContainer}>
              <View style={styles.quickChipsRow}>
                {['Contanti', 'Bancomat', 'Bonifico', 'Altro'].map(m => {
                  const isSel = editableExpense.payment_method === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        updateField('payment_method', m);
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
          <Pressable 
            style={[styles.detailItemVertical, editableExpense.is_social ? styles.detailItemBorder : {}]}
            onPress={() => toggleField('social_context', 440)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Livello Sociale</Text>
              <Text style={styles.detailValue}>
                {translateSocialContext(editableExpense.social_context) || '---'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!!editableExpense.social_context && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    updateField('social_context', null);
                    updateField('is_social', false);
                    updateField('people_mentioned', []);
                    updateField('split', null);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </Pressable>
              )}
              <Ionicons name={activeField === 'social_context' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
            </View>
          </Pressable>

          {activeField === 'social_context' && (
            <View style={styles.editorExpandContainer}>
              <View style={styles.quickChipsRow}>
                {[
                  { key: 'alone', label: 'Solo (Privato)' },
                  { key: 'friends', label: 'Amici' },
                  { key: 'couple', label: 'Coppia' },
                  { key: 'family', label: 'Famiglia' },
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
              <Pressable 
                style={[styles.detailItemVertical, styles.detailItemBorder]}
                onPress={() => toggleField('people_mentioned', 480)}
              >
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Persone con cui viene fatto</Text>
                  <Text style={styles.detailValue}>
                    {editableExpense.people_mentioned.length > 0 
                      ? editableExpense.people_mentioned.join(', ') 
                      : '---'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {editableExpense.people_mentioned.length > 0 && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        updateField('people_mentioned', []);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                    </Pressable>
                  )}
                  <Ionicons name={activeField === 'people_mentioned' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
                </View>
              </Pressable>

              {activeField === 'people_mentioned' && (
                <View style={styles.editorExpandContainer}>
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
                              {personStr.charAt(0).toUpperCase() + personStr.slice(1)}
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
                              {customPerson.charAt(0).toUpperCase() + customPerson.slice(1)}
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
                        style={styles.inlineTagInput}
                        placeholder="Nome (es. Mario, Elena...)"
                        placeholderTextColor={COLORS.secondary}
                        value={newPersonInput}
                        onChangeText={setNewPersonInput}
                        autoFocus
                        onSubmitEditing={handleAddCustomPerson}
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
          <Pressable 
            style={styles.detailItemVertical}
            onPress={() => toggleField('location_type', 500)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Tipo Location</Text>
              <Text style={styles.detailValue}>
                {translateLocationType(editableExpense.location_type) || 'Non specificato'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!!editableExpense.location_type && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    updateField('location_type', null);
                    updateField('is_online', false);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </Pressable>
              )}
              <Ionicons name={activeField === 'location_type' ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.secondary} />
            </View>
          </Pressable>

          {activeField === 'location_type' && (
            <View style={styles.editorExpandContainer}>
              <View style={styles.quickChipsRow}>
                {[
                  { key: 'physical_store', label: 'Negozio Fisico' },
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
                style={styles.inlineTagInput}
                placeholder="Nome nuovo tag (es. regali, auto...)"
                placeholderTextColor={COLORS.secondary}
                value={newTagInput}
                onChangeText={setNewTagInput}
                autoFocus
                onSubmitEditing={handleAddCustomTag}
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

        {/* EXTRA TAGS DECORATORS WITH CLOSE/REMOVE BUTTONS */}
        <View style={styles.tagRow}>
          {editableExpense.is_online && (
            <Pressable 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                updateField('is_online', false);
                updateField('location_type', 'physical_store');
              }}
              style={[styles.tag, { flexDirection: 'row', alignItems: 'center' }]}
            >
              <Text style={styles.tagText}>Online</Text>
              <Ionicons name="close" size={12} color={COLORS.secondary} style={{ marginLeft: 4 }} />
            </Pressable>
          )}
          {editableExpense.is_travel && (
            <Pressable 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                updateField('is_travel', false);
              }}
              style={[styles.tag, { flexDirection: 'row', alignItems: 'center' }]}
            >
              <Text style={styles.tagText}>Viaggio</Text>
              <Ionicons name="close" size={12} color={COLORS.secondary} style={{ marginLeft: 4 }} />
            </Pressable>
          )}
          {editableExpense.is_weekend && (
            <Pressable 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                updateField('is_weekend', false);
              }}
              style={[styles.tag, { flexDirection: 'row', alignItems: 'center' }]}
            >
              <Text style={styles.tagText}>Weekend</Text>
              <Ionicons name="close" size={12} color={COLORS.secondary} style={{ marginLeft: 4 }} />
            </Pressable>
          )}
          {(editableExpense.tags || []).map(t => (
            <Pressable 
              key={t}
              onPress={() => toggleTagChip(t)}
              style={[styles.tag, { flexDirection: 'row', alignItems: 'center' }]}
            >
              <Text style={styles.tagText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              <Ionicons name="close" size={12} color={COLORS.secondary} style={{ marginLeft: 4 }} />
            </Pressable>
          ))}
        </View>

        {!isEditingExisting && (
          <View style={styles.debugSection}>
            <Text style={styles.debugLabel}>METODO: {(editableExpense.input_method || 'manual').toUpperCase()}</Text>
            <Text style={styles.debugText}>"{editableExpense.raw_input}"</Text>
          </View>
        )}
        
      </ScrollView>

      {/* STICKY FOOTER BUTTONS BAR */}
      <View style={styles.footerContainer}>
        <Pressable 
          style={styles.footerBackButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.footerBackButtonText}>Indietro</Text>
        </Pressable>

        <Pressable 
          style={[styles.footerSaveButton, isSaving && { opacity: 0.7 }]} 
          onPress={handleConfirm}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.footerSaveButtonText}>Salva</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const DetailItem = ({ label, value, onPress, isLast }: { label: string, value: string | number | null, onPress?: () => void, isLast?: boolean }) => (
  <Pressable 
    style={[styles.detailItemVertical, !isLast && styles.detailItemBorder]} 
    onPress={onPress} 
    disabled={!onPress}
  >
    <View style={styles.detailTextContainer}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '---'}</Text>
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
  content: { padding: 20, paddingBottom: 130 },
  sectionTitle: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: COLORS.secondary, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 10,
    marginLeft: 5
  },
  card: { 
    backgroundColor: COLORS.surface, 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 10, color: COLORS.secondary, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  detailValue: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
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
  },

  // Accordion Editors Style
  editorExpandContainer: {
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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
  calendarContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
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

  // Vertical Alarm Clock Scroll Wheel Styling
  timePickerContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
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
  citySearchContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
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
});
