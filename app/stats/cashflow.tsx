import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';
import AnnualChart from '../../components/AnnualChart';

export default function CashflowScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [timeRange, baseDate])
  );

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.title}>Flusso di Cassa</Text>
        <View style={{ width: 24 }} />
      </View>

      <TimeFilter 
        timeRange={timeRange} 
        setTimeRange={setTimeRange} 
        baseDate={baseDate}
        onDateChange={setBaseDate}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Entrate vs Uscite</Text>
              <Ionicons name="swap-vertical" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.cardSubtitle}>Confronto diretto dei flussi di cassa nel periodo.</Text>
            
            <AnnualChart 
              data={trendData} 
              title=""
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
                  <Text style={styles.summaryLabel}>Totale Entrate</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.success }]}>+ €{totalIncome.toFixed(0)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Totale Uscite</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.danger }]}>- €{totalExpense.toFixed(0)}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.lg, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  title: { fontSize: TYPOGRAPHY.sizes.xl, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  scrollContent: { paddingBottom: 120 },
  card: { backgroundColor: COLORS.surface, marginHorizontal: SPACING.lg, marginTop: SPACING.lg, borderRadius: 24, padding: SPACING.xl, ...SHADOWS.soft },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: TYPOGRAPHY.sizes.lg, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  cardSubtitle: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.secondary, marginTop: 4, marginBottom: SPACING.md },
  summaryContainer: { flexDirection: 'row', marginTop: SPACING.xl, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: TYPOGRAPHY.sizes.xs, fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  summaryValue: { fontSize: TYPOGRAPHY.sizes.lg, fontFamily: TYPOGRAPHY.fontBold },
  divider: { width: 1, height: '100%', backgroundColor: COLORS.border }
});
