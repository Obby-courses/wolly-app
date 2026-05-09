import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ActivityIndicator, TextInput, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';

// ... (rest of imports)
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase } from '../services/database/db';
import { SubscriptionManager } from '../services/database/SubscriptionManager';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { NetWorthRepository } from '../services/database/repositories/NetWorthRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { getCategory } from '../constants/categories';
import { getCategoryColor } from '../components/CategoryPill';
import AnnualChart from '../components/AnnualChart';

export default function Home() {
  const router = useRouter();
  const [isDbReady, setIsDbReady] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'Settimana' | 'Mese' | 'Anno' | 'Tutto'>('Mese');
  const [summary, setSummary] = useState({ income: 0, expense: 0 });
  const [netWorth, setNetWorth] = useState<number>(0);
  
  // Stati per la gestione manuale del patrimonio
  const [isEditingNetWorth, setIsEditingNetWorth] = useState(false);
  const [tempNetWorth, setTempNetWorth] = useState('');
  const [isNetWorthVisible, setIsNetWorthVisible] = useState(true);

  useEffect(() => {
    // Inizializza il DB solo la prima volta
    const setupDB = async () => {
      try {
        await initDatabase();
        await SubscriptionManager.processDueSubscriptions();
        
        // Carica preferenza privacy patrimonio
        const savedVisibility = await AsyncStorage.getItem('isNetWorthVisible');
        if (savedVisibility !== null) {
          setIsNetWorthVisible(savedVisibility === 'true');
        }
        
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
    }, [isDbReady, timeRange])
  );

  const loadData = async () => {
    try {
      const now = new Date();
      let stats: any[] = [];
      let title = '';
      let labels: string[] | undefined = undefined;

      if (timeRange === 'Settimana') {
        stats = await TransactionRepository.getDailyStatsForRecentDays(7);
        title = 'Trend Settimanale';
        labels = stats.map(s => s.label);
      } else if (timeRange === 'Mese') {
        stats = await TransactionRepository.getDailyStatsForMonth(now.getFullYear(), now.getMonth() + 1);
        title = 'Trend Mensile';
        labels = stats.map(s => s.day.toString());
      } else if (timeRange === 'Anno') {
        stats = await TransactionRepository.getMonthlyStatsForYear(now.getFullYear());
        title = 'Trend Annuale';
        labels = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
      } else {
        stats = await TransactionRepository.getStatsForAllTime();
        title = 'Trend Globale';
        labels = stats.map(s => s.label);
      }

      setChartData(stats);
      
      // Calcola sommario per il range attuale
      const totalIncome = stats.reduce((acc, curr) => acc + curr.income, 0);
      const totalExpense = stats.reduce((acc, curr) => acc + curr.expense, 0);
      setSummary({ income: totalIncome, expense: totalExpense });

      // Carica transazioni recenti filtrate per il range
      const filteredTrans = await TransactionRepository.getFilteredTransactions(
        timeRange as any,
        {},
        'date',
        now.toISOString().split('T')[0]
      );
      setTransactions(filteredTrans.slice(0, 20));

      // Load Net Worth
      const currentNw = await NetWorthRepository.getCurrentTotal();
      setNetWorth(currentNw);

    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
    }
  };

  const handleUpdateNetWorth = async () => {
    const amount = parseFloat(tempNetWorth.replace(',', '.'));
    if (!isNaN(amount)) {
      await NetWorthRepository.updateTotal(amount);
      setNetWorth(amount);
    }
    setIsEditingNetWorth(false);
    loadData(); // Ricarica per aggiornare eventuali sync in dashboard
  };

  const toggleNetWorthVisibility = async () => {
    const newValue = !isNetWorthVisible;
    setIsNetWorthVisible(newValue);
    await AsyncStorage.setItem('isNetWorthVisible', newValue.toString());
  };

  const renderTransaction = ({ item }: { item: any }) => {
    const isIncome = item.direction === 'in';
    
    // Trova i dettagli della categoria per label e colore coerenti
    const category = getCategory(item.category_key);
    const categoryColor = getCategoryColor(item.category_key);
    const displayCategory = category ? category.label : item.category_key.replace(/_/g, ' ');

    return (
      <Pressable 
        style={styles.transactionCard}
        onPress={() => router.push(`/transaction/${item.id}`)}
      >
        <View style={[styles.categoryIndicator, { backgroundColor: categoryColor }]} />
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle} numberOfLines={1}>
            {item.description || displayCategory}
          </Text>
          <Text style={styles.transactionCategory}>
            {displayCategory} • {item.date}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.transactionAmount, isIncome ? styles.income : styles.expense]}>
            {!isIncome ? '- ' : '+ '}€{Math.abs(item.amount).toFixed(2)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {!isDbReady ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {/* Summary Cards */}
              <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={styles.summaryLabel}>Entrate</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.success }]}>+€{summary.income.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={styles.summaryLabel}>Uscite</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.danger }]}>-€{summary.expense.toFixed(2)}</Text>
                </View>
              </View>

              {/* Net Worth Card */}
              <View style={styles.netWorthCard}>
                <View style={styles.netWorthHeader}>
                  <Text style={styles.netWorthLabel}>Patrimonio Totale</Text>
                  <Pressable 
                    onPress={toggleNetWorthVisibility}
                    style={styles.privacyToggle}
                  >
                    <Ionicons 
                      name={isNetWorthVisible ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </Pressable>
                </View>

                {isEditingNetWorth ? (
                  <View style={styles.netWorthEditRow}>
                    <Text style={styles.netWorthCurrencyEdit}>€</Text>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 10, alignSelf: 'stretch', justifyContent: 'center' }}>
                      <TextInput
                        style={styles.netWorthInput}
                        keyboardType="decimal-pad"
                        autoFocus
                        value={tempNetWorth}
                        onChangeText={setTempNetWorth}
                        onSubmitEditing={handleUpdateNetWorth}
                        onBlur={() => setIsEditingNetWorth(false)}
                      />
                    </View>
                  </View>
                ) : (
                  <Pressable 
                    onPress={() => {
                      setTempNetWorth(netWorth.toString());
                      setIsEditingNetWorth(true);
                    }}
                  >
                    <Text style={styles.netWorthValue}>
                      {isNetWorthVisible ? `€ ${netWorth.toFixed(2)}` : '€ ••••••'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Time Range Filter */}
              <View style={styles.filterContainer}>
                {['Settimana', 'Mese', 'Anno', 'Tutto'].map((range) => (
                  <Pressable
                    key={range}
                    onPress={() => setTimeRange(range as any)}
                    style={[
                      styles.filterButton,
                      timeRange === range && styles.filterButtonActive
                    ]}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      timeRange === range && styles.filterButtonTextActive
                    ]}>
                      {range}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <AnnualChart 
                data={chartData} 
                title={
                  timeRange === 'Settimana' ? 'Andamento Settimanale' : 
                  timeRange === 'Mese' ? 'Andamento Mensile' : 
                  timeRange === 'Anno' ? 'Andamento Annuale' : 'Andamento Globale'
                }
                labels={
                  timeRange === 'Settimana' 
                    ? chartData.map(s => s.label || '') 
                    : timeRange === 'Mese' 
                    ? chartData.map(s => s.day?.toString() || '') 
                    : timeRange === 'Anno'
                    ? ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D']
                    : chartData.map(s => s.label || '')
                }
              />
              <Text style={styles.sectionTitle}>Transazioni Recenti</Text>
            </View>
          }
        />
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
  seeAllText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.accent,
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
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginLeft: SPACING.lg,
    marginBottom: SPACING.md,
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
  netWorthCard: {
    backgroundColor: '#111827',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: 24,
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  netWorthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
    position: 'relative',
  },
  netWorthLabel: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  privacyToggle: {
    position: 'absolute',
    right: 0,
    padding: 5,
  },
  netWorthValue: {
    color: '#FFF',
    fontSize: 48,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  netWorthEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
  },
  netWorthCurrencyEdit: {
    color: '#FFF',
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontBold,
    marginRight: 10,
  },
  netWorthInput: {
    color: '#FFF',
    fontSize: 36,
    fontFamily: TYPOGRAPHY.fontBold,
    padding: 0,
    margin: 0,
    width: '100%',
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
  transactionCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 20,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.soft
  },
  categoryIndicator: {
    width: 6,
    height: 40,
    borderRadius: 3,
    marginRight: SPACING.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'uppercase',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  income: {
    color: COLORS.success,
  },
  expense: {
    color: COLORS.primary,
  },
});
