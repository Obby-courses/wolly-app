import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// ... (rest of imports)
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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
  const [searchQuery, setSearchQuery] = useState('');

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
      setTransactions(filteredTrans.slice(0, 4));

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

  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery) return true;
    const desc = t.description?.toLowerCase() || '';
    const cat = t.category_key?.toLowerCase() || '';
    const subcat = t.subcategory_key?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return desc.includes(q) || cat.includes(q) || subcat.includes(q);
  });

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
        <View style={{ flex: 1 }}>
          {/* PARTE SUPERIORE: Sfumatura blu elettrico premium */}
          <LinearGradient
            colors={['#0A74FF', '#0857C3']}
            style={[styles.topSection, { paddingTop: insets.top + 16 }]}
          >
            {/* Patrimonio totale (Sinistra allineato, stile premium) */}
            <View style={styles.netWorthHeaderContainer}>
              <Text style={styles.netWorthLabel}>Patrimonio totale</Text>
              <View style={styles.netWorthValueContainer}>
                <Text style={styles.netWorthValue}>
                  {isNetWorthHidden ? (
                    <Text style={{ fontSize: 36, letterSpacing: 4 }}>••••••</Text>
                  ) : (
                    <>
                      <Text style={styles.netWorthCurrency}>€ </Text>
                      <Text>{integerPart}</Text>
                      <Text style={styles.netWorthCents}>,{centsPart}</Text>
                    </>
                  )}
                </Text>
                <Pressable onPress={toggleNetWorthVisibility} style={styles.eyeButton}>
                  <Ionicons 
                    name={isNetWorthHidden ? "eye-off-sharp" : "eye-sharp"} 
                    size={18} 
                    color="#FFFFFF" 
                  />
                </Pressable>
              </View>
            </View>

            {/* CARD METRICHE ESISTENTI: Affiancate in stile debit/credit card sfumate traslucide */}
            <View style={styles.cardsRow}>
              {/* Card Spese del Mese (Debit Card Style) */}
              <View style={styles.glassCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>SPESE IN MAG 26</Text>
                </View>
                <Text style={styles.cardValueText} numberOfLines={1}>
                  €{thisMonthExpenses.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.cardFooterText} numberOfLines={1}>
                  {percentageChange !== 0 ? (
                    `${percentageChange > 0 ? '+' : '-'}${Math.abs(percentageChange).toFixed(0)}% vs mese prec.`
                  ) : (
                    'Trend stabile'
                  )}
                </Text>
              </View>

              {/* Card Spese Programmate (Credit Card Style) */}
              <View style={[styles.glassCard, { justifyContent: 'flex-start', gap: 6 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>PROSSIME SPESE</Text>
                </View>
                <View style={styles.upcomingList}>
                  {upcomingSubs.length > 0 ? (
                    upcomingSubs.map((sub, idx) => {
                      const dotColor = getCategoryColor(sub.category_key);
                      return (
                        <View key={sub.id || idx} style={styles.upcomingItem}>
                          <View style={[styles.colorDot, { backgroundColor: dotColor }]} />
                          <Text style={styles.upcomingAmount}>
                            €{sub.amount.toFixed(0)}
                          </Text>
                          <Text style={styles.upcomingName} numberOfLines={1}>
                            {sub.name}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noUpcomingText}>Nessuno pianificato</Text>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* PARTE INFERIORE: Overlapping Bottom Sheet in Off-white */}
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 48 + 12 }]}>

            <View style={styles.sectionHeaderCompact}>
              <Text style={styles.sectionTitle}>Ultime spese</Text>
              <Pressable onPress={() => router.push('/stats/expenses')}>
                <Text style={styles.seeAllText}>Vedi tutto</Text>
              </Pressable>
            </View>

            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTransaction}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.emptyTransactionsText}>Nessuna spesa presente</Text>
              }
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSection: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  netWorthHeaderContainer: {
    marginTop: 16,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  netWorthLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  netWorthValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  netWorthValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: -0.5,
  },
  netWorthCurrency: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontBold,
  },
  netWorthCents: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 26,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  eyeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  glassCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
    height: 106,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontBold,
    opacity: 0.85,
    letterSpacing: 0.5,
  },
  cardDetailText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily,
    opacity: 0.5,
  },
  cardValueText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  cardFooterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  upcomingList: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  upcomingName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    flex: 1,
    marginLeft: 6,
  },
  upcomingAmount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  noUpcomingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontStyle: 'italic',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 46,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  sectionHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  seeAllText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0A74FF',
  },
  emptyTransactionsText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
