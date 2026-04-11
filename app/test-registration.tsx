import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { startRecording, stopRecording, parseFromVoice } from '../modules/registration/voiceParser';
import { parseFromReceipt } from '../modules/registration/receiptParser';
import { parseFromManual } from '../modules/registration/manualParser';
import { parseExpenseWithAI } from '../services/groqParser';
import { ParsedExpense } from '../modules/registration/types';

export default function TestRegistration() {
  const router = useRouter();
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [result, setResult] = useState<ParsedExpense | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetState = () => {
    setResult(null);
    setErrorMsg('');
  };

  const handleStartRecording = async () => {
    try {
      resetState();
      const rec = await startRecording();
      setRecording(rec);
      setIsRecording(true);
    } catch (error) {
      setErrorMsg('Errore in avvio registrazione: ' + String(error));
      setIsRecording(false);
    }
  };

  const handleStopAndParseVoice = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      setIsLoading(true);
      const uri = await stopRecording(recording);
      setRecording(null);
      const parsed = await parseFromVoice(uri);
      setResult(parsed);
      router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(parsed) } });
    } catch (error) {
      setErrorMsg('Errore parsing vocale: ' + String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceipt = async () => {
    try {
      resetState();
      setIsLoading(true);
      const parsed = await parseFromReceipt(true);
      if (parsed) {
        setResult(parsed);
        router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(parsed) } });
      } else {
        setErrorMsg('Nessuna immagine selezionata o scontrino illeggibile');
      }
    } catch (error) {
      setErrorMsg('Errore parsing scontrino: ' + String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManual = async () => {
    try {
      resetState();
      if (!manualInput) {
        setErrorMsg('Inserisci del testo (es: 15 euro pizza)');
        return;
      }
      setIsLoading(true);
      // Utilizziamo l'AI anche per il manuale se è una stringa unica per estrarre correttamente importo e descrizione
      const parsed = await parseExpenseWithAI(manualInput, 'manual');
      setResult(parsed);
      router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(parsed) } });
    } catch (error) {
      setErrorMsg('Errore parsing manuale: ' + String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Test Moduli Registrazione</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Voce</Text>
          {!isRecording ? (
            <Pressable style={styles.button} onPress={handleStartRecording}>
              <Text style={styles.buttonText}>Inizia registrazione</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={styles.statusText}>In ascolto...</Text>
              <Pressable style={[styles.button, styles.buttonStop]} onPress={handleStopAndParseVoice}>
                <Text style={styles.buttonText}>Ferma e analizza</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Scontrino</Text>
          <Pressable style={styles.button} onPress={handleReceipt}>
            <Text style={styles.buttonText}>Fotografa scontrino</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Manuale</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Cosa hai speso? (es: 10€ kebab)" 
            value={manualInput}
            onChangeText={setManualInput}
            multiline={true}
          />
          <Pressable style={styles.button} onPress={handleManual}>
            <Text style={styles.buttonText}>Analizza</Text>
          </Pressable>
        </View>

        <View style={styles.outputSection}>
          {isLoading && <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          {result && (
            <View style={styles.resultContainer}>
              <Pressable 
                style={[styles.button, { backgroundColor: '#34C759' }]} 
                onPress={() => router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(result) } })}
              >
                <Text style={styles.buttonText}>Vedi Ultimo Dettaglio</Text>
              </Pressable>
              <ScrollView style={styles.jsonBox}>
                <Text style={styles.jsonText}>{JSON.stringify(result, null, 2)}</Text>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fcfcfc' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  section: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  buttonStop: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  statusText: { color: '#FF3B30', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 8 },
  outputSection: { marginTop: 20 },
  errorText: { color: 'red', fontWeight: 'bold', textAlign: 'center' },
  resultContainer: { marginTop: 16 },
  jsonBox: { backgroundColor: '#2d2d2d', padding: 10, borderRadius: 8, maxHeight: 300 },
  jsonText: { color: '#4AF626', fontFamily: 'monospace', fontSize: 12 },
});
