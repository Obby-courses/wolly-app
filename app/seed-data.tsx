import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { prepareDummyForInsert } from '../constants/dummyData';
import DEFAULT_DATA from '../assets/data/default_transactions.json';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function SeedData() {
  const router = useRouter();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    try {
      setIsSeeding(true);
      for (const item of DEFAULT_DATA) {
        const fullExpense = prepareDummyForInsert(item as any);
        await TransactionRepository.insert(fullExpense);
      }
      Alert.alert('Successo', `${DEFAULT_DATA.length} transazioni caricate dal file locale!`, [
        { text: 'Torna alla Home', onPress: () => router.push('/') }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Errore', 'Impossibile caricare i dati fittizi.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      const jsonData = JSON.parse(fileContent);

      if (!Array.isArray(jsonData)) {
        Alert.alert('Errore', 'Il file JSON deve contenere un array di transazioni.');
        return;
      }

      setIsSeeding(true);
      let count = 0;
      for (const item of jsonData) {
        const fullExpense = prepareDummyForInsert(item);
        await TransactionRepository.insert(fullExpense);
        count++;
      }

      Alert.alert('Importazione completata', `Importate con successo ${count} transazioni dal file JSON.`, [
        { text: 'OK', onPress: () => router.push('/') }
      ]);

    } catch (error) {
      console.error(error);
      Alert.alert('Errore', 'Impossibile leggere o elaborare il file JSON. Verifica il formato.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Gestione Dati</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dati Fittizi & Debug</Text>
        <Text style={styles.description}>
          Questa sezione ti permette di popolare il database locale con transazioni di prova per testare l'interfaccia.
        </Text>

        <Pressable 
          style={[styles.seedButton, isSeeding && { opacity: 0.7 }]} 
          onPress={handleSeed}
          disabled={isSeeding}
        >
          {isSeeding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.seedButtonText}>Carica da assets/data/default_transactions.json</Text>
          )}
        </Pressable>

        <Text style={styles.sectionDivider}>Oppure importa il tuo file</Text>

        <Pressable 
          style={[styles.seedButton, { backgroundColor: '#3B82F6' }, isSeeding && { opacity: 0.7 }]} 
          onPress={handleFileUpload}
          disabled={isSeeding}
        >
          {isSeeding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.seedButtonText}>Scegli file JSON dal PC</Text>
          )}
        </Pressable>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Voci disponibili per transazione:</Text>
          <Text style={styles.infoText}>Ecco tutti i campi che puoi configurare per ogni riga:</Text>
          
          <FieldInfo label="amount" desc="Importo numerico (es: 10.50)" />
          <FieldInfo label="description" desc="Nome o dettaglio spesa" />
          <FieldInfo label="category_key" desc="Chiave categoria (es: cibo_bevande)" />
          <FieldInfo label="subcategory_key" desc="Sottocategoria (es: alimentari)" />
          <FieldInfo label="direction" desc="'in' per entrate, 'out' per uscite" />
          <FieldInfo label="date" desc="Stringa ISO (YYYY-MM-DD)" />
          <FieldInfo label="payment_method" desc="Metodo (Contanti, Carta, ecc.)" />
          <FieldInfo label="social_context" desc="solo, amici, coppia, famiglia..." />
          <FieldInfo label="location_type" desc="casa, ristorante, online, ecc." />
          <FieldInfo label="is_recurring_pattern" desc="Boolean (true se frequente/abbonamento)" />
          <FieldInfo label="is_travel" desc="Boolean (true se in viaggio)" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const FieldInfo = ({ label, desc }: { label: string, desc: string }) => (
  <View style={styles.fieldRow}>
    <Text style={styles.fieldLabel}>{label}:</Text>
    <Text style={styles.fieldDesc}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  backButton: { width: 40 },
  backButtonText: { fontSize: 24, color: '#111827' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { flex: 1 },
  content: { padding: 25 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 10 },
  description: { fontSize: 16, color: '#6B7280', marginBottom: 30, lineHeight: 24 },
  seedButton: { 
    backgroundColor: '#111827', 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3
  },
  seedButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionDivider: { 
    textAlign: 'center', 
    color: '#9CA3AF', 
    fontSize: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: 15,
    marginTop: -10
  },
  infoBox: { 
    backgroundColor: '#F9FAFB', 
    padding: 20, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#F3F4F6' 
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 5 },
  infoText: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#374151', fontFamily: 'monospace' },
  fieldDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 }
});
