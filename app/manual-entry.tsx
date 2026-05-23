import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES_CONFIG } from '../constants/categories';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { ParsedExpense, TimeOfDay, SocialContext, LocationType } from '../modules/registration/types';
import { getCurrentLocationContext } from '../services/location';
import { analytics, ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../services/analytics';

export default function ManualEntry() {
  const router = useRouter();
  const { initialText } = useLocalSearchParams<{ initialText?: string }>();

  // State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState(initialText || '');
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [dateTime, setDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Carta');
  const [vendor, setVendor] = useState('');
  
  // Categorization
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(CATEGORIES_CONFIG[0].key);
  const [selectedSubcategoryKey, setSelectedSubcategoryKey] = useState(CATEGORIES_CONFIG[0].subcategories[0].key);

  // Social & Location
  const [socialContext, setSocialContext] = useState<SocialContext>(null);
  const [peopleTags, setPeopleTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Update subcategories when category changes
  useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.MANUAL_ENTRY);
  }, []);

  useEffect(() => {
    const cat = CATEGORIES_CONFIG.find(c => c.key === selectedCategoryKey);
    if (cat && cat.subcategories.length > 0) {
      setSelectedSubcategoryKey(cat.subcategories[0].key);
    }
  }, [selectedCategoryKey]);

  const filteredCategories = CATEGORIES_CONFIG.filter(c => 
    c.direction === 'both' || c.direction === direction
  );

  const currentCategory = CATEGORIES_CONFIG.find(c => c.key === selectedCategoryKey);

  const handleGetLocation = async () => {
    try {
      setIsLocating(true);
      const loc = await getCurrentLocationContext();
      if (loc.city) {
        setCity(loc.city);
        setAddress(loc.address);
      } else {
        Alert.alert('Errore', 'Impossibile rilevare la posizione. Verifica i permessi.');
      }
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setIsLocating(false);
    }
  };

  const addPersonTag = () => {
    if (currentTag.trim() && !peopleTags.includes(currentTag.trim())) {
      setPeopleTags([...peopleTags, currentTag.trim()]);
      setCurrentTag('');
      if (!socialContext) setSocialContext('friends');
    }
  };

  const removePersonTag = (tag: string) => {
    setPeopleTags(peopleTags.filter(t => t !== tag));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(dateTime);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDateTime(newDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(dateTime);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDateTime(newDate);
    }
  };

  const handleSave = () => {
    const parsedVal = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(parsedVal) || parsedVal <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido.');
      return;
    }

    analytics.trackClick(ANALYTICS_BUTTONS.SAVE_TRANSACTION, ANALYTICS_SCREENS.MANUAL_ENTRY, {
      amount: parsedVal,
      category: selectedCategoryKey,
      direction: direction,
      is_manual_entry_advanced: true
    });

    const expense: ParsedExpense = {
      id: uuid.v4() as string,
      created_at: new Date().toISOString(),
      amount: parsedVal,
      net_amount: parsedVal,
      currency: 'EUR',
      payment_method: paymentMethod,
      direction: direction,
      category_key: selectedCategoryKey,
      subcategory_key: selectedSubcategoryKey,
      category_confidence: 1.0,
      date: dateTime.toISOString().split('T')[0],
      time: `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`,
      time_of_day: getTimeOfDay(dateTime.getHours()),
      is_weekend: false,
      day_of_week: getDayOfWeek(dateTime.getDay()),
      social_context: socialContext,
      people_mentioned: peopleTags,
      group_size: peopleTags.length > 0 ? peopleTags.length + 1 : 1,
      is_social: socialContext !== null,
      location_type: direction === 'in' ? 'work' : 'physical_store',
      location_name: vendor || null,
      city: city,
      address: address,
      is_travel: false,
      is_online: false,
      is_recurring_pattern: false,
      refund: null,
      split: null,
      reason: null,
      description: description || vendor || 'Inserimento manuale',
      input_method: 'manual',
      raw_input: `Manuale avanzato: ${amount} ${direction} ${description}`,
      holiday: null,
      tags: [],
      is_deleted: false,
      synced_at: null
    };

    router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(expense) } });
  };

  const getTimeOfDay = (hour: number): TimeOfDay => {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  };

  const getDayOfWeek = (day: number): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[day];
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={28} color={COLORS.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Nuova Voce</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* AMOUNT & DIRECTION */}
          <View style={styles.amountHero}>
            <View style={styles.directionToggle}>
              <Pressable 
                onPress={() => setDirection('out')} 
                style={[styles.dirBtn, direction === 'out' && styles.dirBtnOut]}
              >
                <Text style={[styles.dirText, direction === 'out' && styles.dirTextActive]}>Spesa</Text>
              </Pressable>
              <Pressable 
                onPress={() => setDirection('in')} 
                style={[styles.dirBtn, direction === 'in' && styles.dirBtnIn]}
              >
                <Text style={[styles.dirText, direction === 'in' && styles.dirTextActive]}>Entrata</Text>
              </Pressable>
            </View>
            <View style={styles.amountInputRow}>
              <Text style={[styles.currency, { color: direction === 'in' ? COLORS.success : COLORS.primary }]}>€</Text>
              <TextInput 
                style={[styles.amountInput, { color: direction === 'in' ? COLORS.success : COLORS.primary }]}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9,.]/g, '');
                  setAmount(cleaned);
                }}
                autoFocus
              />
            </View>
          </View>

          {/* VENDOR & DESCRIPTION */}
          <View style={styles.section}>
            <Text style={styles.label}>Cosa e Dove</Text>
            <TextInput 
              style={styles.input}
              placeholder="Venditore / Negozio"
              value={vendor}
              onChangeText={setVendor}
            />
            <TextInput 
              style={[styles.input, { marginTop: 12 }]}
              placeholder="Aggiungi una descrizione..."
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* CATEGORY & SUBCATEGORY */}
          <View style={styles.section}>
            <Text style={styles.label}>Classificazione</Text>
            <View style={styles.pickerBox}>
               <Picker selectedValue={selectedCategoryKey} onValueChange={setSelectedCategoryKey}>
                 {filteredCategories.map(c => <Picker.Item key={c.key} label={c.label} value={c.key} />)}
               </Picker>
            </View>
            <View style={[styles.pickerBox, { marginTop: 12 }]}>
               <Picker selectedValue={selectedSubcategoryKey} onValueChange={setSelectedSubcategoryKey}>
                 {currentCategory?.subcategories.map(s => <Picker.Item key={s.key} label={s.label} value={s.key} />)}
               </Picker>
            </View>
          </View>

          {/* DATE & PAYMENT */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Quando</Text>
              <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.inputText}>{dateTime.toLocaleDateString('it-IT')}</Text>
              </Pressable>
              <Pressable style={[styles.input, { marginTop: 8 }]} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputText}>{dateTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</Text>
              </Pressable>
            </View>
            <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Pagamento</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={paymentMethod} onValueChange={setPaymentMethod}>
                  <Picker.Item label="Carta" value="Carta" />
                  <Picker.Item label="Contanti" value="Contanti" />
                  <Picker.Item label="Digitale" value="Digitale" />
                  <Picker.Item label="Bonifico" value="Bonifico" />
                </Picker>
              </View>
            </View>
          </View>

          {/* LOCATION */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
               <Text style={styles.label}>Posizione</Text>
               <Pressable onPress={handleGetLocation} disabled={isLocating}>
                 {isLocating ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.actionText}>Rileva GPS</Text>}
               </Pressable>
            </View>
            <View style={styles.locationBox}>
              <Ionicons name="location-outline" size={20} color={COLORS.secondary} />
              <Text style={styles.locationText}>
                {city ? `${city}${address ? `, ${address}` : ''}` : 'Nessuna posizione rilevata'}
              </Text>
            </View>
          </View>

          {/* SOCIAL TAGS */}
          <View style={styles.section}>
            <Text style={styles.label}>Con Chi (Social)</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {[
                { key: null, label: 'Nessuno' },
                { key: 'friends', label: 'Amici' },
                { key: 'family', label: 'Famiglia' },
                { key: 'colleagues', label: 'Colleghi' },
                { key: 'couple', label: 'Coppia' },
                { key: 'alone', label: 'Da solo' },
              ].map((opt) => (
                <Pressable
                  key={String(opt.key)}
                  onPress={() => setSocialContext(opt.key as any)}
                  style={[
                    styles.chip,
                    socialContext === opt.key && styles.chipActive,
                    { marginRight: 8 }
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      socialContext === opt.key && styles.chipTextActive
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.tagInputContainer}>
              <TextInput 
                style={styles.tagInput}
                placeholder="Aggiungi persona..."
                value={currentTag}
                onChangeText={setCurrentTag}
                onSubmitEditing={addPersonTag}
              />
              <Pressable onPress={addPersonTag} style={styles.addTagBtn}>
                <Ionicons name="add" size={24} color={COLORS.primary} />
              </Pressable>
            </View>
            <View style={styles.tagsRow}>
              {peopleTags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                  <Pressable onPress={() => removePersonTag(tag)}>
                    <Ionicons name="close-circle" size={16} color={COLORS.secondary} style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {/* SUBMIT */}
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Salva Transazione</Text>
          </Pressable>

        </ScrollView>

        {showDatePicker && <DateTimePicker value={dateTime} mode="date" display="default" onChange={onDateChange} />}
        {showTimePicker && <DateTimePicker value={dateTime} mode="time" display="default" onChange={onTimeChange} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, backgroundColor: COLORS.surface },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: TYPOGRAPHY.sizes.lg, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 100 },
  amountHero: { alignItems: 'center', marginVertical: SPACING.xl },
  directionToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 20 },
  dirBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  dirBtnOut: { backgroundColor: COLORS.primary },
  dirBtnIn: { backgroundColor: COLORS.success },
  dirText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.secondary },
  dirTextActive: { color: '#FFF' },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 40, fontFamily: TYPOGRAPHY.fontBold, marginRight: 8 },
  amountInput: { fontSize: 56, fontFamily: TYPOGRAPHY.fontBold, minWidth: 150, textAlign: 'center' },
  section: { marginBottom: 24 },
  row: { flexDirection: 'row', marginBottom: 8 },
  label: { fontSize: 11, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  actionText: { fontSize: 12, color: COLORS.primary, fontFamily: TYPOGRAPHY.fontBold },
  input: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, fontSize: 16, color: COLORS.primary, ...SHADOWS.soft },
  inputText: { fontSize: 16, color: COLORS.primary },
  pickerBox: { backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden', ...SHADOWS.soft },
  locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 16 },
  locationText: { marginLeft: 8, fontSize: 14, color: COLORS.secondary, flex: 1 },
  tagInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, paddingRight: 12, ...SHADOWS.soft },
  tagInput: { flex: 1, padding: 16, fontSize: 16, color: COLORS.primary },
  addTagBtn: { padding: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  tagChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  tagText: { fontSize: 13, color: COLORS.primary, fontFamily: TYPOGRAPHY.fontBold },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 24, paddingVertical: 20, alignItems: 'center', marginTop: 20, ...SHADOWS.soft },
  saveBtnText: { color: '#FFF', fontSize: 18, fontFamily: TYPOGRAPHY.fontBold },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  chipTextActive: {
    color: '#FFF',
  }
});
