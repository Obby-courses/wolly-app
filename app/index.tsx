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
  const [thisMonthExpenses, setThisMonthExpenses] = useState<number>(0);
  const [prevMonthExpensesComp, setPrevMonthExpensesComp] = useState<number>(0);
  const [percentageChange, setPercentageChange] = useState<number>(0);
  const [subMonthlyEstimate, setSubMonthlyEstimate] = useState<number>(0);
  const [isNetWorthHidden, setIsNetWorthHidden] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('wolly_nw_hidden').then(val => {
      if (val !== null) setIsNetWorthHidden(val === 'true');
    });
  }, []);

  const toggleNetWorthVisibility = async () => {
    const nextVal = !isNetWorthHidden;
    setIsNetWorthHidden(nextVal);
    await AsyncStorage.setItem('wolly_nw_hidden', String(nextVal));
  };
  
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

      // 1. Spese di questo mese
      const today = new Date();
      const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      const thisMonthSum = await TransactionRepository.getExpensesSumForPeriod(firstDayThisMonth, todayStr);
      setThisMonthExpenses(thisMonthSum);

      // Spese dello stesso periodo del mese precedente
      const firstDayPrevMonthObj = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const sameDayPrevMonthObj = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      
      // Gestiamo l'eventualità in cui il mese precedente avesse meno giorni
      if (sameDayPrevMonthObj.getMonth() !== firstDayPrevMonthObj.getMonth()) {
        sameDayPrevMonthObj.setDate(0);
      }
      
      const firstDayPrevMonth = firstDayPrevMonthObj.toISOString().split('T')[0];
      const sameDayPrevMonth = sameDayPrevMonthObj.toISOString().split('T')[0];
      const prevMonthSum = await TransactionRepository.getExpensesSumForPeriod(firstDayPrevMonth, sameDayPrevMonth);
      setPrevMonthExpensesComp(prevMonthSum);
      
      // Calcolo percentuale
      let pct = 0;
      if (prevMonthSum > 0) {
        pct = ((thisMonthSum - prevMonthSum) / prevMonthSum) * 100;
      } else if (thisMonthSum > 0) {
        pct = 100;
      }
      setPercentageChange(pct);

      // 2. Calcolo totale mensile abbonamenti attivi
      const subTotal = activeSubs.reduce((acc: number, sub: any) => {
        switch (sub.frequency) {
          case 'weekly': return acc + sub.amount * 4.33;
          case 'biweekly': return acc + sub.amount * 2.16;
          case 'monthly': return acc + sub.amount;
          case 'yearly': return acc + sub.amount / 12;
          default: return acc;
        }
      }, 0);
      setSubMonthlyEstimate(subTotal);

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
    <View style={styles.container}>
      {!isDbReady ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
        >
          {/* CARD 1: Patrimonio totale (Senza riquadro/card!) */}
          <View style={styles.netWorthHeaderContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable onPress={toggleNetWorthVisibility} style={styles.privacyButton}>
                <Ionicons 
                  name={isNetWorthHidden ? "eye-off-outline" : "eye-outline"} 
                  size={16} 
                  color={COLORS.secondary} 
                />
              </Pressable>
              <Text style={styles.netWorthLabel}>Patrimonio totale</Text>
            </View>
            <View style={styles.netWorthValueContainer}>
              <Text style={styles.netWorthValue}>
                {isNetWorthHidden ? (
                  <Text style={{ fontSize: 32, letterSpacing: 4 }}>••••••</Text>
                ) : (
                  <>
                    <Text style={styles.netWorthCurrency}>€ </Text>
                    <Text>{integerPart}</Text>
                    <Text style={styles.netWorthCents}>,{centsPart}</Text>
                  </>
                )}
              </Text>
            </View>
          </View>

          {/* CARD 2: Spese di questo mese */}
          <View style={styles.dashboardCard}>
            <Text style={styles.cardLabel}>Spese di questo mese</Text>
            <View style={styles.expensesCompRow}>
              <Text style={styles.expensesValue}>€ {thisMonthExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              
              {/* Percentuale di confronto */}
              {percentageChange !== 0 && (
                <View style={[
                  styles.pctBadge, 
                  percentageChange > 0 ? styles.pctBadgeDanger : styles.pctBadgeSuccess
                ]}>
                  <Ionicons 
                    name={percentageChange > 0 ? "arrow-up" : "arrow-down"} 
                    size={14} 
                    color={percentageChange > 0 ? '#991B1B' : '#065F46'} 
                  />
                  <Text style={[
                    styles.pctBadgeText, 
                    percentageChange > 0 ? { color: '#991B1B' } : { color: '#065F46' }
                  ]}>
                    {Math.abs(percentageChange).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* CARD 3: Spese programmate degli abbonamenti */}
          <View style={styles.dashboardCard}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardLabel}>Spese programmate</Text>
                <Text style={styles.subEstimateValue}>€ {subMonthlyEstimate.toFixed(2)} <Text style={styles.subEstimateLabel}>/ mese stimato</Text></Text>
              </View>
            </View>

            {upcomingSubs.length > 0 && (
              <View style={styles.upcomingListContainer}>
                <Text style={styles.upcomingSubtitle}>Prossime uscite a venire</Text>
                
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

          {/* CARD 4: Ultimi flussi */}
          <View style={[styles.dashboardCard, { marginBottom: 120 }]}>
            <View style={styles.sectionHeaderCompact}>
              <Text style={styles.cardLabel}>Ultimi flussi</Text>
              <Pressable onPress={() => router.push('/history')}>
                <Text style={styles.seeAllText}>Vedi tutto</Text>
              </Pressable>
            </View>

            <View style={styles.transactionsPreview}>
              {transactions.length > 0 ? (
                transactions.slice(0, 5).map((item) => (
                  <TransactionItem key={item.id} item={item} hideCategory={true} />
                ))
              ) : (
                <Text style={styles.emptyTransactionsText}>Nessuna transazione recente</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
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
  dashboardCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  netWorthHeaderContainer: {
    paddingHorizontal: SPACING.lg + 4,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    alignItems: 'flex-start',
  },
  netWorthLabel: {
    color: COLORS.secondary,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  privacyButton: {
    paddingVertical: 2,
    paddingRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    color: COLORS.secondary,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  netWorthValueContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  netWorthValue: {
    color: COLORS.primary,
    fontSize: 48,
    fontFamily: TYPOGRAPHY.fontBold,
    textAlign: 'left',
    letterSpacing: -1,
  },
  netWorthCurrency: {
    fontSize: 28,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  netWorthCents: {
    color: COLORS.secondary,
    fontSize: 36,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  expensesCompRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  expensesValue: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  expensesSubText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    lineHeight: 16,
  },
  pctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  pctBadgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  pctBadgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  pctBadgeText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subEstimateValue: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  subEstimateLabel: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  upcomingListContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  upcomingSubtitle: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  firstUpcomingContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.background,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
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
  sectionHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTransactionsText: {
    color: COLORS.secondary,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
