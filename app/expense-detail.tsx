import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, TextInput, Platform, ActivityIndicator, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ParsedExpense } from '../modules/registration/types';
import { getDomainForCategory, getCategory } from '../constants/categories';
import { translateSocialContext, translateLocationType } from '../constants/i18n';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { SubscriptionRepository } from '../services/database/repositories/SubscriptionRepository';
import { SubscriptionSuggestion } from '../services/groqParser';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryPill from '../components/CategoryPill';

export default function ExpenseDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data: string }>();
  const [isSaving, setIsSaving] = useState(false);
  const [editableExpense, setEditableExpense] = useState<ParsedExpense | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSuggestion | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);

  // Inizializza lo stato con i dati ricevuti
  React.useEffect(() => {
    if (params.data) {
      try {
        const parsed = JSON.parse(params.data);
        setEditableExpense(parsed);
        // Check for subscription suggestion from AI
        if (parsed.subscription?.suggest_subscription) {
          setSubscription(parsed.subscription);
          setIsSubscriptionActive(true); // Auto-enable if AI suggests it
        }
      } catch (e) {
        console.error('Errore parsing dati in ingresso');
      }
    }
  }, [params.data]);
  
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

  const handleConfirm = async () => {
    try {
      setIsSaving(true);
      const txId = await TransactionRepository.insert(editableExpense);

      // Se il toggle abbonamento è attivo, salva anche l'abbonamento e collegalo
      if (isSubscriptionActive && subscription) {
        const today = new Date().toISOString().split('T')[0];
        const subId = await SubscriptionRepository.insert({
          name: subscription.subscription_name || editableExpense.description || 'Subscription',
          amount: subscription.subscription_amount || editableExpense.amount,
          currency: editableExpense.currency,
          direction: editableExpense.direction as 'in' | 'out',
          category_key: editableExpense.category_key,
          frequency: subscription.subscription_frequency || 'monthly',
          recurrence_day: subscription.subscription_day ?? new Date().getDate(),
          start_date: today,
          auto_detected: true,
        });
        // Collega la transazione appena creata all'abbonamento
        await TransactionRepository.update(txId, { subscription_id: subId });
      }

      router.push('/');
    } catch (error) {
      console.error(error);
      Alert.alert('Errore', 'Impossibile salvare sul database.');
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="close" size={28} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Verifica Dati</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
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
                value={String(editableExpense.amount || '')}
                onChangeText={(val) => updateField('amount', parseFloat(val) || 0)}
                keyboardType="numeric"
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
          <DetailItem 
            label="Data e Ora" 
            value={`${editableExpense.date} - ${editableExpense.time || '--:--'}`} 
          />
          <DetailItem 
            label="Località" 
            value={editableExpense.city ? `${editableExpense.city}${editableExpense.address ? `, ${editableExpense.address}` : ''}` : 'Non rilevata'} 
            isLast
          />
        </View>

        {/* SECTION: ABBONAMENTO (If AI suggests it) */}
        {subscription?.suggest_subscription && (
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
          <DetailItem 
            label="Nota" 
            value={editableExpense.description || editableExpense.reason} 
          />
          <DetailItem 
            label="Negozio" 
            value={editableExpense.location_name} 
          />
          <DetailItem 
            label="Metodo Pagamento" 
            value={editableExpense.payment_method} 
          />
          <DetailItem 
            label="Livello Sociale" 
            value={translateSocialContext(editableExpense.social_context) || 'Privato'} 
          />
          {editableExpense.is_social && (
            <DetailItem 
              label="Persone" 
              value={editableExpense.people_mentioned.join(', ')} 
            />
          )}
          {editableExpense.split && (
             <DetailItem 
               label="Split" 
               value={`€ ${editableExpense.split.user_share.toFixed(2)} / persona (${editableExpense.split.total_people} persone)`} 
             />
          )}
          <DetailItem 
            label="Tipo Location" 
            value={translateLocationType(editableExpense.location_type)} 
            isLast
          />
        </View>

        {/* EXTRA TAGS */}
        <View style={styles.tagRow}>
          {editableExpense.is_online && <View style={styles.tag}><Text style={styles.tagText}>Online</Text></View>}
          {editableExpense.is_travel && <View style={styles.tag}><Text style={styles.tagText}>Viaggio</Text></View>}
          {editableExpense.is_weekend && <View style={styles.tag}><Text style={styles.tagText}>Weekend</Text></View>}
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.debugLabel}>METODO: {(editableExpense.input_method || 'manual').toUpperCase()}</Text>
          <Text style={styles.debugText}>"{editableExpense.raw_input}"</Text>
        </View>

        <Pressable 
          style={[styles.confirmButton, isSaving && { opacity: 0.7 }]} 
          onPress={handleConfirm}
          disabled={isSaving}
        >
          <Text style={styles.confirmButtonText}>
            {isSaving ? 'Salvataggio...' : 'Conferma e Salva'}
          </Text>
        </Pressable>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  cibo_bevande: '#6366F1', acquisti: '#06B6D4', alloggio: '#8B5CF6',
  trasporti: '#3B82F6', veicolo: '#F59E0B', vita_intrattenimento: '#EC4899',
  comunicazione_pc: '#10B981', spese_finanziarie: '#EF4444',
  investimenti: '#D97706', entrata: '#059669',
};

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
  content: { padding: 20 },
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
    padding: 20, 
    marginBottom: 20,
    ...SHADOWS.soft,
  },
  sliderContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F3F4F6', 
    borderRadius: 14, 
    padding: 4, 
    marginBottom: 20 
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
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  currency: { fontSize: 24, fontWeight: '700', marginRight: 5 },
  amountInput: { fontSize: 44, fontWeight: '800', minWidth: 100, textAlign: 'center' },
  detailItemVertical: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12 
  },
  detailItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB'
  },
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 10, color: COLORS.secondary, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  detailValue: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  classificationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  classificationArrow: { fontSize: 14, color: COLORS.secondary, marginRight: 6, fontWeight: '300' },
  categoryInlineText: { fontSize: 13, color: COLORS.primary, fontWeight: '500', flexShrink: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, paddingHorizontal: 5 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  tagText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  debugSection: { padding: 15, opacity: 0.5, marginBottom: 20 },
  debugLabel: { fontSize: 10, fontWeight: '900', color: COLORS.secondary, marginBottom: 5 },
  debugText: { fontSize: 11, color: COLORS.secondary, fontStyle: 'italic' },
  confirmButton: { backgroundColor: COLORS.primary, paddingVertical: 20, borderRadius: 24, alignItems: 'center', marginBottom: 40 },
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
});

