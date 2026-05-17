import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { getDomainForCategory, getCategory } from '../../constants/categories';
import { translateSocialContext, translateLocationType } from '../../constants/i18n';
import { COLORS } from '../../constants/Theme';
import CategoryPickerModal from '../../components/CategoryPickerModal';

const CATEGORY_COLORS: Record<string, string> = {
  cibo_bevande: '#6366F1', acquisti: '#06B6D4', alloggio: '#8B5CF6',
  trasporti: '#3B82F6', veicolo: '#F59E0B', vita_intrattenimento: '#EC4899',
  comunicazione_pc: '#10B981', spese_finanziarie: '#EF4444',
  investimenti: '#D97706', entrata: '#059669',
};

function getCategoryColor(categoryKey: string): string {
  const domain = getDomainForCategory(categoryKey);
  return domain ? (CATEGORY_COLORS[domain.key] || '#9CA3AF') : '#9CA3AF';
}

export default function TransactionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (id) loadTransaction(id);
  }, [id]);

  const loadTransaction = async (txId: string) => {
    try {
      const data = await TransactionRepository.getById(txId);
      if (data) { setTransaction(data); }
      else { Alert.alert('Errore', 'Transazione non trovata'); router.back(); }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare i dettagli');
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setTransaction((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await TransactionRepository.update(id as string, transaction);
      Alert.alert('Successo', 'Modifiche salvate!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare le modifiche');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Elimina Transazione', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try {
          setIsDeleting(true);
          await TransactionRepository.softDelete(id as string);
          router.back();
        } catch { Alert.alert('Errore', 'Impossibile eliminare'); }
        finally { setIsDeleting(false); }
      }}
    ]);
  };

  const DetailItem = ({ label, value, isLast }: { label: string, value: string | number | null, isLast?: boolean }) => (
    <View style={[styles.detailItemVertical, !isLast && styles.detailItemBorder]}>
      <View style={styles.detailTextContainer}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '---'}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  if (!transaction) return null;

  const domain = getDomainForCategory(transaction.category_key);
  const category = getCategory(transaction.category_key);
  const isIncome = transaction.direction === 'in';
  const catColor = getCategoryColor(transaction.category_key);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Modifica Transazione</Text>
        <Pressable onPress={handleSave} disabled={isSaving}>
           {isSaving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.saveBtnText}>Salva</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* SECTION: GENERALE */}
        <Text style={styles.sectionTitle}>GENERALE</Text>
        <View style={styles.card}>
          {/* Direction slider */}
          <View style={styles.sliderContainer}>
            <Pressable onPress={() => updateField('direction', 'out')} style={[styles.sliderBtn, !isIncome && styles.sliderBtnOut]}>
              <Text style={[styles.sliderText, !isIncome && styles.sliderTextActive]}>Spesa</Text>
            </Pressable>
            <Pressable onPress={() => updateField('direction', 'in')} style={[styles.sliderBtn, isIncome && styles.sliderBtnIn]}>
              <Text style={[styles.sliderText, isIncome && styles.sliderTextActive]}>Entrata</Text>
            </Pressable>
          </View>

          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={[styles.currency, { color: isIncome ? COLORS.success : COLORS.primary }]}>€</Text>
            <TextInput
              style={[styles.amountInput, { color: isIncome ? COLORS.success : COLORS.primary }]}
              value={String(transaction.amount || '')}
              onChangeText={(val) => updateField('amount', parseFloat(val) || 0)}
              keyboardType="numeric"
            />
          </View>

          {/* Single classification row */}
          <Pressable
            style={[styles.detailItemVertical, styles.detailItemBorder]}
            onPress={() => setShowCategoryPicker(true)}
          >
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Classificazione</Text>
              <View style={styles.classificationRow}>
                {domain && (
                  <View style={[styles.domainPill, { backgroundColor: catColor + '20' }]}>
                    <View style={[styles.domainPillDot, { backgroundColor: catColor }]} />
                    <Text style={[styles.domainPillText, { color: catColor }]}>{domain.label}</Text>
                  </View>
                )}
                {category && domain && <Text style={styles.classificationArrow}>›</Text>}
                {category && <Text style={styles.categoryInlineText}>{category.label}</Text>}
                {!domain && !category && <Text style={styles.detailValue}>---</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
          </Pressable>

          <CategoryPickerModal
            visible={showCategoryPicker}
            currentCategoryKey={transaction.category_key}
            direction={isIncome ? 'in' : 'out'}
            onSelect={(key) => { updateField('category_key', key); updateField('subcategory_key', key); }}
            onClose={() => setShowCategoryPicker(false)}
          />

          <DetailItem label="Data" value={transaction.date} />
          <DetailItem label="Orario" value={transaction.time} isLast />
        </View>

        {/* SECTION: DETTAGLI */}
        <Text style={styles.sectionTitle}>DETTAGLI</Text>
        <View style={styles.card}>
          <View style={styles.inputItem}>
            <Text style={styles.detailLabel}>Nota</Text>
            <TextInput
              style={styles.textInput}
              value={transaction.description}
              onChangeText={(val) => updateField('description', val)}
              placeholder="Aggiungi nota..."
              multiline
            />
          </View>
          <View style={[styles.inputItem, { marginTop: 15 }]}>
            <Text style={styles.detailLabel}>Negozio / Venditore</Text>
            <TextInput
              style={styles.textInput}
              value={transaction.location_name}
              onChangeText={(val) => updateField('location_name', val)}
              placeholder="Nome negozio..."
            />
          </View>
          <View style={{ marginTop: 20 }}>
            <DetailItem label="Località" value={transaction.city ? `${transaction.city}${transaction.address ? `, ${transaction.address}` : ''}` : 'Non rilevata'} />
            <DetailItem label="Metodo Pagamento" value={transaction.payment_method} />
            <DetailItem label="Contesto Sociale" value={translateSocialContext(transaction.social_context) || 'Privato'} />
            <DetailItem label="Tipo Location" value={translateLocationType(transaction.location_type)} isLast />
          </View>
        </View>

        <Pressable
          style={[styles.deleteButton, isDeleting && { opacity: 0.7 }]}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <Text style={styles.deleteButtonText}>{isDeleting ? 'Eliminazione...' : 'Elimina Transazione'}</Text>
        </Pressable>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: COLORS.surface,
  },
  backIcon: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  saveBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 16 },
  container: { flex: 1 },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '900', color: COLORS.secondary,
    textTransform: 'uppercase', letterSpacing: 1.5,
    marginBottom: 10, marginTop: 10, marginLeft: 5
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 24, padding: 20, marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 }
    })
  },
  sliderContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 20 },
  sliderBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  sliderBtnOut: { backgroundColor: COLORS.primary },
  sliderBtnIn: { backgroundColor: COLORS.success },
  sliderText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  sliderTextActive: { color: '#FFF' },
  amountContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 25, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  currency: { fontSize: 24, fontWeight: '700', marginRight: 5 },
  amountInput: { fontSize: 44, fontWeight: '800', minWidth: 100, textAlign: 'center' },
  detailItemVertical: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  detailItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 10, color: COLORS.secondary, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  detailValue: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  classificationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  domainPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  domainPillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  domainPillText: { fontSize: 12, fontWeight: '700' },
  classificationArrow: { fontSize: 14, color: COLORS.secondary, marginRight: 6, fontWeight: '300' },
  categoryInlineText: { fontSize: 13, color: COLORS.primary, fontWeight: '500', flexShrink: 1 },
  inputItem: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB', paddingBottom: 10 },
  textInput: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#FEE2E2', paddingVertical: 18, borderRadius: 24, alignItems: 'center',
    marginTop: 10, marginBottom: 40, borderWidth: 1, borderColor: '#FCA5A5'
  },
  deleteButtonText: { color: '#B91C1C', fontWeight: 'bold', fontSize: 16 },
});


