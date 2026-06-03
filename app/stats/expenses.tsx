import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import { CATEGORIES_CONFIG } from '../../constants/categories';
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

const SimpleTrendChart = ({ data, color }: { data: any[], color: string }) => {
  if (data.length === 0) return (
    <View style={[styles.emptyChart, { height: 100 }]}>
      <Text style={[styles.emptyText, { marginTop: 0, fontSize: 13 }]}>Dati insufficienti</Text>
    </View>
  );

  const chartWidth = width - (SPACING.lg * 4) - 20;
  const chartHeight = 100;
  const maxVal = Math.max(...data.map(d => d.value), 1) * 1.05;

  const totalBars = data.length;
  const barGap = totalBars > 15 ? 3 : 6;
  const totalGaps = totalBars - 1;
  let barWidth = (chartWidth - (totalGaps * barGap)) / totalBars;
  if (barWidth > 24) barWidth = 24;

  const totalChartContentWidth = (totalBars * barWidth) + (totalGaps * barGap);
  const startX = (chartWidth - totalChartContentWidth) / 2;

  const getBarHeight = (v: number) => {
    if (maxVal === 0) return 0;
    const usableHeight = chartHeight - 8;
    return Math.max(v > 0 ? 3 : 0, (v / maxVal) * usableHeight);
  };

  return (
    <View style={{ height: 125, marginTop: 10 }}>
      <Svg width={chartWidth} height={chartHeight + 20}>
        {data.map((d, i) => {
          const x = startX + i * (barWidth + barGap);
          const h = getBarHeight(d.value);
          const y = chartHeight - h;
          const roundedRadius = Math.min(barWidth / 2, 4);

          return (
            <G key={i}>
              {/* Barra Visibile */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={roundedRadius}
                ry={roundedRadius}
                fill={color}
              />
              {/* Target di tocco invisibile allargato per una UX perfetta */}
              <Rect
                x={x - 2}
                y={0}
                width={barWidth + 4}
                height={chartHeight}
                fill="transparent"
                onPress={() => {
                  analytics.trackClick(ANALYTICS_BUTTONS.CHART_BAR_CLICK, ANALYTICS_SCREENS.STATS_EXPENSES, { period: d.label, amount: d.value });
                  Alert.alert(
                    'Dettaglio Spesa',
                    `Periodo: ${d.label}\nSpesa Totale: € ${d.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  );
                }}
              />
            </G>
          );
        })}

        {/* Etichetta Estrema Sinistra */}
        <SvgText
          x={startX + barWidth / 2}
          y={chartHeight + 16}
          fontSize={10}
          fontFamily={TYPOGRAPHY.fontBold}
          fill={COLORS.secondary}
          textAnchor={totalBars === 1 ? 'middle' : (startX < 30 ? 'start' : 'middle')}
        >
          {data[0]?.label}
        </SvgText>

        {/* Etichetta Estrema Destra */}
        {totalBars > 1 && (
          <SvgText
            x={startX + (totalBars - 1) * (barWidth + barGap) + barWidth / 2}
            y={chartHeight + 16}
            fontSize={10}
            fontFamily={TYPOGRAPHY.fontBold}
            fill={COLORS.secondary}
            textAnchor={(chartWidth - (startX + totalChartContentWidth)) < 30 ? 'end' : 'middle'}
          >
            {data[data.length - 1]?.label}
          </SvgText>
        )}
      </Svg>
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
  
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      analytics.trackScreen(ANALYTICS_SCREENS.STATS_EXPENSES);
      setTimeRange('Mese');
      setBaseDate(new Date().toISOString().split('T')[0]);
      setSelectedDomains([]);
      setSelectedCategories([]);
      setSortBy('date');
    }, [])
  );

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [timeRange, baseDate, selectedDomains, selectedCategories, sortBy]);

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
      if (selectedDomains.length > 0) {
        filteredCats = cData.filter(item => {
          const cat = CATEGORIES_CONFIG.flatMap(d => d.subcategories.map(s => ({...s, domainKey: d.key})))
            .find(s => s.key === item.category_key);
          return cat && selectedDomains.includes(cat.domainKey);
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
        domain_keys: selectedDomains,
        category_keys: selectedCategories,
      }, sortBy, baseDate);
      setTransactions(txs);

      // 4. Trend
      const trend = await TransactionRepository.getFilteredTrend(timeRange, 'out', {
        domain_keys: selectedDomains,
        category_keys: selectedCategories,
      }, baseDate);
      setTrendPoints(trend);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleToggleDomain = (key: string) => {
    let nextDomains: string[];
    if (selectedDomains.includes(key)) {
      nextDomains = selectedDomains.filter(d => d !== key);
    } else {
      nextDomains = [...selectedDomains, key];
    }
    setSelectedDomains(nextDomains);

    // Clean up category filters that don't belong to selected domains
    if (nextDomains.length > 0) {
      setSelectedCategories(prev => prev.filter(catKey => {
        const cat = CATEGORIES_CONFIG.flatMap(d => d.subcategories.map(s => ({...s, domainKey: d.key})))
          .find(s => s.key === catKey);
        return cat && nextDomains.includes(cat.domainKey);
      }));
    } else {
      setSelectedCategories([]);
    }
  };

  const handleToggleCategory = (key: string) => {
    if (selectedCategories.includes(key)) {
      setSelectedCategories(selectedCategories.filter(c => c !== key));
    } else {
      setSelectedCategories([...selectedCategories, key]);
    }
  };

  const handleResetDomains = () => {
    setSelectedDomains([]);
    setSelectedCategories([]);
  };

  const handleResetCategories = () => {
    setSelectedCategories([]);
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
          <Text style={styles.title}>Spesa</Text>
        </View>
        <Text style={styles.subtitle}>Analizza l'andamento delle tue uscite</Text>
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
                <SimpleTrendChart data={trendPoints} color={COLORS.danger} />
              </View>

              {/* Stacked distributions */}
              <View style={{ gap: 10, marginBottom: 10 }}>
                <CompactDistributionCard 
                  title="Domini"
                  data={domainDist}
                  selectedKeys={selectedDomains}
                  onToggleKey={handleToggleDomain}
                  onReset={handleResetDomains}
                  emptyMessage="Nessun dato"
                />

                <CompactDistributionCard 
                  title="Categorie"
                  data={catDist}
                  selectedKeys={selectedCategories}
                  onToggleKey={handleToggleCategory}
                  onReset={handleResetCategories}
                  emptyMessage={selectedDomains.length > 0 ? "Vuoto" : "Seleziona macro"}
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
});
