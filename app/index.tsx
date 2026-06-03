import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, FlatList, Dimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';

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
import TransactionPreview from '../components/TransactionPreview';

function getNextOccurrenceDate(sub: any): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = sub.recurrence_day;

  // Helper: effective day clamped to month length
  const clampDay = (desiredDay: number, year: number, month: number) =>
    Math.min(desiredDay, new Date(year, month + 1, 0).getDate());

  switch (sub.frequency) {
    case 'monthly': {
      if (day != null) {
        let year = today.getFullYear();
        let month = today.getMonth();
        let candidate = new Date(year, month, clampDay(day, year, month));
        if (candidate <= today) {
          month++;
          if (month > 11) { month = 0; year++; }
          candidate = new Date(year, month, clampDay(day, year, month));
        }
        return candidate;
      }
      break;
    }
    case 'yearly': {
      const start = new Date(sub.start_date);
      const startMonth = start.getMonth();
      const startDay = start.getDate();
      let year = today.getFullYear();
      let candidate = new Date(year, startMonth, clampDay(startDay, year, startMonth));
      if (candidate <= today) {
        year++;
        candidate = new Date(year, startMonth, clampDay(startDay, year, startMonth));
      }
      return candidate;
    }
    case 'weekly': {
      if (day == null) break;
      const currentDow = (today.getDay() + 6) % 7;
      let diff = 7;
      for (let i = 1; i <= 7; i++) {
        const d = (currentDow + i) % 7;
        if ((day & (1 << d)) !== 0) {
          diff = i;
          break;
        }
      }
      const result = new Date(today);
      result.setDate(today.getDate() + diff);
      return result;
    }
    case 'biweekly': {
      if (day == null) break;
      let diff = 14;
      for (let i = 1; i <= 14; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        
        const fDow = (futureDate.getDay() + 6) % 7;
        if ((day & (1 << fDow)) === 0) continue;
        
        const getMonday = (d: Date) => {
          const date = new Date(d);
          const dow = (date.getDay() + 6) % 7;
          date.setDate(date.getDate() - dow);
          date.setHours(0,0,0,0);
          return date;
        };
        const startMonday = getMonday(new Date(sub.start_date));
        const futureMonday = getMonday(futureDate);
        const weeksSinceStart = Math.round((futureMonday.getTime() - startMonday.getTime()) / (7 * 86400000));
        
        if (weeksSinceStart >= 0 && weeksSinceStart % 2 === 0) {
          diff = i;
          break;
        }
      }
      const result = new Date(today);
      result.setDate(today.getDate() + diff);
      return result;
    }
  }
  return new Date(today);
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
  const [isEditingNetWorth, setIsEditingNetWorth] = useState(false);
  const [editNetWorthValue, setEditNetWorthValue] = useState('');
  const [editIsNegative, setEditIsNegative] = useState(false);
  const editInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem('wolly_nw_hidden').then(val => {
      if (val !== null) setIsNetWorthHidden(val === 'true');
    });

    // Check if onboarding is completed
    AsyncStorage.getItem('wolly_onboarding_completed').then(val => {
      if (val === 'false' || val === null) {
        router.replace('/onboarding');
      }
    });
  }, []);

  const toggleNetWorthVisibility = async () => {
    const nextVal = !isNetWorthHidden;
    setIsNetWorthHidden(nextVal);
    await AsyncStorage.setItem('wolly_nw_hidden', String(nextVal));
  };

  const handleNetWorthTap = () => {
    if (isNetWorthHidden) return; // don't allow editing while hidden
    const absVal = Math.abs(netWorth);
    const formatted = absVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', '_').replace(',', ',').replace(/_/g, '.');
    setEditNetWorthValue(formatted);
    setEditIsNegative(netWorth < 0);
    setIsEditingNetWorth(true);
    setTimeout(() => editInputRef.current?.focus(), 80);
  };

  const handleEditNetWorthChange = (newVal: string) => {
    // Same formatting logic as onboarding
    let hasComma = newVal.includes(',');
    let endsWithDot = newVal.endsWith('.');
    const dotDecimalMatch = newVal.match(/\.(\d{1,2})$/);
    let hasDotDecimal = !hasComma && dotDecimalMatch !== null;
    let integerPart = '';
    let decimalPart = '';
    if (hasComma) {
      const parts = newVal.split(',');
      integerPart = parts[0];
      decimalPart = parts[1] || '';
    } else if (hasDotDecimal && dotDecimalMatch) {
      const lastDotIndex = newVal.lastIndexOf('.');
      integerPart = newVal.slice(0, lastDotIndex);
      decimalPart = dotDecimalMatch[1];
      hasComma = true;
    } else if (endsWithDot) {
      integerPart = newVal.slice(0, -1);
      decimalPart = '';
      hasComma = true;
    } else {
      integerPart = newVal;
    }
    const cleanInteger = integerPart.replace(/\D/g, '');
    const cleanDecimal = decimalPart.replace(/\D/g, '').slice(0, 2);
    const checkVal = parseFloat(cleanInteger + '.' + (cleanDecimal || '0')) || 0;
    if (checkVal > 999999999.99) return;
    const formattedInteger = cleanInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    let formattedVal = formattedInteger;
    if (hasComma || endsWithDot) formattedVal += ',' + cleanDecimal;
    setEditNetWorthValue(formattedVal);
  };

  const handleConfirmNetWorthEdit = () => {
    const cleanBalance = editNetWorthValue.replace(/\./g, '').replace(',', '.').trim();
    const numVal = parseFloat(cleanBalance) || 0;
    const finalAmount = editIsNegative ? -numVal : numVal;
    const diff = finalAmount - netWorth;
    if (diff === 0) { setIsEditingNetWorth(false); return; }
    const diffSign = diff > 0 ? '+' : '-';
    const diffFormatted = `${diffSign}€${Math.abs(diff).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const newFormatted = `€${Math.abs(finalAmount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    Alert.alert(
      'Aggiorna patrimonio',
      `Stai impostando il patrimonio a ${newFormatted} (variazione: ${diffFormatted}). Confermi?`,
      [
        { text: 'Annulla', style: 'cancel', onPress: () => setIsEditingNetWorth(false) },
        {
          text: 'Conferma',
          onPress: async () => {
            setIsEditingNetWorth(false);
            await NetWorthRepository.recordManualAdjustment(finalAmount);
            setNetWorth(finalAmount);
          },
        },
      ]
    );
  };
  
  useEffect(() => {
    // Inizializza il DB solo la prima volta
    const setupDB = async () => {
      try {
        await initDatabase();
        await SubscriptionManager.processDueSubscriptions();
        await NetWorthRepository.syncScheduledTransactions(); // Sincronizza le transazioni programmate maturate
        
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
      analytics.trackScreen(ANALYTICS_SCREENS.HOME);
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

      // Calcolo dinamico del limite di transazioni visibili in Home per riempire lo schermo senza scroll o spazi vuoti
      const insetsTop = insets.top || 44;
      const insetsBottom = insets.bottom || 34;
      const screenHeight = Dimensions.get('window').height;

      // Spazio inizio lista: paddingTop topSection (insetsTop + 16) + netWorth (85) + cardsRow (126) + topSection paddingBottom (36)
      // - overlapping marginTop (20) + bottomSection paddingTop (20) + header compact (28)
      const listStartOffset = insetsTop + 16 + 85 + 126 + 36 - 20 + 20 + 28; // = insetsTop + 291px
      
      // Spazio inizio bottom menu: insetsBottom + altezza menu (48) + margine bottomSection (12)
      const bottomMenuOffset = insetsBottom + 48 + 12; // = insetsBottom + 60px

      // Distanza fissa utile tra inizio lista e inizio bottom menu:
      const availableListHeight = screenHeight - listStartOffset - bottomMenuOffset;

      // Altezza esatta di ciascun TransactionItem (70px card + 8px marginBottom)
      const itemHeight = 78;

      // Limite preciso di elementi che possono starci
      const maxPossibleItems = Math.max(1, Math.floor(availableListHeight / itemHeight));

      console.log(`📊 [Home Layout] ScreenHeight: ${screenHeight}px, ListStartOffset: ${listStartOffset}px, BottomMenuOffset: ${bottomMenuOffset}px, AvailableListHeight: ${availableListHeight}px, MaxItems: ${maxPossibleItems}`);

      setTransactions(filteredTrans.slice(0, maxPossibleItems));

      // Load Net Worth
      const currentNw = await NetWorthRepository.getCurrentTotal();
      setNetWorth(currentNw);

      // Load upcoming subscriptions
      const allSubs = await SubscriptionRepository.getAll();
      // Filtriamo solo gli abbonamenti di tipo SPESA (direction = 'out' o default) per PROSSIME SPESE
      const activeSubs = allSubs.filter((s: any) => s.is_active && (s.direction || 'out') === 'out');
      const upcomingSubsList = activeSubs.map((s: any) => ({
        id: s.id,
        name: s.name,
        amount: s.amount,
        category_key: s.category_key,
        nextDate: getNextOccurrenceDate(s),
        isSubscription: true,
      }));

      // Load upcoming scheduled transactions
      const upcomingScheduled = await TransactionRepository.getUpcomingScheduled(10);
      // Filtriamo solo le spese programmate (direction = 'out') per PROSSIME SPESE
      const upcomingScheduledList = upcomingScheduled
        .filter((t: any) => (t.direction || 'out') === 'out')
        .map((t: any) => ({
          id: t.id,
          name: t.description || 'Spesa programmata',
          amount: t.amount,
          category_key: t.category_key,
          nextDate: new Date(t.date),
          isSubscription: false,
        }));

      // Merge and sort them chronologically
      const mergedUpcoming = [...upcomingSubsList, ...upcomingScheduledList]
        .sort((a: any, b: any) => a.nextDate.getTime() - b.nextDate.getTime());

      setUpcomingSubs(mergedUpcoming.slice(0, 3));

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
    <TransactionPreview item={item} />
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
        <View style={{ flex: 1 }}>
          {/* PARTE SUPERIORE: Sfumatura blu elettrico premium */}
          <LinearGradient
            colors={['#5CB5FF', '#0078FF']}
            style={[styles.topSection, { paddingTop: insets.top + 16 }]}
          >
            {/* Patrimonio totale (Sinistra allineato, stile premium) */}
            <View style={styles.netWorthHeaderContainer}>
              <Text style={styles.netWorthLabel}>Patrimonio totale</Text>
              <View style={styles.netWorthValueContainer}>
                {isEditingNetWorth ? (
                  // ── INLINE EDIT MODE ────────────────────────────────────
                  <>
                    <Pressable
                      onPress={() => setEditIsNegative(!editIsNegative)}
                      style={[styles.signToggle, editIsNegative ? styles.signToggleNeg : styles.signTogglePos]}
                    >
                      <Text style={[styles.signToggleText, editIsNegative ? { color: '#FCA5A5' } : { color: '#BFDBFE' }]}>
                        {editIsNegative ? '-' : '+'}
                      </Text>
                    </Pressable>
                    <TextInput
                      ref={editInputRef}
                      style={styles.netWorthEditInput}
                      value={editNetWorthValue}
                      onChangeText={handleEditNetWorthChange}
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmNetWorthEdit}
                      onBlur={() => setIsEditingNetWorth(false)}
                      selectionColor="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.netWorthCurrency}> €</Text>
                    <Pressable onPress={handleConfirmNetWorthEdit} style={styles.confirmEditButton}>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </Pressable>
                  </>
                ) : (
                  // ── DISPLAY MODE ─────────────────────────────────────────
                  <>
                    <Pressable onPress={handleNetWorthTap} style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                    </Pressable>
                    <Pressable onPress={toggleNetWorthVisibility} style={styles.eyeButton}>
                      <Ionicons
                        name={isNetWorthHidden ? 'eye-off-sharp' : 'eye-sharp'}
                        size={18}
                        color="#FFFFFF"
                      />
                    </Pressable>
                  </>
                )}
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
                <View style={[
                  styles.trendPill,
                  percentageChange <= 0 ? styles.trendPillGreen : styles.trendPillRed
                ]}>
                  <Text style={[
                    styles.trendPillText,
                    percentageChange <= 0 ? styles.trendTextGreen : styles.trendTextRed
                  ]} numberOfLines={1}>
                    {percentageChange !== 0 ? (
                      `${percentageChange > 0 ? '+' : '-'}${Math.abs(percentageChange).toFixed(0)}% vs mese prec.`
                    ) : (
                      'Trend stabile'
                    )}
                  </Text>
                </View>
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                            {!sub.isSubscription && (
                              <Ionicons name="time-outline" size={13} color="#FFFFFF" style={{ marginRight: 4, opacity: 0.85 }} />
                            )}
                            <Text style={styles.upcomingName} numberOfLines={1}>
                              {sub.name}
                            </Text>
                          </View>
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
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBackground}>
                    <Ionicons name="receipt-outline" size={36} color="#0A74FF" />
                  </View>
                  <Text style={styles.emptyTitle}>Non hai spese ancora</Text>
                  <Text style={styles.emptySubtitle}>Registra la tua prima transazione</Text>
                </View>
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
    backgroundColor: COLORS.background,
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
    minHeight: 48,
  },
  netWorthValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: -0.5,
  },
  netWorthCurrency: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.75)',
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
  netWorthEditInput: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: -0.5,
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    minWidth: 80,
  },
  signToggle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  signTogglePos: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  signToggleNeg: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  signToggleText: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  confirmEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    backgroundColor: COLORS.background,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    ...SHADOWS.soft,
  },
  emptyIconBackground: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#64748B',
    textAlign: 'center',
  },
  trendPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  trendPillGreen: {
    backgroundColor: 'rgba(52, 199, 89, 0.25)',
  },
  trendPillRed: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  trendPillText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  trendTextGreen: {
    color: '#E8FDF0',
  },
  trendTextRed: {
    color: '#FEE2E2',
  },
});
