import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParsedExpense, TimeOfDay } from '../modules/registration/types';
import { CATEGORIES_CONFIG } from '../constants/categories';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';

export default function ExpenseDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data: string }>();
  const [isSaving, setIsSaving] = useState(false);
  
  if (!params.data) {
    return (
      <View style={styles.errorContainer}>
        <Text>Nessun dato ricevuto</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Indietro</Text>
        </Pressable>
      </View>
    );
  }

  let expense: ParsedExpense;
  try {
    expense = JSON.parse(params.data);
  } catch (e) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: '#F9FAFB' }]}>
        <Text>Errore nel caricamento dei dati</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Indietro</Text>
        </Pressable>
      </View>
    );
  }

  const category = CATEGORIES_CONFIG.find(c => c.key === expense.category_key);
  const subcategory = category?.subcategories.find(s => s.key === expense.subcategory_key);
  const isIncome = expense.direction === 'in';

  const handleConfirm = async () => {
    try {
      setIsSaving(true);
      await TransactionRepository.insert(expense);
      Alert.alert('Successo', 'Transazione salvata nel database locale!', [
        { text: 'OK', onPress: () => router.push('/') }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Errore', 'Impossibile salvare sul database.');
    } finally {
      setIsSaving(false);
    }
  };

  const DetailItem = ({ label, value, icon }: { label: string, value: string | number | null, icon?: string }) => (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '---'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backIcon}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Verifica Storia</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* ECONOMICO & METODO */}
        <View style={[styles.mainCard, isIncome && styles.mainCardIncome]}>
          <Text style={styles.mainLabel}>Importo {isIncome ? 'Ricevuto' : 'Pagato'}</Text>
          <Text style={styles.mainAmount}>{!isIncome ? '- ' : ''}€ {Math.abs(expense.amount || 0).toFixed(2)}</Text>
          
          {expense.payment_method && (
            <View style={styles.insightBox}>
              <Text style={styles.insightText}>💳 Pagato con {expense.payment_method}</Text>
            </View>
          )}
        </View>

        {/* CLASSIFICAZIONE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Categoria & Dettaglio</Text>
          <Text style={styles.categoryText}>{category?.label || expense.category_key}</Text>
          <Text style={styles.subcategoryText}>{subcategory?.label || expense.subcategory_key}</Text>
          {expense.description && (
            <Text style={[styles.reasonText, { marginTop: 15 }]}>"{expense.description}"</Text>
          )}
        </View>

        {/* LAYER SOCIALE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Livello Sociale</Text>
          <View style={styles.row}>
            <DetailItem label="Contesto" value={expense.social_context || 'non noto'} />
            <DetailItem label="Persone" value={expense.is_social ? expense.people_mentioned.join(', ') : 'Solo'} />
          </View>
          {expense.split && (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>Split: {!isIncome ? '- ' : ''}€ {(expense.split.user_share || 0).toFixed(2)} a testa tra {expense.split.total_people} persone</Text>
            </View>
          )}
        </View>

        {/* LAYER SITUAZIONALE & TEMPORALE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scena & Tempo</Text>
          <View style={styles.row}>
            <DetailItem label="Location" value={expense.location_type || 'non noto'} />
            <DetailItem label="Nome" value={expense.location_name} />
          </View>
          <View style={[styles.row, { marginTop: 15 }]}>
            <DetailItem label="Data" value={expense.date} />
            <DetailItem label="Fascia / Ore" value={`${expense.time_of_day || 'non noto'}${expense.time ? ` (${expense.time})` : ''}`} />
          </View>
          <View style={styles.tagRow}>
            {expense.is_online && <View style={styles.tag}><Text style={styles.tagText}>Online</Text></View>}
            {expense.is_travel && <View style={styles.tag}><Text style={styles.tagText}>Viaggio</Text></View>}
            {expense.is_recurring_pattern && <View style={styles.tag}><Text style={styles.tagText}>Abitudine</Text></View>}
            {expense.is_weekend && <View style={styles.tag}><Text style={styles.tagText}>Weekend</Text></View>}
          </View>
        </View>

        {/* NOTE & LUOGO SE EXTRa */}
        {(expense.reason || expense.city) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dettagli Aggiuntivi</Text>
            {expense.reason && <Text style={styles.reasonText}>Nota: "{expense.reason}"</Text>}
            {expense.city && <Text style={styles.locationDetail}>{expense.city}{expense.address ? `, ${expense.address}` : ''}</Text>}
          </View>
        )}

        {expense.input_method === 'receipt' && (
          <View style={[styles.card, styles.rawCard]}>
            <Text style={styles.cardTitle}>Dati Grezzi Scontrino (OCR)</Text>
            <Text style={styles.rawText}>
              {expense.raw_input || 'Nessun testo estratto.'}
            </Text>
          </View>
        )}

        <View style={styles.debugSection}>
          <Text style={styles.debugLabel}>METODO: {(expense.input_method || 'manual').toUpperCase()}</Text>
          {expense.input_method !== 'receipt' && (
             <Text style={styles.debugText}>"{expense.raw_input}"</Text>
          )}
        </View>

        <Pressable 
          style={[styles.confirmButton, isSaving && { opacity: 0.7 }]} 
          onPress={handleConfirm}
          disabled={isSaving}
        >
          <Text style={styles.confirmButtonText}>{isSaving ? 'Salvataggio...' : 'Conferma e Salva'}</Text>
        </Pressable>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  backIcon: { width: 40 },
  backBtnText: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  container: { flex: 1 },
  content: { padding: 20 },
  mainCard: {
    backgroundColor: '#111827',
    borderRadius: 32,
    padding: 30,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10
  },
  mainCardIncome: { backgroundColor: '#065F46' },
  mainLabel: { color: '#9CA3AF', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  mainAmount: { color: '#FFF', fontSize: 52, fontWeight: '800' },
  insightBox: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 16 },
  insightText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardHalf: { width: '48%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowOpacity: 0.02, elevation: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, marginBottom: 16, shadowOpacity: 0.02, elevation: 1 },
  cardTitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  categoryText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subcategoryText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  smallBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  smallBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  alertBox: { marginTop: 15, backgroundColor: '#F3F4F6', padding: 10, borderRadius: 12 },
  alertText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8, marginBottom: 5 },
  tagText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  rawCard: { borderLeftWidth: 4, borderLeftColor: '#6B7280', backgroundColor: '#F9FAFB' },
  rawText: { fontSize: 12, color: '#4B5563', fontFamily: 'monospace', lineHeight: 18 },
  reasonText: { fontSize: 18, color: '#111827', fontWeight: '600', fontStyle: 'italic' },
  locationDetail: { fontSize: 13, color: '#6B7280', marginTop: 5 },
  debugSection: { padding: 15, opacity: 0.4 },
  debugLabel: { fontSize: 9, fontWeight: '900', color: '#9CA3AF', marginBottom: 5 },
  debugText: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  confirmButton: { backgroundColor: '#111827', paddingVertical: 22, borderRadius: 24, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  confirmButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 17 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { marginTop: 20, padding: 10 },
  backButtonText: { color: '#111827', fontWeight: 'bold' }
});
