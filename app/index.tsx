import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';

// ... (rest of imports)
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase } from '../services/database/db';
import { SubscriptionManager } from '../services/database/SubscriptionManager';
import { SubscriptionRepository } from '../services/database/repositories/SubscriptionRepository';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { NetWorthRepository } from '../services/database/repositories/NetWorthRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { getCategory } from '../constants/categories';
import { getCategoryColor } from '../components/CategoryPill';
import AnnualChart from '../components/AnnualChart';
import TransactionItem from '../components/TransactionItem';

function getNextOccurrenceDate(sub: any): Date {
  const today = new Date();
  const result = new Date(today);
  const day = sub.recurrence_day;

  switch (sub.frequency) {
    case 'monthly': {
      if (day != null) {
        result.setDate(day);
        if (result <= today) result.setMonth(result.getMonth() + 1);
      }
      break;
    }
    case 'yearly': {
      const start = new Date(sub.start_date);
      result.setMonth(start.getMonth());
      result.setDate(start.getDate());
      if (result <= today) result.setFullYear(result.getFullYear() + 1);
      break;
    }
    case 'weekly': {
      const targetDow = day ?? 0;
      const currentDow = (today.getDay() + 6) % 7;
      const diff = (targetDow - currentDow + 7) % 7 || 7;
      result.setDate(today.getDate() + diff);
      break;
    }
    case 'biweekly': {
      const targetDow = day ?? 0;
      const currentDow = (today.getDay() + 6) % 7;
      const diff = (targetDow - currentDow + 14) % 14 || 14;
      result.setDate(today.getDate() + diff);
      break;
    }
  }
  return result;
}

export default function Home() {
  const router = useRouter();
  const [isDbReady, setIsDbReady] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [previousChartData, setPreviousChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0 });
  const [netWorth, setNetWorth] = useState<number>(0);
  const [upcomingSubs, setUpcomingSubs] = useState<any[]>([]);
  
  useEffect(() => {
    // Inizializza il DB solo la prima volta
    const setupDB = async () => {
      try {
        await initDatabase();
        await SubscriptionManager.processDueSubscriptions();
        
        
        setIsDbReady(true);
      } catch (error) {
        console.error('[DB] Errore inizializzazione:', error);
      }
    };
    setupDB();
  }, []);

  // Ricarica le transazioni ogni volta che la schermata acquisisce il focus
  useFocusEffect(
    useCallback(() => {
      if (isDbReady) {
        loadData();
      }
    }, [isDbReady])
  );

  const loadData = async () => {
    try {
      const now = new Date();
      
      // Always use 90 days
      const daysToFetch = 90;
      const stats = await TransactionRepository.getDailyStatsForRecentDays(daysToFetch);
      const prevStats = await TransactionRepository.getDailyStatsForRecentDays(daysToFetch, daysToFetch);
      
      // Calcola il trend del patrimonio
      const nwHistory = await NetWorthRepository.getNetWorthHistory(stats, 'daily');
      const prevNwHistory = await NetWorthRepository.getNetWorthHistory(prevStats, 'daily');
      
      const statsWithNw = stats.map((s, i) => ({ ...s, netWorth: nwHistory[i] }));
      const prevStatsWithNw = prevStats.map((s, i) => ({ ...s, netWorth: prevNwHistory[i] }));
      
      setChartData(statsWithNw);
      setPreviousChartData(prevStatsWithNw);
      
      // Calcola sommario per il range (opzionale, ma utile per eventuali altri componenti)
      const totalIncome = stats.reduce((acc, curr) => acc + curr.income, 0);
      const totalExpense = stats.reduce((acc, curr) => acc + curr.expense, 0);
      setSummary({ income: totalIncome, expense: totalExpense });

      // Carica transazioni recenti (senza filtri temporali per la preview)
      const filteredTrans = await TransactionRepository.getFilteredTransactions(
        'Tutto',
        {},
        'date',
        now.toISOString().split('T')[0]
      );
      setTransactions(filteredTrans.slice(0, 5));

      // Load Net Worth
      const currentNw = await NetWorthRepository.getCurrentTotal();
      setNetWorth(currentNw);

      // Load upcoming subscriptions
      const allSubs = await SubscriptionRepository.getAll();
      const activeSubs = allSubs.filter((s: any) => s.is_active);
      const sortedSubs = activeSubs
        .map((s: any) => ({ ...s, nextDate: getNextOccurrenceDate(s) }))
        .sort((a: any, b: any) => a.nextDate.getTime() - b.nextDate.getTime());
      setUpcomingSubs(sortedSubs.slice(0, 3));

    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
    }
  };

  const renderTransaction = ({ item }: { item: any }) => (
    <TransactionItem item={item} />
  );

  const formattedNetWorth = netWorth.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const commaIndex = formattedNetWorth.lastIndexOf(',');
  const integerPart = commaIndex !== -1 ? formattedNetWorth.substring(0, commaIndex) : formattedNetWorth;
  const centsPart = commaIndex !== -1 ? formattedNetWorth.substring(commaIndex + 1) : '00';

  return (
    <SafeAreaView style={styles.container}>
      {!isDbReady ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={[styles.listContent, { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View>
              <View style={styles.netWorthHeaderContainer}>
                <Text style={styles.netWorthLabel}>Patrimonio totale</Text>
                <View style={styles.netWorthValueContainer}>
                  <Text style={styles.netWorthValue}>
                    <Text style={styles.netWorthCurrency}>€ </Text>
                    <Text>{integerPart}</Text>
                    <Text style={styles.netWorthCents}>,{centsPart}</Text>
                  </Text>
                </View>
              </View>

              {/* Grafico temporaneamente nascosto ma mantenuto come componente
              <AnnualChart 
                data={chartData} 
                previousData={previousChartData}
                showNetWorth={true}
                title="Ultimi 90 giorni"
              />
              */}

              {/* Card Prossimi Acquisti Programmati */}
              {upcomingSubs.length > 0 && (
                <View style={styles.upcomingCard}>
                  <Text style={styles.upcomingTitle}>Prossimi acquisti programmati</Text>
                  
                  {/* 1. Il prossimo in grande */}
                  {(() => {
                    const first = upcomingSubs[0];
                    const color = getCategoryColor(first.category_key);
                    const formattedDate = first.nextDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                    return (
                      <View style={styles.firstUpcomingContainer}>
                        <View style={[styles.firstUpcomingAccent, { backgroundColor: color }]} />
                        <View style={styles.firstUpcomingContent}>
                          <Text style={styles.firstUpcomingLabel}>IL PIÙ VICINO</Text>
                          <Text style={styles.firstUpcomingName}>{first.name}</Text>
                          <View style={styles.firstUpcomingMeta}>
                            <Text style={styles.firstUpcomingAmount}>€{first.amount.toFixed(2)}</Text>
                            <Text style={styles.firstUpcomingSep}>·</Text>
                            <Text style={styles.firstUpcomingDate}>{formattedDate}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* 2. I successivi due piccoli */}
                  {upcomingSubs.length > 1 && (
                    <View style={styles.smallUpcomingRow}>
                      {upcomingSubs.slice(1, 3).map((sub: any, idx: number) => {
                        const color = getCategoryColor(sub.category_key);
                        const formattedDate = sub.nextDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                        return (
                          <View key={sub.id || idx} style={styles.smallUpcomingItem}>
                            <View style={[styles.smallUpcomingAccent, { backgroundColor: color }]} />
                            <View style={styles.smallUpcomingContent}>
                              <Text style={styles.smallUpcomingName} numberOfLines={1}>{sub.name}</Text>
                              <Text style={styles.smallUpcomingAmount}>€{sub.amount.toFixed(2)}</Text>
                              <Text style={styles.smallUpcomingDate}>{formattedDate}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={{ marginBottom: 300 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Transazioni Recenti</Text>
                <Pressable onPress={() => router.push('/history')}>
                  <Text style={styles.seeAllText}>Vedi tutto</Text>
                </Pressable>
              </View>

              <View style={styles.transactionsPreview}>
                {transactions.slice(0, 5).map((item) => (
                  <TransactionItem key={item.id} item={item} hideCategory={true} />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  seeAllText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.accent,
  },
  transactionsPreview: {
    paddingHorizontal: SPACING.lg,
  },
  listContent: {
    paddingBottom: 120,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: 20,
    ...SHADOWS.soft,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    padding: 4,
  },
  netWorthHeaderContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    alignItems: 'flex-start',
  },
  netWorthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
    position: 'relative',
  },
  netWorthLabel: {
    color: COLORS.secondary,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  privacyToggle: {
    position: 'absolute',
    right: 0,
    padding: 5,
  },
  netWorthValueContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  netWorthValue: {
    color: COLORS.primary,
    fontSize: 44,
    fontFamily: TYPOGRAPHY.fontBold,
    textAlign: 'left',
  },
  netWorthCurrency: {
    fontSize: 24,
    color: COLORS.primary,
  },
  netWorthCents: {
    color: '#9CA3AF',
    fontSize: 32,
  },
  netWorthEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    width: '100%',
    justifyContent: 'center',
  },
  netWorthCurrencyEdit: {
    color: COLORS.primary,
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontBold,
    marginRight: 10,
  },
  netWorthInput: {
    color: COLORS.primary,
    fontSize: 36,
    fontFamily: TYPOGRAPHY.fontBold,
    padding: 0,
    margin: 0,
    textAlign: 'center',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  filterButtonActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.soft,
  },
  filterButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  filterButtonTextActive: {
    color: COLORS.primary,
  },
  income: {
    color: COLORS.success,
  },
  expense: {
    color: COLORS.primary,
  },
  upcomingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  upcomingTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },
  firstUpcomingContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: SPACING.md,
  },
  firstUpcomingAccent: {
    width: 6,
  },
  firstUpcomingContent: {
    flex: 1,
    padding: SPACING.md,
  },
  firstUpcomingLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.accent,
    letterSpacing: 1,
    marginBottom: 4,
  },
  firstUpcomingName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  firstUpcomingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  firstUpcomingAmount: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  firstUpcomingSep: {
    color: COLORS.secondary,
  },
  firstUpcomingDate: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  smallUpcomingRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  smallUpcomingItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  smallUpcomingAccent: {
    width: 4,
  },
  smallUpcomingContent: {
    flex: 1,
    padding: SPACING.sm,
  },
  smallUpcomingName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  smallUpcomingAmount: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  smallUpcomingDate: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});
