import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import { analytics, ANALYTICS_SCREENS } from '../../services/analytics';

export default function StatsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.STATS_OVERVIEW);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header Sfumato Blu Premium */}
      <LinearGradient
        colors={['#5CB5FF', '#0078FF']}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Statistiche</Text>
        </View>
        <Text style={styles.subtitle}>Analizza l'andamento del tuo patrimonio</Text>
      </LinearGradient>

      {/* Overlapping Bottom Sheet */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 48 }]}>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Pressable 
            style={styles.card} 
            onPress={() => {
              analytics.trackClick('btn_stats_net_worth_open', ANALYTICS_SCREENS.STATS_OVERVIEW);
              router.push('/stats/net-worth');
            }}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#E6F0FF' }]}>
               <Ionicons name="wallet" size={26} color="#0A74FF" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Saldo</Text>
              <Text style={styles.cardDesc}>Andamento del patrimonio totale nel tempo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </Pressable>

          <Pressable 
            style={styles.card} 
            onPress={() => {
              analytics.trackClick('btn_stats_incomes_open', ANALYTICS_SCREENS.STATS_OVERVIEW);
              router.push('/stats/incomes');
            }}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#E6F4EA' }]}>
               <Ionicons name="trending-up" size={26} color="#34C759" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Entrate</Text>
              <Text style={styles.cardDesc}>Analisi dettagliata delle fonti di guadagno</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </Pressable>

          <Pressable 
            style={styles.card} 
            onPress={() => {
              analytics.trackClick('btn_stats_expenses_open', ANALYTICS_SCREENS.STATS_OVERVIEW);
              router.push('/stats/expenses');
            }}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#FCE8E6' }]}>
               <Ionicons name="trending-down" size={26} color="#FF3B30" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Spesa</Text>
              <Text style={styles.cardDesc}>Analisi dettagliata di tutti i costi e uscite</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </Pressable>

          <Pressable 
            style={styles.card} 
            onPress={() => {
              analytics.trackClick('btn_stats_cashflow_open', ANALYTICS_SCREENS.STATS_OVERVIEW);
              router.push('/stats/cashflow');
            }}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#F3E8FF' }]}>
               <Ionicons name="swap-vertical" size={26} color="#AF52DE" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Flusso di Cassa</Text>
              <Text style={styles.cardDesc}>Confronto diretto tra entrate e uscite</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </Pressable>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 6,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  }
});
