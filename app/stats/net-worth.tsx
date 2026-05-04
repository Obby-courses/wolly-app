import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { NetWorthRepository } from '../../services/database/repositories/NetWorthRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';

const { width } = Dimensions.get('window');

const WealthChart = ({ data, labels }: { data: any[], labels: string[] }) => {
  if (data.length === 0) return null;
  const chartWidth = width - (SPACING.lg * 4);
  const chartHeight = 200;
  const safeMargin = 10;
  const maxVal = Math.max(...data.map(d => d.wealth), 1) * 1.1;
  const minVal = Math.min(...data.map(d => d.wealth), 0) * 0.9;
  const range = maxVal - minVal;
  const getX = (i: number) => (i * (chartWidth - 40) / (data.length - 1)) + 20;
  const getY = (v: number) => chartHeight - safeMargin - ((v - minVal) / range) * (chartHeight - safeMargin * 2);
  const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.wealth)}`).join(' ');
  const areaData = `${pathData} L ${getX(data.length - 1)} ${chartHeight} L ${getX(0)} ${chartHeight} Z`;

  return (
    <View style={styles.wealthChartContainer}>
      <Svg width={chartWidth} height={chartHeight}>
        <Path d={areaData} fill={COLORS.primary + '15'} />
        <Path d={pathData} fill="none" stroke={COLORS.primary} strokeWidth="3" />
        {data.length < 40 && data.map((d, i) => (
          <Circle key={i} cx={getX(i)} cy={getY(d.wealth)} r="4" fill={COLORS.primary} />
        ))}
      </Svg>
      <View style={styles.chartLabelsRow}>
        {labels.filter((_, i) => i % Math.max(1, Math.floor(labels.length / 6)) === 0).map((l, i) => (
          <Text key={i} style={styles.chartLabelText}>{l}</Text>
        ))}
      </View>
    </View>
  );
};

export default function NetWorthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [netWorthTrend, setNetWorthTrend] = useState<any[]>([]);
  const [selectedTotalValue, setSelectedTotalValue] = useState(0);

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

      // Net worth at the END of the period (baseDate)
      const nwAtEnd = await NetWorthRepository.getNetWorthAtDate(baseDate);
      setSelectedTotalValue(nwAtEnd);
      
      let runningTotal = nwAtEnd;
      const trendPoints = [...rawTrend].reverse().map(point => {
        const pointNet = (point.income - point.expense);
        const wealthAtEndOfThisPoint = runningTotal;
        runningTotal -= pointNet;
        return { ...point, wealth: wealthAtEndOfThisPoint };
      }).reverse();
      
      setNetWorthTrend(trendPoints);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.title}>Saldo</Text>
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
               <Text style={styles.cardTitle}>Andamento Cumulativo</Text>
               <Ionicons name="wallet" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.cardSubtitle}>Crescita del patrimonio basata sulle tue transazioni.</Text>
            
            <WealthChart data={netWorthTrend} labels={
              timeRange === 'Settimana' ? netWorthTrend.map(s => s.label || '') : 
              timeRange === 'Mese' ? netWorthTrend.map(s => s.day?.toString() || '') : 
              ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D']
            }/>
            
            <View style={styles.currentWealthRow}>
              <Text style={styles.currentWealthValue}>€ {selectedTotalValue.toFixed(2)}</Text>
              <Text style={styles.currentWealthLabel}>Saldo al termine del periodo</Text>
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
  wealthChartContainer: { marginTop: SPACING.sm, alignItems: 'center' },
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10, marginTop: 8 },
  chartLabelText: { fontSize: 9, fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.secondary },
  currentWealthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  currentWealthLabel: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.secondary },
  currentWealthValue: { fontSize: 24, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary }
});
