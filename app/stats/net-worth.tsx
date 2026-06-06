import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { NetWorthRepository } from '../../services/database/repositories/NetWorthRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';
import { analytics, ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../services/analytics';

const { width } = Dimensions.get('window');

const WealthChart = ({ data, labels }: { data: any[], labels: string[] }) => {
  if (data.length === 0) return null;

  // Trova tutti i punti non futuri
  const nonFuturePoints = data
    .map((d, i) => ({ ...d, originalIndex: i }))
    .filter(d => !d.isFuture);

  const chartWidth = width - (SPACING.lg * 2);
  const chartHeight = 130;
  const safeMargin = 16; // Margine aumentato per non tagliare le etichette Max/Min

  if (nonFuturePoints.length === 0) {
    return (
      <View style={styles.wealthChartContainer}>
        <Svg width={chartWidth} height={chartHeight} />
        <View style={styles.chartLabelsRow}>
          {labels.filter((_, i) => i % Math.max(1, Math.floor(labels.length / 6)) === 0).map((l, i) => (
            <Text key={i} style={styles.chartLabelText}>{l}</Text>
          ))}
        </View>
      </View>
    );
  }

  // Calcola min e max basandosi solo sui punti non futuri
  const activeWealths = nonFuturePoints.map(d => d.wealth);
  const actualMin = Math.min(...activeWealths);
  const actualMax = Math.max(...activeWealths);
  const diff = actualMax - actualMin;
  
  // Margine proporzionale del 15% per dare respiro visivo al grafico
  const rangeMargin = diff > 0 ? diff * 0.15 : Math.abs(actualMax) * 0.1 || 10;
  
  let minVal = actualMin - rangeMargin;
  let maxVal = actualMax + rangeMargin;
  
  // Se tutti i valori reali sono positivi, non andiamo sotto lo zero
  if (actualMin >= 0 && minVal < 0) {
    minVal = 0;
  }
  
  const range = maxVal - minVal;
  const getX = (i: number) => (i * (chartWidth - 40) / (data.length - 1)) + 20;
  const getY = (v: number) => chartHeight - safeMargin - ((v - minVal) / range) * (chartHeight - safeMargin * 2);

  // pathData ed areaData disegnati solo per i punti non futuri
  const pathData = nonFuturePoints.map((d, idx) => {
    const prefix = idx === 0 ? 'M' : 'L';
    return `${prefix} ${getX(d.originalIndex)} ${getY(d.wealth)}`;
  }).join(' ');

  const firstIdx = nonFuturePoints[0].originalIndex;
  const lastIdx = nonFuturePoints[nonFuturePoints.length - 1].originalIndex;
  const areaData = `${pathData} L ${getX(lastIdx)} ${chartHeight} L ${getX(firstIdx)} ${chartHeight} Z`;

  const hasDiff = diff > 0;

  return (
    <View style={styles.wealthChartContainer}>
      <Svg width={chartWidth} height={chartHeight}>


        {/* Andamento del Patrimonio */}
        <Path d={areaData} fill="#0A74FF15" />
        <Path d={pathData} fill="none" stroke="#0A74FF" strokeWidth="3" />
        
        {/* Nodi (solo se il numero di punti è limitato) */}
        {data.length < 40 && nonFuturePoints.map((d) => (
          <Circle key={d.originalIndex} cx={getX(d.originalIndex)} cy={getY(d.wealth)} r="4" fill="#0A74FF" />
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

const DeltaChart = ({ data, labels }: { data: any[], labels: string[] }) => {
  if (data.length === 0) return null;
  const chartWidth = width - (SPACING.lg * 2);
  const chartHeight = 80;
  const deltas = data.map(d => (d.income || 0) - (d.expense || 0));
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  const barCount = deltas.length;
  const totalGap = Math.max(1, barCount - 1) * 2;
  const barWidth = Math.max(2, (chartWidth - totalGap) / barCount);
  const midY = chartHeight / 2;

  return (
    <View style={styles.wealthChartContainer}>
      <Text style={styles.deltaChartLabel}>Variazione giornaliera</Text>
      <Svg width={chartWidth} height={chartHeight}>
        {/* zero line */}
        <Path d={`M 0 ${midY} L ${chartWidth} ${midY}`} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
        {deltas.map((delta, i) => {
          const barH = Math.max(2, (Math.abs(delta) / maxAbs) * (midY - 4));
          const x = i * (barWidth + 2);
          const y = delta >= 0 ? midY - barH : midY;
          const color = delta >= 0 ? '#22C55E' : '#EF4444';
          return <Path key={i} d={`M ${x} ${y} L ${x} ${y + barH} L ${x + barWidth} ${y + barH} L ${x + barWidth} ${y} Z`} fill={color} opacity="0.8" />;
        })}
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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [netWorthTrend, setNetWorthTrend] = useState<any[]>([]);
  const [selectedTotalValue, setSelectedTotalValue] = useState(0);

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      analytics.trackScreen(ANALYTICS_SCREENS.STATS_NET_WORTH);
      setTimeRange('Mese');
      setBaseDate(new Date().toISOString().split('T')[0]);
    }, [])
  );

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [timeRange, baseDate]);

  // Track time range changes
  useEffect(() => {
    analytics.trackClick(ANALYTICS_BUTTONS.TIME_FILTER_SELECT, ANALYTICS_SCREENS.STATS_NET_WORTH, { range: timeRange });
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

      const nwAtEnd = await NetWorthRepository.getNetWorthAtDate(baseDate);
      setSelectedTotalValue(nwAtEnd);
      
      let runningTotal = nwAtEnd;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const trendPoints = [...rawTrend].reverse().map(point => {
        const pointNet = (point.income - point.expense);
        const wealthAtEndOfThisPoint = runningTotal;
        runningTotal -= pointNet;

        let isFuture = false;
        if (timeRange === 'Settimana' || timeRange === 'Mese') {
          isFuture = point.date > todayStr;
        } else if (timeRange === 'Anno') {
          const selectedYear = d.getFullYear();
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth() + 1; // 1-indexed
          if (selectedYear > currentYear) {
            isFuture = true;
          } else if (selectedYear === currentYear) {
            isFuture = point.month > currentMonth;
          }
        } else if (point.date) {
          isFuture = point.date > todayStr;
        }

        return { ...point, wealth: wealthAtEndOfThisPoint, isFuture };
      }).reverse();
      
      setNetWorthTrend(trendPoints);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      {/* Header Sfumato Blu Premium */}
      <LinearGradient
        colors={['#5CB5FF', '#0078FF']}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <Pressable onPress={() => router.back()} style={{ marginLeft: -4, marginBottom: 12, alignSelf: 'flex-start' }}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>
        <View style={[styles.header, { marginTop: 0 }]}>
          <Text style={styles.title}>Saldo</Text>
        </View>
        <Text style={styles.subtitle}>Andamento del patrimonio totale nel tempo</Text>
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
          {loading ? <ActivityIndicator size="large" color="#0A74FF" style={{ marginTop: 30 }} /> : (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                 <Text style={styles.cardTitle}>Andamento Cumulativo</Text>
                 <Ionicons name="wallet-outline" size={20} color="#0A74FF" />
              </View>
              <Text style={styles.cardSubtitle}>Crescita del patrimonio basata sulle tue transazioni.</Text>
              
              <WealthChart data={netWorthTrend} labels={
                timeRange === 'Settimana' ? netWorthTrend.map(s => s.label || '') : 
                timeRange === 'Mese' ? netWorthTrend.map(s => s.day?.toString() || '') : 
                timeRange === 'Anno' ? ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'] :
                netWorthTrend.map(s => s.label || '')
              }/>

              <DeltaChart data={netWorthTrend} labels={
                timeRange === 'Settimana' ? netWorthTrend.map(s => s.label || '') : 
                timeRange === 'Mese' ? netWorthTrend.map(s => s.day?.toString() || '') : 
                timeRange === 'Anno' ? ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'] :
                netWorthTrend.map(s => s.label || '')
              }/>
              
              <View style={styles.currentWealthRow}>
                <Text style={styles.currentWealthValue}>€ {selectedTotalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                <Text style={styles.currentWealthLabel}>Saldo a fine periodo</Text>
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
    backgroundColor: 'transparent',
    paddingVertical: 16,
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
  wealthChartContainer: {
    marginTop: SPACING.xs,
    alignItems: 'center',
  },
  deltaChartLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  chartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 6,
  },
  chartLabelText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  currentWealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  currentWealthLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  currentWealthValue: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
});
