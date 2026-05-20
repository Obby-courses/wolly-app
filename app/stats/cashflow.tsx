import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';
import AnnualChart from '../../components/AnnualChart';

export default function CashflowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      setTimeRange('Mese');
      setBaseDate(new Date().toISOString().split('T')[0]);
    }, [])
  );

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [timeRange, baseDate]);

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

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      {/* Header Sfumato Blu Premium */}
      <LinearGradient
        colors={['#0A74FF', '#0857C3']}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12, marginLeft: -4, marginTop: 2 }}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>Flusso di Cassa</Text>
        </View>
        <Text style={styles.subtitle}>Confronto diretto tra entrate e uscite</Text>
      </LinearGradient>

      {/* Overlapping Bottom Sheet - NO border radius */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 64 }]}>
        
        {/* TimeFilter in premium white card container */}
        <View style={styles.filterCard}>
          <TimeFilter 
            timeRange={timeRange} 
            setTimeRange={setTimeRange} 
            baseDate={baseDate}
            onDateChange={setBaseDate}
          />
        </View>

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
    backgroundColor: '#F2F2F7',
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
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingTop: 16,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
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
