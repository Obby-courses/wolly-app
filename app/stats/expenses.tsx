import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Text as SvgText, Line } from 'react-native-svg';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { NetWorthRepository } from '../../services/database/repositories/NetWorthRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import { CATEGORIES_CONFIG, DOMAINS_CONFIG, ALL_CATEGORIES } from '../../constants/categories';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';
import { analytics, ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../services/analytics';
import TransactionPreview from '../../components/TransactionPreview';

const { width } = Dimensions.get('window');

interface DataPoint {
  key: string;
  total: number;
  label: string;
  color: string;
}

interface DistributionCardProps {
  title: string;
  data: DataPoint[];
  selectedKeys: string[];
  onToggleKey: (key: string) => void;
  onReset: () => void;
  emptyMessage: string;
}

const CompactDistributionCard = ({ title, data, selectedKeys, onToggleKey, onReset, emptyMessage }: DistributionCardProps) => {
  const total = data.reduce((acc, curr) => acc + curr.total, 0);
  let startAngle = 0;
  const radius = 65;
  const centerX = 80;
  const centerY = 80;

  const hasData = data.length > 0 && total > 0;

  return (
    <View style={[styles.card, { paddingVertical: 16, paddingHorizontal: 0, marginBottom: 0 }]}>
      <View style={[styles.cardHeader, { marginBottom: 12 }]}>
        <Text style={[styles.cardTitle, { fontSize: 16 }]}>{title}</Text>
        {selectedKeys.length > 0 && (
          <Pressable onPress={onReset}>
            <Text style={[styles.resetFilterText, { fontSize: 12 }]}>Reset</Text>
          </Pressable>
        )}
      </View>
      
      <View style={styles.distContentGrid}>
        <View style={styles.chartContainerCentered}>
          <Svg width="120" height="120" viewBox="0 0 160 160">
            <G transform={`rotate(-90 ${centerX} ${centerY})`}>
              {!hasData ? (
                <Circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#F3F4F6" strokeWidth="25" />
              ) : data.length === 1 ? (
                <Circle 
                  cx={centerX} cy={centerY} r={radius} fill="none" 
                  stroke={data[0].color} strokeWidth="25"
                  opacity={selectedKeys.length === 0 || selectedKeys.includes(data[0].key) ? 1 : 0.3}
                />
              ) : (
                data.map((item, index) => {
                  const percentage = item.total / total;
                  const angle = percentage * 360;
                  const isSelected = selectedKeys.includes(item.key);
                  const x1 = centerX + radius * Math.cos((Math.PI * startAngle) / 180);
                  const y1 = centerY + radius * Math.sin((Math.PI * startAngle) / 180);
                  const x2 = centerX + radius * Math.cos((Math.PI * (startAngle + angle)) / 180);
                  const y2 = centerY + radius * Math.sin((Math.PI * (startAngle + angle)) / 180);
                  const largeArcFlag = angle > 180 ? 1 : 0;
                  const d = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                  startAngle += angle;
                  return (
                    <Path key={index} d={d} fill={item.color} stroke={COLORS.surface} strokeWidth="2"
                      opacity={selectedKeys.length === 0 || isSelected ? 1 : 0.3}
                    />
                  );
                })
              )}
              <Circle cx={centerX} cy={centerY} r="40" fill={COLORS.surface} />
            </G>
          </Svg>
        </View>

        <View style={styles.legendGrid}>
          {!hasData ? (
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 0, width: '100%' }]}>{emptyMessage}</Text>
          ) : (
            data.map((item, index) => {
              const isSelected = selectedKeys.includes(item.key);
              return (
                <Pressable 
                  key={index} 
                  style={[
                    styles.legendGridItem, 
                    isSelected && styles.legendGridItemActive
                  ]}
                  onPress={() => onToggleKey(item.key)}
                >
                  <View style={styles.legendGridItemRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color, marginRight: 6 }]} />
                    <Text style={styles.legendGridText} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                  <Text style={styles.legendGridPerc}>
                    {((item.total / total) * 100).toFixed(0)}% (€{item.total.toFixed(0)})
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const TrendChart = ({ 
  data, 
  labels, 
  absoluteMax, 
  color, 
  timeRange 
}: { 
  data: any[], 
  labels: string[], 
  absoluteMax?: number, 
  color: string, 
  timeRange: string 
}) => {
  if (data.length === 0) return null;

  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const touchStart = React.useRef<number>(0);
  const activeIdxRef = React.useRef<number | null>(null);

  const visiblePoints = data
    .map((d, i) => ({ ...d, originalIndex: i }))
    .filter(d => !d.isFuture && d.value !== null && d.value !== undefined);

  const chartWidth = width - (SPACING.lg * 2);
  const chartHeight = Math.round(SCREEN_HEIGHT * 0.5);
  const safeMargin = 20;

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

  if (visiblePoints.length === 0) {
    return (
      <View style={styles.trendChartContainer}>
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

  const activeValues = visiblePoints.map(d => d.value as number);
  const actualMin = Math.min(...activeValues, 0);
  const actualMax = Math.max(...activeValues);

  const finalAbsoluteMax = absoluteMax !== undefined ? Math.max(absoluteMax, actualMax) : actualMax;
  const finalAbsoluteMin = actualMin;
  const diff = finalAbsoluteMax - finalAbsoluteMin;

  const rangeMargin = diff > 0 ? diff * 0.05 : Math.abs(finalAbsoluteMax) * 0.05 || 10;

  let minVal = finalAbsoluteMin;
  let maxVal = finalAbsoluteMax + rangeMargin;

  const range = maxVal - minVal;
  const horizontalMargin = 28;

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
      if (d?.value != null) {
        const periodLabel = labels[activeIdxRef.current];
        Alert.alert(
          'Dettaglio Periodo',
          `Periodo: ${periodLabel}\nImporto: € ${d.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
      }
    }
    setActiveIdx(null);
    activeIdxRef.current = null;
  };

  let activeTooltip: any = null;
  if (activeIdx !== null && activeIdx < data.length && data[activeIdx]?.value != null) {
    const fallbackLabel = labels[activeIdx];
    const dateStr = data[activeIdx].date;
    const valueText = `€${formatCompactValue(data[activeIdx].value)} (${formatDateLabel(dateStr, timeRange, fallbackLabel)})`;
    const rectWidth = Math.max(46, valueText.length * 7.5 + 12);
    const rawX = getX(activeIdx) - rectWidth / 2;
    const rectX = Math.max(4, Math.min(chartWidth - rectWidth - 4, rawX));
    const textX = rectX + rectWidth / 2;
    activeTooltip = { valueText, rectWidth, rectX, textX };
  }

  if (visiblePoints.length === 1) {
    const singlePoint = visiblePoints[0];
    const cx = chartWidth / 2;
    const cy = chartHeight / 2;

    let singleTooltip: any = null;
    if (activeIdx !== null && data[activeIdx]?.value != null) {
      const fallbackLabel = labels[activeIdx] ?? labels[singlePoint.originalIndex];
      const dateStr = data[activeIdx]?.date ?? singlePoint.date;
      const pointVal = data[activeIdx]?.value ?? singlePoint.value;
      const valueText = `€${formatCompactValue(pointVal)} (${formatDateLabel(dateStr, timeRange, fallbackLabel)})`;
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
      <View style={styles.trendChartContainer}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <Svg width={chartWidth} height={chartHeight}>
            <Line
              x1={cx} y1={safeMargin}
              x2={cx} y2={chartHeight - safeMargin}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4, 6"
              opacity="0.25"
            />
            <Circle cx={cx} cy={cy} r="7" fill={color} stroke="#FFFFFF" strokeWidth="3" />

            {activeIdx !== null && (
              <G>
                <Line
                  x1={cx} y1={safeMargin}
                  x2={cx} y2={chartHeight - safeMargin}
                  stroke={COLORS.secondary}
                  strokeWidth="1.5"
                  strokeDasharray="4, 4"
                />
                <Circle cx={cx} cy={cy} r="8" fill={color} stroke="#FFFFFF" strokeWidth="2.5" />
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

  let pathData = '';
  pathData = `M ${getX(visiblePoints[0].originalIndex)} ${getY(visiblePoints[0].value)}`;
  for (let i = 0; i < visiblePoints.length - 1; i++) {
    const pStart = visiblePoints[i];
    const pEnd = visiblePoints[i + 1];
    const xStart = getX(pStart.originalIndex);
    const yStart = getY(pStart.value);
    const xEnd = getX(pEnd.originalIndex);
    const yEnd = getY(pEnd.value);

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
    <View style={styles.trendChartContainer}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <SvgLinearGradient id="areaGradTrend" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          <Path d={areaData} fill="url(#areaGradTrend)" />
          <Path d={pathData} fill="none" stroke={color} strokeWidth="3" />

          {visiblePoints.length > 0 && lastIdx < data.length - 1 && (() => {
            const lastPoint = visiblePoints[visiblePoints.length - 1];
            const startXCoord = getX(lastPoint.originalIndex);
            const endXCoord = getX(data.length - 1);
            const yCoord = getY(lastPoint.value);
            return (
              <Line
                x1={startXCoord}
                y1={yCoord}
                x2={endXCoord}
                y2={yCoord}
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="4, 4"
                opacity="0.4"
              />
            );
          })()}

          <Circle
            cx={getX(visiblePoints[0].originalIndex)}
            cy={getY(visiblePoints[0].value)}
            r="5"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          <Circle
            cx={getX(visiblePoints[visiblePoints.length - 1].originalIndex)}
            cy={getY(visiblePoints[visiblePoints.length - 1].value)}
            r="5"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {activeIdx !== null && activeIdx < data.length && data[activeIdx]?.value != null && activeTooltip && (
            <G>
              <Line
                x1={getX(activeIdx)}
                y1={safeMargin}
                x2={getX(activeIdx)}
                y2={chartHeight - safeMargin}
                stroke={COLORS.secondary}
                strokeWidth="1.5"
                strokeDasharray="4, 4"
              />
              <Circle
                cx={getX(activeIdx)}
                cy={getY(data[activeIdx].value)}
                r="6"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
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

export default function ExpensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [domainDist, setDomainDist] = useState<DataPoint[]>([]);
  const [catDist, setCatDist] = useState<DataPoint[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [trendPoints, setTrendPoints] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount_asc' | 'amount_desc'>('date');
  const [absoluteLimits, setAbsoluteLimits] = useState<{ max: number; min: number } | null>(null);
  
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'domain' | 'category' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const domainsList = DOMAINS_CONFIG.filter(d => d.direction === 'out');
  const categoriesList = selectedDomain 
    ? DOMAINS_CONFIG.find(d => d.key === selectedDomain)?.categories || []
    : DOMAINS_CONFIG.filter(d => d.direction === 'out').flatMap(d => d.categories);

  const getCategoryLabel = (catKey: string) => {
    const cat = ALL_CATEGORIES.find(c => c.key === catKey);
    return cat ? cat.label : catKey;
  };

  const handleSelectDomain = (domainKey: string) => {
    setSelectedDomain(domainKey);
    setActiveDropdown(null);
    if (selectedCategory) {
      const cat = ALL_CATEGORIES.find(c => c.key === selectedCategory);
      if (!cat || cat.domain_key !== domainKey) {
        setSelectedCategory(null);
      }
    }
  };

  const handleSelectCategory = (catKey: string) => {
    setSelectedCategory(catKey);
    setActiveDropdown(null);
    const cat = ALL_CATEGORIES.find(c => c.key === catKey);
    if (cat) {
      setSelectedDomain(cat.domain_key);
    }
  };

  const handleClearDomain = () => {
    setSelectedDomain(null);
    setSelectedCategory(null);
  };

  const handleClearCategory = () => {
    setSelectedCategory(null);
  };

  const params = useLocalSearchParams();

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      analytics.trackScreen(ANALYTICS_SCREENS.STATS_EXPENSES);
      const initialRange = (params.range as TimeRange) || 'Mese';
      setTimeRange(initialRange);
      setBaseDate(new Date().toISOString().split('T')[0]);
      setSelectedDomain(null);
      setSelectedCategory(null);
      setActiveDropdown(null);
      setSortBy('date');
      setRefreshKey(prev => prev + 1);
    }, [params.range])
  );

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [timeRange, baseDate, selectedDomain, selectedCategory, sortBy, refreshKey]);

  // Track time range changes
  useEffect(() => {
    analytics.trackClick(ANALYTICS_BUTTONS.TIME_FILTER_SELECT, ANALYTICS_SCREENS.STATS_EXPENSES, { range: timeRange });
  }, [timeRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 1. Domain Distribution
      const dData = await TransactionRepository.getDomainDistribution(timeRange, 'out', baseDate);
      setDomainDist(dData.map(item => {
        const config = CATEGORIES_CONFIG.find(c => c.key === item.domain_key);
        return {
          key: item.domain_key,
          total: item.total,
          label: config?.label || item.domain_key,
          color: COLORS.categories[item.domain_key as keyof typeof COLORS.categories] || COLORS.categories.default
        };
      }));

      // 2. Category Distribution (filtered by domain if selected)
      const cData = await TransactionRepository.getCategoryDistribution(timeRange, 'out', baseDate);
      
      let filteredCats = cData;
      if (selectedDomain) {
        filteredCats = cData.filter(item => {
          const cat = ALL_CATEGORIES.find(s => s.key === item.category_key);
          return cat && cat.domain_key === selectedDomain;
        });
      }

      setCatDist(filteredCats.map(item => {
        let label = item.category_key;
        let color = COLORS.primary;
        CATEGORIES_CONFIG.forEach(c => {
          const sub = c.subcategories.find(s => s.key === item.category_key);
          if (sub) {
            label = sub.label;
            color = COLORS.categories[c.key as keyof typeof COLORS.categories] || COLORS.categories.default;
          }
        });
        return { key: item.category_key, total: item.total, label, color };
      }));

      // 3. Transactions
      const txs = await TransactionRepository.getFilteredTransactions(timeRange, {
        direction: 'out',
        domain_keys: selectedDomain ? [selectedDomain] : [],
        category_keys: selectedCategory ? [selectedCategory] : [],
      }, sortBy, baseDate);
      setTransactions(txs);

      // 4. Trend
      const trend = await TransactionRepository.getFilteredTrend(timeRange, 'out', {
        domain_keys: selectedDomain ? [selectedDomain] : [],
        category_keys: selectedCategory ? [selectedCategory] : [],
      }, baseDate);

      const firstDate = await NetWorthRepository.getFirstHistoryDate();
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const processedTrend = trend.map((point) => {
        let isFuture = false;
        if (timeRange === 'Settimana' || timeRange === 'Mese') {
          isFuture = point.date > todayStr;
        } else if (timeRange === 'Anno') {
          const d = new Date(baseDate);
          const selectedYear = d.getFullYear();
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth() + 1;
          if (selectedYear > currentYear) {
            isFuture = true;
          } else if (selectedYear === currentYear) {
            const pointMonth = parseInt(point.date.split('-')[1], 10);
            isFuture = pointMonth > currentMonth;
          }
        } else if (point.date) {
          isFuture = point.date > todayStr;
        }

        let isBeforeDayZero = false;
        if (firstDate) {
          if (timeRange === 'Anno') {
            const firstDateMonthStr = firstDate.slice(0, 7);
            const pointMonthStr = point.date.slice(0, 7);
            isBeforeDayZero = pointMonthStr < firstDateMonthStr;
          } else {
            isBeforeDayZero = point.date < firstDate;
          }
        }

        return {
          ...point,
          value: isBeforeDayZero ? null : point.value,
          isFuture
        };
      });

      setTrendPoints(processedTrend);

      const limits = await TransactionRepository.getAbsoluteTrendLimits(timeRange, 'out', {
        domain_keys: selectedDomain ? [selectedDomain] : [],
        category_keys: selectedCategory ? [selectedCategory] : [],
      });
      setAbsoluteLimits(limits);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };


  return (
    <View style={styles.container}>
      {activeDropdown !== null && (
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={() => setActiveDropdown(null)} 
        />
      )}

      {/* Header pulito senza banner blu */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.centeredTitle}>Spesa</Text>
        <Pressable onPress={() => {
          Alert.alert(
            'Informazioni Spese',
            'Questa schermata offre un\'analisi dettagliata di dove spendi i tuoi soldi, con grafici di andamento e la suddivisione per domini e categorie.'
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

      {/* Filters Row Container */}
      <View style={styles.filterRowContainer}>
        <View style={styles.filtersRow}>
          {/* Dominio Dropdown */}
          <Pressable 
            style={[styles.filterDropdownButton, activeDropdown === 'domain' && styles.filterDropdownButtonActive]} 
            onPress={() => setActiveDropdown(activeDropdown === 'domain' ? null : 'domain')}
          >
            <Text style={styles.filterDropdownButtonText} numberOfLines={1}>
              {selectedDomain ? (domainsList.find(d => d.key === selectedDomain)?.label || selectedDomain) : 'Dominio'}
            </Text>
            {selectedDomain ? (
              <Pressable 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => handleClearDomain()} 
                style={styles.clearFilterIcon}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.primary} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-down" size={16} color={COLORS.secondary} style={styles.dropdownChevron} />
            )}
          </Pressable>

          {/* Categoria Dropdown */}
          <Pressable 
            style={[styles.filterDropdownButton, activeDropdown === 'category' && styles.filterDropdownButtonActive]} 
            onPress={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
          >
            <Text style={styles.filterDropdownButtonText} numberOfLines={1}>
              {selectedCategory ? getCategoryLabel(selectedCategory) : 'Categoria'}
            </Text>
            {selectedCategory ? (
              <Pressable 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => handleClearCategory()} 
                style={styles.clearFilterIcon}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.primary} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-down" size={16} color={COLORS.secondary} style={styles.dropdownChevron} />
            )}
          </Pressable>
        </View>

        {/* Dropdown menus (tende) */}
        {activeDropdown === 'domain' && (
          <View style={styles.tendaContainer}>
            <ScrollView style={styles.tendaScroll} nestedScrollEnabled={true}>
              {domainsList.map((domain) => (
                <Pressable
                  key={domain.key}
                  style={[styles.tendaItem, selectedDomain === domain.key && styles.tendaItemActive]}
                  onPress={() => handleSelectDomain(domain.key)}
                >
                  <Text style={[styles.tendaItemText, selectedDomain === domain.key && styles.tendaItemTextActive]}>
                    {domain.label}
                  </Text>
                  {selectedDomain === domain.key && (
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {activeDropdown === 'category' && (
          <View style={styles.tendaContainer}>
            <ScrollView style={styles.tendaScroll} nestedScrollEnabled={true}>
              {categoriesList.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[styles.tendaItem, selectedCategory === cat.key && styles.tendaItemActive]}
                  onPress={() => handleSelectCategory(cat.key)}
                >
                  <Text style={[styles.tendaItemText, selectedCategory === cat.key && styles.tendaItemTextActive]}>
                    {cat.label}
                  </Text>
                  {selectedCategory === cat.key && (
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Overlapping Bottom Sheet - NO border radius */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 64 }]}>
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={true}>
          {loading && transactions.length === 0 ? (
            <ActivityIndicator size="large" color="#0A74FF" style={{ marginTop: 50 }} />
          ) : (
            <View style={loading && { opacity: 0.6 }}>
              {/* Spesa Totale del Periodo */}
              <View style={styles.totalPeriodCard}>
                <Text style={styles.totalPeriodLabel}>Spesa totale del periodo</Text>
                <Text style={styles.totalPeriodValue}>
                  - € {transactions.reduce((acc, tx) => acc + tx.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Trend Chart */}
              <View style={[styles.card, { paddingVertical: 10, paddingHorizontal: 0, marginBottom: 10 }]}>
                <View style={[styles.cardHeader, { marginBottom: 6 }]}>
                  <Text style={[styles.cardTitle, { fontSize: 16 }]}>Andamento Temporale</Text>
                  <Ionicons name="trending-down-outline" size={18} color={COLORS.danger} />
                </View>
                <TrendChart 
                  data={trendPoints} 
                  labels={
                    timeRange === 'Anno' 
                      ? ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'] 
                      : trendPoints.map(s => s.label || '')
                  }
                  absoluteMax={absoluteLimits?.max}
                  color={COLORS.danger}
                  timeRange={timeRange}
                />
              </View>

              {/* Stacked distributions */}
              <View style={{ gap: 10, marginBottom: 10 }}>
                <CompactDistributionCard 
                  title="Domini"
                  data={domainDist}
                  selectedKeys={selectedDomain ? [selectedDomain] : []}
                  onToggleKey={(key) => {
                    if (selectedDomain === key) {
                      handleClearDomain();
                    } else {
                      handleSelectDomain(key);
                    }
                  }}
                  onReset={handleClearDomain}
                  emptyMessage="Nessun dato"
                />

                <CompactDistributionCard 
                  title="Categorie"
                  data={catDist}
                  selectedKeys={selectedCategory ? [selectedCategory] : []}
                  onToggleKey={(key) => {
                    if (selectedCategory === key) {
                      handleClearCategory();
                    } else {
                      handleSelectCategory(key);
                    }
                  }}
                  onReset={handleClearCategory}
                  emptyMessage={selectedDomain ? "Vuoto" : "Seleziona macro"}
                />
              </View>

              {/* Transaction List */}
              <View style={[styles.card, { paddingVertical: 16, paddingHorizontal: 0, marginBottom: 0 }]}>
                <View style={[styles.cardHeader, { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                  <Text style={[styles.cardTitle, { fontSize: 16 }]}>Tutti i Movimenti</Text>
                  <Ionicons name="list-outline" size={20} color={COLORS.secondary} />
                </View>

                {transactions.length === 0 ? (
                  <Text style={[styles.emptyText, { fontSize: 13, marginTop: 6 }]}>Nessuna transazione trovata</Text>
                ) : (
                  transactions.map((tx) => (
                    <TransactionPreview
                      key={tx.id}
                      item={tx}
                      onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })}
                    />
                  ))
                )}
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
    paddingBottom: 60,
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
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  resetFilterText: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  distContentGrid: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
  },
  chartContainerCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginTop: 10,
  },
  legendGridItem: {
    width: '33.33%',
    padding: 6,
    borderRadius: 10,
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  legendGridItemActive: {
    backgroundColor: '#F3F4F6',
  },
  legendGridItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  legendGridText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    flex: 1,
  },
  legendGridPerc: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    paddingLeft: 14,
    marginTop: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.secondary,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 10,
  },
  chartLabelText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  txItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  txMeta: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 4,
  },
  txAmount: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  txIn: {
    color: COLORS.success,
  },
  txOut: {
    color: COLORS.danger,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalPeriodCard: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalPeriodLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  totalPeriodValue: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.danger,
  },
  trendChartContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  chartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 6,
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
  filterRowContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    zIndex: 100,
    position: 'relative',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterDropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterDropdownButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  filterDropdownButtonText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    flex: 1,
    marginRight: 4,
  },
  dropdownChevron: {
    marginLeft: 2,
  },
  clearFilterIcon: {
    padding: 2,
  },
  tendaContainer: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 101,
    ...SHADOWS.medium,
  },
  tendaScroll: {
    paddingVertical: 4,
  },
  tendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tendaItemActive: {
    backgroundColor: '#F3F4F6',
  },
  tendaItemText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  tendaItemTextActive: {
    fontFamily: TYPOGRAPHY.fontBold,
  },
});
