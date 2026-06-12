import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';
import AnnualChart from '../../components/AnnualChart';
import { analytics, ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../services/analytics';

export default function CashflowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [absoluteLimits, setAbsoluteLimits] = useState<{ max: number; min: number } | null>(null);

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      analytics.trackScreen(ANALYTICS_SCREENS.STATS_CASHFLOW);
      setTimeRange('Mese');
      setBaseDate(new Date().toISOString().split('T')[0]);
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [timeRange, baseDate, refreshKey]);

  // Track time range changes
  useEffect(() => {
    analytics.trackClick(ANALYTICS_BUTTONS.TIME_FILTER_SELECT, ANALYTICS_SCREENS.STATS_CASHFLOW, { range: timeRange });
  }, [timeRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      let rawTrend: any[] = [];
      const d = new Date(baseDate);
      if (timeRange === 'Settimana') rawTrend = await TransactionRepository.getDailyStatsForRecentDays(7, baseDate);
      else if (timeRange === 'Mese') rawTrend = await TransactionRepository.getDailyStatsForMonth(d.getFullYear(), d.getMonth() + 1);
      else if (timeRange === 'Anno') rawTrend = await TransactionRepository.getMonthlyStatsForYear(d.getFullYear());
      else rawTrend = await TransactionRepository.getStatsForAllTime();

      setTrendData(rawTrend);

      // Calcola i totali del periodo
      const incomes = rawTrend.reduce((acc, curr) => acc + curr.income, 0);
      const expenses = rawTrend.reduce((acc, curr) => acc + curr.expense, 0);
      setTotalIncome(incomes);
      setTotalExpense(expenses);

      const limits = await TransactionRepository.getAbsoluteTrendLimits(timeRange, 'both');
      setAbsoluteLimits(limits);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      {/* Header pulito senza banner blu */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.centeredTitle}>Flusso di Cassa</Text>
        <Pressable onPress={() => {
          Alert.alert(
            'Informazioni Flusso di Cassa',
            'Questa schermata ti permette di confrontare direttamente le entrate e le uscite totali nel periodo selezionato per monitorare il tuo flusso di risparmio.'
          );
        }} style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
        </Pressable>
      </View>

      <TimeFilter 
        timeRange={timeRange} 
        setTimeRange={setTimeRange} 
        baseDate={baseDate}
        onDateChange={setBaseDate}
      />

      {/* Overlapping Bottom Sheet - NO border radius */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 64 }]}>
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={false}>
          {loading ? <ActivityIndicator size="large" color="#0A74FF" style={{ marginTop: 50 }} /> : (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Entrate vs Uscite</Text>
                <Ionicons name="swap-vertical" size={20} color="#0A74FF" />
              </View>
              <Text style={styles.cardSubtitle}>Confronto diretto dei flussi di cassa nel periodo.</Text>
              
              <AnnualChart 
                data={trendData} 
                title=""
                height={130}
                absoluteMax={absoluteLimits?.max}
                labels={
                  timeRange === 'Settimana' 
                    ? trendData.map(s => s.label || '') 
                    : timeRange === 'Mese' 
                    ? trendData.map(s => s.day?.toString() || '') 
                    : timeRange === 'Anno'
                    ? ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D']
                    : trendData.map(s => s.label || '')
                }
              />
              
              <View style={styles.summaryContainer}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Entrate</Text>
                    <Text style={[styles.summaryValue, { color: COLORS.success }]}>+ €{totalIncome.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Uscite</Text>
                    <Text style={[styles.summaryValue, { color: COLORS.danger }]}>- €{totalExpense.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Differenza</Text>
                    <Text style={[
                      styles.summaryValue, 
                      { color: (totalIncome - totalExpense) >= 0 ? COLORS.success : COLORS.danger }
                    ]}>
                      {(totalIncome - totalExpense) >= 0 ? '+' : '-'} €{Math.abs(totalIncome - totalExpense).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                    </Text>
                </View>
              </View>
            </View>
          )}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: 4,
  },
  infoButton: {
    padding: 4,
  },
  centeredTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    marginBottom: 12,
    ...SHADOWS.soft,
  },
  card: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  summaryContainer: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  divider: {
    width: 1,
    height: '100%',
    backgroundColor: COLORS.border,
  },
});
