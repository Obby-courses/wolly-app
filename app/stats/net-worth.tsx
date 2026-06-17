import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop, G, Rect } from 'react-native-svg';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { NetWorthRepository } from '../../services/database/repositories/NetWorthRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';
import { analytics, ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../services/analytics';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatCompactValue = (val: number): string => {
  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (absVal < 1000) {
    return `${sign}${Math.round(absVal)}`;
  }
  if (absVal < 1000000) {
    const kVal = absVal / 1000;
    if (kVal < 10) {
      const formatted = kVal.toFixed(1);
      return `${sign}${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}K`;
    } else {
      return `${sign}${Math.round(kVal)}K`;
    }
  }
  const mVal = absVal / 1000000;
  if (mVal < 10) {
    const formatted = mVal.toFixed(1);
    return `${sign}${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M`;
  } else {
    return `${sign}${Math.round(mVal)}M`;
  }
};

const formatDateLabel = (dateStr: string | undefined, timeRange: string, fallbackLabel: string): string => {
  if (!dateStr) return fallbackLabel;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallbackLabel;
  
  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const m = months[d.getMonth()];
  
  if (timeRange === 'Anno') {
    const yy = d.getFullYear().toString().slice(-2);
    return `${m}${yy}`;
  } else if (timeRange === 'Tutto') {
    const year = d.getFullYear();
    const yy = year.toString().slice(-2);
    const day = d.getDate();
    if (fallbackLabel.includes('/')) {
      return `${m}${yy}`;
    } else if (fallbackLabel.length === 4 && !isNaN(Number(fallbackLabel))) {
      return fallbackLabel;
    } else {
      return `${day}${m}`;
    }
  } else {
    return `${d.getDate()}${m}`;
  }
};

const WealthChart = ({ data, labels, absoluteMax, absoluteMin, timeRange }: { data: any[], labels: string[], absoluteMax?: number, absoluteMin?: number, timeRange: string }) => {
  if (data.length === 0) return null;

  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const touchStart = React.useRef<number>(0);
  const activeIdxRef = React.useRef<number | null>(null);

  // Punti visibili: non futuri e con un valore reale (non null = pre-history)
  const visiblePoints = data
    .map((d, i) => ({ ...d, originalIndex: i }))
    .filter(d => !d.isFuture && d.wealth !== null && d.wealth !== undefined);

  const chartWidth = width - (SPACING.lg * 2);
  const chartHeight = Math.round(SCREEN_HEIGHT * 0.46);
  const safeMargin = 10;

  const getFilteredLabels = () => {
    const total = labels.length;
    if (total === 0) return [];
    if (total <= 7) return labels.map((l, index) => ({ label: l, index }));
    const indices: number[] = [];
    for (let i = 0; i < 7; i++) {
      indices.push(Math.round((i * (total - 1)) / 6));
    }
    return labels
      .map((l, index) => ({ label: l, index }))
      .filter((_, idx) => indices.includes(idx));
  };

  // Caso: nessun punto visibile
  if (visiblePoints.length === 0) {
    return (
      <View style={styles.wealthChartContainer}>
        <Svg width={chartWidth} height={chartHeight} />
        <View style={styles.chartLabelsRow}>
          {getFilteredLabels().map((item, i) => (
            <View key={i} style={styles.labelBadge}>
              <Text style={styles.chartLabelText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Calcola min e max basandosi solo sui punti visibili
  const activeWealths = visiblePoints.map(d => d.wealth as number);
  const actualMin = Math.min(...activeWealths);
  const actualMax = Math.max(...activeWealths);

  const finalAbsoluteMax = absoluteMax !== undefined ? Math.max(absoluteMax, actualMax) : actualMax;
  const finalAbsoluteMin = actualMin;
  const diff = finalAbsoluteMax - finalAbsoluteMin;

  const rangeMargin = diff > 0 ? diff * 0.05 : Math.abs(finalAbsoluteMax) * 0.05 || 10;

  let minVal = finalAbsoluteMin - rangeMargin;
  let maxVal = finalAbsoluteMax + rangeMargin;

  const range = maxVal - minVal;
  const horizontalMargin = 28;

  // getX: safe against data.length === 1 (single point → center)
  const totalPoints = data.length;
  const getX = (i: number) => {
    if (totalPoints <= 1) return chartWidth / 2;
    return (i * (chartWidth - horizontalMargin * 2) / (totalPoints - 1)) + horizontalMargin;
  };
  const getY = (v: number) => chartHeight - safeMargin - ((v - minVal) / range) * (chartHeight - safeMargin * 2);

  const getPointIndexFromX = (touchX: number) => {
    if (visiblePoints.length === 0) return null;
    let closestIndex = visiblePoints[0].originalIndex;
    let minDistance = Infinity;
    for (const p of visiblePoints) {
      const px = getX(p.originalIndex);
      const distance = Math.abs(touchX - px);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = p.originalIndex;
      }
    }
    return closestIndex;
  };

  const handleTouchStart = (evt: any) => {
    touchStart.current = Date.now();
    const touchX = evt.nativeEvent.locationX;
    const index = getPointIndexFromX(touchX);
    if (index !== null) {
      setActiveIdx(index);
      activeIdxRef.current = index;
    }
  };

  const handleTouchMove = (evt: any) => {
    const touchX = evt.nativeEvent.locationX;
    const index = getPointIndexFromX(touchX);
    if (index !== null) {
      setActiveIdx(index);
      activeIdxRef.current = index;
    }
  };

  const handleTouchEnd = () => {
    const duration = Date.now() - touchStart.current;
    if (duration < 250 && activeIdxRef.current !== null) {
      const d = data[activeIdxRef.current];
      if (d?.wealth != null) {
        const periodLabel = labels[activeIdxRef.current];
        Alert.alert(
          'Dettaglio Saldo',
          `Periodo: ${periodLabel}\nPatrimonio: € ${d.wealth.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
      }
    }
    setActiveIdx(null);
    activeIdxRef.current = null;
  };

  let activeTooltip: any = null;
  if (activeIdx !== null && activeIdx < data.length && data[activeIdx]?.wealth != null) {
    const fallbackLabel = labels[activeIdx];
    const dateStr = data[activeIdx].date;
    const valueText = `€${formatCompactValue(data[activeIdx].wealth)} (${formatDateLabel(dateStr, timeRange, fallbackLabel)})`;
    const rectWidth = Math.max(46, valueText.length * 7.5 + 12);
    const rawX = getX(activeIdx) - rectWidth / 2;
    const rectX = Math.max(4, Math.min(chartWidth - rectWidth - 4, rawX));
    const textX = rectX + rectWidth / 2;
    activeTooltip = { valueText, rectWidth, rectX, textX };
  }

  // Caso speciale: un solo punto visibile → dot centrato verticalmente, linea interattiva al tocco
  if (visiblePoints.length === 1) {
    const singlePoint = visiblePoints[0];
    // Dot sempre al centro verticale della viewport
    const cx = chartWidth / 2;
    const cy = chartHeight / 2;

    // Tooltip per il singolo punto
    let singleTooltip: any = null;
    if (activeIdx !== null && data[activeIdx]?.wealth != null) {
      const fallbackLabel = labels[activeIdx] ?? labels[singlePoint.originalIndex];
      const dateStr = data[activeIdx]?.date ?? singlePoint.date;
      const wealthVal = data[activeIdx]?.wealth ?? singlePoint.wealth;
      const valueText = `€${formatCompactValue(wealthVal)} (${formatDateLabel(dateStr, timeRange, fallbackLabel)})`;
      const rectWidth = Math.max(46, valueText.length * 7.5 + 12);
      const rawX = cx - rectWidth / 2;
      const rectX = Math.max(4, Math.min(chartWidth - rectWidth - 4, rawX));
      const textX = rectX + rectWidth / 2;
      singleTooltip = { valueText, rectWidth, rectX, textX };
    }

    const handleSingleTouchStart = (evt: any) => {
      touchStart.current = Date.now();
      setActiveIdx(singlePoint.originalIndex);
      activeIdxRef.current = singlePoint.originalIndex;
    };

    const handleSingleTouchEnd = () => {
      setActiveIdx(null);
      activeIdxRef.current = null;
    };

    return (
      <View style={styles.wealthChartContainer}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <Svg width={chartWidth} height={chartHeight}>
            {/* Linea verticale tratteggiata sempre visibile (sottile) */}
            <Line
              x1={cx} y1={safeMargin}
              x2={cx} y2={chartHeight - safeMargin}
              stroke="#0A74FF"
              strokeWidth="1"
              strokeDasharray="4, 6"
              opacity="0.25"
            />

            {/* Dot centrato */}
            <Circle cx={cx} cy={cy} r="7" fill="#0A74FF" stroke="#FFFFFF" strokeWidth="3" />

            {/* Overlay interattivo al tocco */}
            {activeIdx !== null && (
              <G>
                {/* Linea tratteggiata verticale full-height */}
                <Line
                  x1={cx} y1={safeMargin}
                  x2={cx} y2={chartHeight - safeMargin}
                  stroke={COLORS.secondary}
                  strokeWidth="1.5"
                  strokeDasharray="4, 4"
                />
                {/* Dot ingrandito */}
                <Circle cx={cx} cy={cy} r="8" fill="#0A74FF" stroke="#FFFFFF" strokeWidth="2.5" />
                {/* Tooltip in alto */}
                {singleTooltip && (
                  <>
                    <Rect
                      x={singleTooltip.rectX}
                      y={4}
                      width={singleTooltip.rectWidth}
                      height={20}
                      rx={5}
                      fill={COLORS.primary}
                    />
                    <SvgText
                      x={singleTooltip.textX}
                      y={18}
                      fontSize="10"
                      fontFamily={TYPOGRAPHY.fontBold}
                      fill="#FFFFFF"
                      textAnchor="middle"
                    >
                      {singleTooltip.valueText}
                    </SvgText>
                  </>
                )}
              </G>
            )}
          </Svg>
          <View
            style={StyleSheet.absoluteFill}
            onTouchStart={handleSingleTouchStart}
            onTouchMove={handleSingleTouchStart}
            onTouchEnd={handleSingleTouchEnd}
            onTouchCancel={handleSingleTouchEnd}
          />
        </View>
        <View style={styles.chartLabelsRow}>
          {getFilteredLabels().map((item, i) => (
            <View key={i} style={styles.labelBadge}>
              <Text style={styles.chartLabelText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Building smooth curved path data (Cubic Bezier)
  let pathData = '';
  pathData = `M ${getX(visiblePoints[0].originalIndex)} ${getY(visiblePoints[0].wealth)}`;
  for (let i = 0; i < visiblePoints.length - 1; i++) {
    const pStart = visiblePoints[i];
    const pEnd = visiblePoints[i + 1];
    const xStart = getX(pStart.originalIndex);
    const yStart = getY(pStart.wealth);
    const xEnd = getX(pEnd.originalIndex);
    const yEnd = getY(pEnd.wealth);

    const cp1x = xStart + (xEnd - xStart) / 3;
    const cp1y = yStart;
    const cp2x = xStart + 2 * (xEnd - xStart) / 3;
    const cp2y = yEnd;

    pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${xEnd} ${yEnd}`;
  }

  const firstIdx = visiblePoints[0].originalIndex;
  const lastIdx = visiblePoints[visiblePoints.length - 1].originalIndex;
  const areaData = `${pathData} L ${getX(lastIdx)} ${chartHeight} L ${getX(firstIdx)} ${chartHeight} Z`;

  return (
    <View style={styles.wealthChartContainer}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0A74FF" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#0A74FF" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {/* Andamento del Patrimonio */}
          <Path d={areaData} fill="url(#areaGrad)" />
          <Path d={pathData} fill="none" stroke="#0A74FF" strokeWidth="3" />

          {/* Linea orizzontale leggera azzurra dall'ultimo punto visibile ai punti futuri */}
          {visiblePoints.length > 0 && lastIdx < data.length - 1 && (() => {
            const lastPoint = visiblePoints[visiblePoints.length - 1];
            const startXCoord = getX(lastPoint.originalIndex);
            const endXCoord = getX(data.length - 1);
            const yCoord = getY(lastPoint.wealth);
            return (
              <Line
                x1={startXCoord}
                y1={yCoord}
                x2={endXCoord}
                y2={yCoord}
                stroke="#0A74FF"
                strokeWidth="1.5"
                strokeDasharray="4, 4"
                opacity="0.4"
              />
            );
          })()}

          {/* Dot all'inizio del grafico */}
          <Circle
            cx={getX(visiblePoints[0].originalIndex)}
            cy={getY(visiblePoints[0].wealth)}
            r="5"
            fill="#0A74FF"
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {/* Dot all'ultimo punto visibile */}
          <Circle
            cx={getX(visiblePoints[visiblePoints.length - 1].originalIndex)}
            cy={getY(visiblePoints[visiblePoints.length - 1].wealth)}
            r="5"
            fill="#0A74FF"
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {/* Touch interactive overlays */}
          {activeIdx !== null && activeIdx < data.length && data[activeIdx]?.wealth != null && activeTooltip && (
            <G>
              {/* Linea tratteggiata verticale */}
              <Line
                x1={getX(activeIdx)}
                y1={safeMargin}
                x2={getX(activeIdx)}
                y2={chartHeight - safeMargin}
                stroke={COLORS.secondary}
                strokeWidth="1.5"
                strokeDasharray="4, 4"
              />
              {/* Intersection circle */}
              <Circle
                cx={getX(activeIdx)}
                cy={getY(data[activeIdx].wealth)}
                r="6"
                fill="#0A74FF"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              {/* Tooltip background & text at the top (hugged) */}
              <Rect
                x={activeTooltip.rectX}
                y={4}
                width={activeTooltip.rectWidth}
                height={20}
                rx={5}
                fill={COLORS.primary}
              />
              <SvgText
                x={activeTooltip.textX}
                y={18}
                fontSize="10"
                fontFamily={TYPOGRAPHY.fontBold}
                fill="#FFFFFF"
                textAnchor="middle"
              >
                {activeTooltip.valueText}
              </SvgText>
            </G>
          )}
        </Svg>
        <View
          style={StyleSheet.absoluteFill}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />
      </View>
      <View style={styles.chartLabelsRow}>
        {getFilteredLabels().map((item, i) => (
          <View key={i} style={styles.labelBadge}>
            <Text style={styles.chartLabelText}>{item.label}</Text>
          </View>
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [absoluteLimits, setAbsoluteLimits] = useState<{ max: number; min: number } | null>(null);

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      analytics.trackScreen(ANALYTICS_SCREENS.STATS_NET_WORTH);
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
      // nwAtEnd can be null if baseDate is before the first history anchor
      setSelectedTotalValue(nwAtEnd ?? await NetWorthRepository.getCurrentTotal());
      
      // Calculate net worth history dynamically for each data point
      const nwHistory = await NetWorthRepository.getNetWorthHistory(
        rawTrend,
        timeRange === 'Anno' ? 'monthly' : 'daily'
      );
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const trendPoints = rawTrend.map((point, i) => {
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

        return { ...point, wealth: nwHistory[i], isFuture };
      });
      
      setNetWorthTrend(trendPoints);

      const limits = await NetWorthRepository.getAbsoluteNetWorthLimits();
      setAbsoluteLimits(limits);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getChange = () => {
    if (netWorthTrend.length < 2) return null;
    // Only consider points that have real wealth values
    const activePoints = netWorthTrend.filter(p => !p.isFuture && p.wealth != null);
    if (activePoints.length < 2) return null;
    const endValue = activePoints[activePoints.length - 1].wealth as number;
    const startValue = activePoints[0].wealth as number;
    const change = endValue - startValue;
    const percent = startValue !== 0 ? (change / Math.abs(startValue)) * 100 : 0;
    return { change, percent };
  };

  const changeData = getChange();

  return (
    <View style={styles.container}>
      {/* Header pulito senza banner blu */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.centeredTitle}>Saldo</Text>
        <Pressable onPress={() => {
          Alert.alert(
            'Informazioni Saldo',
            'Questa schermata mostra l\'andamento nel tempo del tuo patrimonio complessivo, calcolato sommando il saldo iniziale e tutte le transazioni registrate. La variazione percentuale indicata a destra è calcolata rispetto all\'inizio del periodo selezionato.'
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

      {/* Info Row: Patrimonio a sinistra, Variazione a destra */}
      {!loading && (
        <View style={styles.topInfoRow}>
          <View>
            <Text style={styles.topInfoValue}>
              € {selectedTotalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {changeData && (
            <View style={[
              styles.changeBadge,
              { backgroundColor: changeData.change >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)' }
            ]}>
              <Text style={[
                styles.topInfoChangeValue,
                { color: changeData.change >= 0 ? '#16A34A' : '#DC2626' }
              ]}>
                {changeData.change >= 0 ? '+' : ''}{changeData.percent.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Overlapping Bottom Sheet - NO border radius */}
      <View style={[
        styles.bottomSection, 
        { 
          marginBottom: 80 + insets.bottom, 
          paddingBottom: 16
        }
      ]}>
        {loading ? (
          <ActivityIndicator size="large" color="#0A74FF" style={{ marginTop: 30 }} />
        ) : (
          <View style={{ flex: 1, width: '100%' }}>
            <WealthChart data={netWorthTrend} labels={
              timeRange === 'Settimana' ? netWorthTrend.map(s => s.label || '') : 
              timeRange === 'Mese' ? netWorthTrend.map(s => s.day?.toString() || '') : 
              timeRange === 'Anno' ? ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'] :
              netWorthTrend.map(s => s.label || '')
            }
            absoluteMax={absoluteLimits?.max}
            absoluteMin={absoluteLimits?.min}
            timeRange={timeRange}
            />
          </View>
        )}
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
    marginHorizontal: 16,
    paddingHorizontal: 0,
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
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
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
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  labelBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  topInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  topInfoValue: {
    fontSize: 28,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  topInfoChangeValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
