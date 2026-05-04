import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';

export default function StatsHubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Statistiche</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Pressable style={styles.card} onPress={() => router.push('/stats/net-worth')}>
          <View style={styles.cardIcon}>
             <Ionicons name="wallet-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Saldo</Text>
            <Text style={styles.cardDesc}>Andamento del patrimonio totale nel tempo</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.secondary} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/stats/incomes')}>
          <View style={styles.cardIcon}>
             <Ionicons name="trending-up-outline" size={32} color={COLORS.success} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Entrate</Text>
            <Text style={styles.cardDesc}>Analisi dettagliata delle fonti di guadagno</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.secondary} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/stats/expenses')}>
          <View style={styles.cardIcon}>
             <Ionicons name="trending-down-outline" size={32} color={COLORS.danger} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Spesa</Text>
            <Text style={styles.cardDesc}>Analisi dettagliata di tutti i costi e uscite</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.secondary} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/stats/cashflow')}>
          <View style={styles.cardIcon}>
             <Ionicons name="swap-vertical-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Flusso di Cassa</Text>
            <Text style={styles.cardDesc}>Confronto diretto tra entrate e uscite</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.secondary} />
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.xl, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: TYPOGRAPHY.sizes.xxl, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  scrollContent: { padding: SPACING.lg, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 20,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  }
});
