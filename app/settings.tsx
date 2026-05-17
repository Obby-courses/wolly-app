import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { networkStore } from '../services/networkStore';

export default function SettingsScreen() {
  const router = useRouter();
  
  const [networkState, setNetworkState] = useState(networkStore.getState());
  useEffect(() => {
    const unsub = networkStore.subscribe(() => setNetworkState(networkStore.getState()));
    return () => { unsub(); };
  }, []);


  const handleDeleteAll = () => {
    Alert.alert(
      "Elimina tutte le transazioni",
      "Sei sicuro di voler eliminare DEFINITIVAMENTE tutte le transazioni dal database? Questa azione non è reversibile e resetterà anche il tuo patrimonio.",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Sì, elimina tutto", 
          style: "destructive",
          onPress: async () => {
            try {
              await TransactionRepository.deleteAll();
              Alert.alert("Completato", "Tutte le transazioni sono state eliminate e il patrimonio è stato resettato.");
            } catch (error) {
              console.error(error);
              Alert.alert("Errore", "Impossibile eliminare le transazioni.");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati & Database</Text>
          <Pressable style={styles.item} onPress={() => router.push('/seed-data')}>
            <Ionicons name="server-outline" size={22} color={COLORS.primary} />
            <Text style={styles.itemText}>Gestione Dati & Seed</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
          </Pressable>

          <Pressable style={[styles.item, styles.dangerItem]} onPress={handleDeleteAll}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
            <Text style={[styles.itemText, styles.dangerText]}>Elimina tutte le transazioni</Text>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Finanze</Text>
          <Pressable style={styles.item} onPress={() => router.push('/subscriptions')}>
            <Ionicons name="repeat-outline" size={22} color={COLORS.primary} />
            <Text style={styles.itemText}>Abbonamenti & Ricorrenti</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dev Settings</Text>
          <View style={styles.item}>
            <Ionicons name="cloud-offline-outline" size={22} color={COLORS.primary} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={{ fontSize: TYPOGRAPHY.sizes.base, fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.primary }}>
                Modalità Demo Offline
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.secondary, marginTop: 2 }}>
                Forza l'app in modalità senza rete (disabilita AI)
              </Text>
            </View>
            <Switch
              value={networkState.isDemoOffline}
              onValueChange={(val) => networkStore.setDemoOffline(val)}
              trackColor={{ false: '#D1D5DB', true: COLORS.primary }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 16,
    marginBottom: SPACING.sm,
  },
  itemText: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  dangerItem: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  dangerText: {
    color: '#EF4444',
  }
});
