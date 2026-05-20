import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { TransactionRepository } from '../../services/database/repositories/TransactionRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../../constants/Theme';
import { CATEGORIES_CONFIG } from '../../constants/categories';
import TimeFilter, { TimeRange } from '../../components/TimeFilter';

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
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  emptyMessage: string;
}

const CompactDistributionCard = ({ title, data, selectedKey, onSelect, emptyMessage }: DistributionCardProps) => {
  const total = data.reduce((acc, curr) => acc + curr.total, 0);
  let startAngle = 0;
  const radius = 65;
  const centerX = 80;
  const centerY = 80;

  const hasData = data.length > 0 && total > 0;

  return (
    <View style={[styles.card, { padding: 16, marginBottom: 0 }]}>
      <View style={[styles.cardHeader, { marginBottom: 12 }]}>
        <Text style={[styles.cardTitle, { fontSize: 16 }]}>{title}</Text>
        {selectedKey && (
          <Pressable onPress={() => onSelect(null)}>
            <Text style={[styles.resetFilterText, { fontSize: 12 }]}>Reset</Text>
          </Pressable>
        )}
      </View>
      
      <View style={styles.distContentCompact}>
        <Svg width="100" height="100" viewBox="0 0 160 160">
          <G transform={`rotate(-90 ${centerX} ${centerY})`}>
            {!hasData ? (
              <Circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#F3F4F6" strokeWidth="25" />
            ) : data.length === 1 ? (
              <Circle 
                cx={centerX} cy={centerY} r={radius} fill="none" 
                stroke={data[0].color} strokeWidth="25"
                opacity={!selectedKey || selectedKey === data[0].key ? 1 : 0.3}
              />
            ) : (
              data.map((item, index) => {
                const percentage = item.total / total;
                const angle = percentage * 360;
                const isSelected = selectedKey === item.key;
                const x1 = centerX + radius * Math.cos((Math.PI * startAngle) / 180);
                const y1 = centerY + radius * Math.sin((Math.PI * startAngle) / 180);
                const x2 = centerX + radius * Math.cos((Math.PI * (startAngle + angle)) / 180);
                const y2 = centerY + radius * Math.sin((Math.PI * (startAngle + angle)) / 180);
                const largeArcFlag = angle > 180 ? 1 : 0;
                const d = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                startAngle += angle;
                return (
                  <Path key={index} d={d} fill={item.color} stroke={COLORS.surface} strokeWidth="2"
                    opacity={!selectedKey || isSelected ? 1 : 0.3}
                  />
                );
              })
            )}
            <Circle cx={centerX} cy={centerY} r="40" fill={COLORS.surface} />
          </G>
        </Svg>

        <View style={styles.legendSideCompact}>
          {!hasData ? (
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 0 }]}>{emptyMessage}</Text>
          ) : (
            data.map((item, index) => {
              const isSelected = selectedKey === item.key;
              return (
                <Pressable 
                  key={index} 
                  style={[styles.legendItemCompact, isSelected && styles.legendItemActive, { paddingVertical: 6, paddingHorizontal: 8, marginVertical: 2, flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => onSelect(isSelected ? null : item.key)}
                >
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.legendText, { fontSize: 13 }]} numberOfLines={1}>{item.label}</Text>
                    <Text style={[styles.legendPerc, { fontSize: 11 }]}>{((item.total / total) * 100).toFixed(0)}% (€{item.total.toFixed(0)})</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="close-circle" size={16} color={COLORS.secondary} style={{ marginLeft: 4 }} />
                  )}
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
  const getX = (i: number) => (i * chartWidth / Math.max(1, data.length - 1));
  const getY = (v: number) => chartHeight - (v / maxVal) * chartHeight;
  
  const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');
  const areaData = `${pathData} L ${getX(data.length - 1)} ${chartHeight} L ${getX(0)} ${chartHeight} Z`;

  return (
    <View style={{ height: 125, marginTop: 10 }}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.00" />
          </SvgLinearGradient>
        </Defs>
        <Path d={areaData} fill="url(#chartGrad)" />
        <Path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.length < 31 && data.map((d, i) => (
          <Circle key={i} cx={getX(i)} cy={getY(d.value)} r="3.5" fill={color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 }}>
        <Text style={[styles.chartLabelText, { fontSize: 10, fontFamily: TYPOGRAPHY.fontBold }]}>{data[0]?.label}</Text>
        <Text style={[styles.chartLabelText, { fontSize: 10, fontFamily: TYPOGRAPHY.fontBold }]}>{data[data.length-1]?.label}</Text>
      </View>
    </View>
  );
};

export default function IncomesScreen() {
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
  
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Automatic reset when entering the screen
  useFocusEffect(
    useCallback(() => {
      setTimeRange('Mese');
      setBaseDate(new Date().toISOString().split('T')[0]);
      setSelectedDomain(null);
      setSelectedCategory(null);
      setSortBy('date');
    }, [])
  );

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [timeRange, baseDate, selectedDomain, selectedCategory, sortBy]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 1. Domain Distribution
      const dData = await TransactionRepository.getDomainDistribution(timeRange, 'in', baseDate);
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
      const cData = await TransactionRepository.getCategoryDistribution(timeRange, 'in', baseDate);
      
      let filteredCats = cData;
      if (selectedDomain) {
        filteredCats = cData.filter(item => {
          const cat = CATEGORIES_CONFIG.flatMap(d => d.subcategories.map(s => ({...s, domainKey: d.key})))
            .find(s => s.key === item.category_key);
          return cat?.domainKey === selectedDomain;
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
        direction: 'in',
        domain_key: selectedDomain || undefined,
        category_key: selectedCategory || undefined,
      }, sortBy, baseDate);
      setTransactions(txs);

      // 4. Trend
      const trend = await TransactionRepository.getFilteredTrend(timeRange, 'in', {
        category_key: selectedCategory || undefined,
      }, baseDate);
      setTrendPoints(trend);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSelectDomain = (key: string | null) => {
    setSelectedDomain(key);
  };

  const handleSelectCategory = (key: string | null) => {
    setSelectedCategory(key);
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
          <Text style={styles.title}>Entrate</Text>
        </View>
        <Text style={styles.subtitle}>Analizza l'andamento delle tue entrate</Text>
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
          {loading ? <ActivityIndicator size="large" color="#0A74FF" style={{ marginTop: 50 }} /> : (
            <>
              {/* Trend Chart */}
              <View style={[styles.card, { padding: 10, marginBottom: 10 }]}>
                <View style={[styles.cardHeader, { marginBottom: 6 }]}>
                  <Text style={[styles.cardTitle, { fontSize: 16 }]}>Andamento Temporale</Text>
                  <Ionicons name="trending-up-outline" size={18} color={COLORS.success} />
                </View>
                <SimpleTrendChart data={trendPoints} color={COLORS.success} />
              </View>

              {/* Stacked distributions */}
              <View style={{ gap: 10, marginBottom: 10 }}>
                <CompactDistributionCard 
                  title="Domini (Macro)"
                  data={domainDist}
                  selectedKey={selectedDomain}
                  onSelect={handleSelectDomain}
                  emptyMessage="Nessun dato"
                />

                <CompactDistributionCard 
                  title="Categorie"
                  data={catDist}
                  selectedKey={selectedCategory}
                  onSelect={handleSelectCategory} 
                  emptyMessage={selectedDomain ? "Vuoto" : "Seleziona macro"}
                />
              </View>

              {/* Transaction List */}
              <View style={[styles.card, { padding: 16, marginBottom: 0 }]}>
                <View style={[styles.cardHeader, { marginBottom: 8 }]}>
                  <Text style={[styles.cardTitle, { fontSize: 16 }]}>Tutti i Movimenti</Text>
                </View>

                {transactions.length === 0 ? (
                  <Text style={[styles.emptyText, { fontSize: 13, marginTop: 6 }]}>Nessuna transazione trovata</Text>
                ) : (
                  transactions.map((tx, idx) => (
                    <Pressable 
                      key={tx.id} 
                      style={({ pressed }) => [
                        styles.txItemCompact, 
                        idx === transactions.length - 1 && { borderBottomWidth: 0 },
                        pressed && { backgroundColor: '#F3F4F6' }
                      ]}
                      onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })}
                    >
                      <View style={styles.txInfo}>
                        <Text style={[styles.txDesc, { fontSize: 15 }]} numberOfLines={1}>{tx.description || 'Senza descrizione'}</Text>
                        <Text style={[styles.txMeta, { fontSize: 11, marginTop: 2 }]}>{tx.date} • {tx.subcategory_key.replace('_', ' ')}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.txAmount, { fontSize: 15 }, tx.direction === 'in' ? styles.txIn : styles.txOut]}>
                          {tx.direction === 'in' ? '+' : '-'} € {tx.amount.toFixed(0)}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.border} style={{ marginLeft: 6 }} />
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            </>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
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
  distContentCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legendSideCompact: {
    flex: 1,
  },
  legendItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  legendItemActive: {
    backgroundColor: '#F3F4F6',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  legendPerc: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
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
});
