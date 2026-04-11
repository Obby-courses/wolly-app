import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { CATEGORIES_CONFIG } from '../../constants/categories';

export default function TransactionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadTransaction(id);
    }
  }, [id]);

  const loadTransaction = async (txId: string) => {
    try {
      const data = await TransactionRepository.getById(txId);
      if (data) {
        setTransaction(data);
      } else {
        Alert.alert('Errore', 'Transazione non trovata');
        router.back();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli della transazione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Elimina Transazione',
      'Sei sicuro di voler eliminare questa transazione?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await TransactionRepository.softDelete(id as string);
              router.back();
            } catch (error) {
              console.error(error);
              Alert.alert('Errore', 'Impossibile eliminare la transazione');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!transaction) return null;

  const category = CATEGORIES_CONFIG.find(c => c.key === transaction.category_key);
  const subcategory = category?.subcategories.find(s => s.key === transaction.subcategory_key);
  const isIncome = transaction.direction === 'in';

  const DetailItem = ({ label, value }: { label: string, value: string | number | null }) => (
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
        <Text style={styles.headerTitle}>Dettaglio Transazione</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* ECONOMICO & METODO */}
        <View style={[styles.mainCard, isIncome && styles.mainCardIncome]}>
          <Text style={styles.mainLabel}>Importo {isIncome ? 'Ricevuto' : 'Pagato'}</Text>
          <Text style={styles.mainAmount}>{!isIncome ? '- ' : ''}€ {Math.abs(transaction.amount || 0).toFixed(2)}</Text>
          
          {transaction.payment_method && (
            <View style={styles.insightBox}>
              <Text style={styles.insightText}>💳 {transaction.payment_method}</Text>
            </View>
          )}
        </View>

        {/* CLASSIFICAZIONE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Categoria & Dettaglio</Text>
          <Text style={styles.categoryText}>{category?.label || transaction.category_key}</Text>
          <Text style={styles.subcategoryText}>{subcategory?.label || transaction.subcategory_key}</Text>
          {transaction.description && (
            <Text style={[styles.reasonText, { marginTop: 15 }]}>"{transaction.description}"</Text>
          )}
        </View>

        {/* LAYER SOCIALE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informazioni Sociali</Text>
          <View style={styles.row}>
            <DetailItem label="Contesto" value={transaction.social_context || 'Privato'} />
            <DetailItem label="Persone" value={transaction.split_people ? `${transaction.split_people} persone` : 'Solo'} />
          </View>
        </View>

        {/* LAYER SITUAZIONALE & TEMPORALE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tempo & Luogo</Text>
          <View style={styles.row}>
            <DetailItem label="Location" value={transaction.location_type || '---'} />
            <DetailItem label="Nome" value={transaction.location_name} />
          </View>
          <View style={[styles.row, { marginTop: 15 }]}>
            <DetailItem label="Data" value={transaction.date} />
            <DetailItem label="Orario" value={transaction.time || '---'} />
          </View>
          <View style={styles.tagRow}>
            {transaction.is_online === 1 && <View style={styles.tag}><Text style={styles.tagText}>Online</Text></View>}
            {transaction.is_travel === 1 && <View style={styles.tag}><Text style={styles.tagText}>Viaggio</Text></View>}
          </View>
        </View>

        {transaction.city && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Località</Text>
            <Text style={styles.locationDetail}>{transaction.city}</Text>
          </View>
        )}

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
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, marginBottom: 16, shadowOpacity: 0.02, elevation: 1 },
  cardTitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  categoryText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subcategoryText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8, marginBottom: 5 },
  tagText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  reasonText: { fontSize: 18, color: '#111827', fontWeight: '600', fontStyle: 'italic' },
  locationDetail: { fontSize: 13, color: '#6B7280', marginTop: 5 },
  deleteButton: { 
    backgroundColor: '#FEE2E2', 
    paddingVertical: 18, 
    borderRadius: 24, 
    alignItems: 'center', 
    marginTop: 10, 
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  deleteButtonText: { color: '#B91C1C', fontWeight: 'bold', fontSize: 16 },
});
