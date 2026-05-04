import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path, Circle } from 'react-native-svg';
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

const DistributionCard = ({ title, data, selectedKey, onSelect, emptyMessage }: DistributionCardProps) => {
  const total = data.reduce((acc, curr) => acc + curr.total, 0);
  let startAngle = 0;
  const radius = 65;
  const centerX = 80;
  const centerY = 80;

  const hasData = data.length > 0 && total > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {selectedKey && (
          <Pressable onPress={() => onSelect(null)}>
            <Text style={styles.resetFilterText}>Annulla filtro</Text>
          </Pressable>
        )}
      </View>
      
      <View style={styles.distContent}>
        <View style={styles.pieSide}>
          <Svg width="160" height="160" viewBox="0 0 160 160">
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
        </View>

        <View style={styles.legendSide}>
          {!hasData ? (
            <View style={styles.emptyLegend}>
              <Ionicons name="alert-circle-outline" size={20} color={COLORS.border} />
              <Text style={[styles.emptyText, { marginTop: 4, fontSize: 10 }]}>{emptyMessage}</Text>
            </View>
          ) : (
            data.slice(0, 5).map((item, index) => {
              const isSelected = selectedKey === item.key;
              return (
                <Pressable 
                  key={index} 
                  style={[styles.legendItem, isSelected && styles.legendItemActive]}
                  onPress={() => onSelect(isSelected ? null : item.key)}
                >
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <View style={styles.legendTextWrapper}>
                    <Text style={styles.legendText} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.legendPerc}>{((item.total / total) * 100).toFixed(1)}%</Text>
                  </View>
                  <Text style={styles.legendValue}>€{item.total.toFixed(0)}</Text>
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
      <Text style={styles.emptyText}>Dati insufficienti per il grafico</Text>
    </View>
  );
  const chartWidth = width - (SPACING.lg * 4) - 20;
  const chartHeight = 80;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const getX = (i: number) => (i * chartWidth / Math.max(1, data.length - 1));
  const getY = (v: number) => chartHeight - (v / maxVal) * chartHeight;
  
  const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');

  return (
    <View style={{ height: 100, marginTop: 10 }}>
      <Svg width={chartWidth} height={chartHeight}>
        <Path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <Circle key={i} cx={getX(i)} cy={getY(d.value)} r="3" fill={color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={styles.chartLabelText}>{data[0]?.label}</Text>
        <Text style={styles.chartLabelText}>{data[data.length-1]?.label}</Text>
      </View>
    </View>
  );
};

export default function IncomesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [catDist, setCatDist] = useState<DataPoint[]>([]);
  const [subDist, setSubDist] = useState<DataPoint[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [trendPoints, setTrendPoints] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount_asc' | 'amount_desc'>('date');
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [timeRange, baseDate, selectedCategory, selectedSubcategory, sortBy])
  );

  const loadStats = async () => {
    setLoading(true);
    try {
      let filteredCatKey: string | undefined = undefined;
      if (selectedSubcategory) {
        CATEGORIES_CONFIG.forEach(c => {
          if (c.subcategories.find(s => s.key === selectedSubcategory)) {
            filteredCatKey = c.key;
          }
        });
      }

      // 1. Distribution (Direction: 'in')
      const cData = await TransactionRepository.getCategoryDistribution(timeRange, 'in', baseDate);
      let catPoints = cData.map(item => {
        const config = CATEGORIES_CONFIG.find(c => c.key === item.category_key);
        return {
          key: item.category_key,
          total: item.total,
          label: config?.label || item.category_key,
          color: COLORS.categories[item.category_key as keyof typeof COLORS.categories] || COLORS.categories.default
        };
      });
      if (filteredCatKey) setSelectedCategory(filteredCatKey); 
      setCatDist(catPoints);

      const sData = await TransactionRepository.getSubcategoryDistribution(timeRange, 'in', selectedCategory || undefined, baseDate);
      setSubDist(sData.map(item => {
         let label = item.subcategory_key;
         let color = COLORS.primary;
         CATEGORIES_CONFIG.forEach(c => {
           const sub = c.subcategories.find(s => s.key === item.subcategory_key);
           if (sub) {
             label = sub.label;
             color = COLORS.categories[c.key as keyof typeof COLORS.categories] || COLORS.categories.default;
           }
         });
         return { key: item.subcategory_key, total: item.total, label, color };
      }));

      // 2. Transactions
      const txs = await TransactionRepository.getFilteredTransactions(timeRange, {
        direction: 'in',
        category_key: selectedCategory || undefined,
        subcategory_key: selectedSubcategory || undefined
      }, sortBy, baseDate);
      setTransactions(txs);

      // 3. Trend
      const trend = await TransactionRepository.getFilteredTrend(timeRange, 'in', {
        category_key: selectedCategory || undefined,
        subcategory_key: selectedSubcategory || undefined
      }, baseDate);
      setTrendPoints(trend);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSelectCategory = (key: string | null) => {
    setSelectedCategory(key);
    setSelectedSubcategory(null);
  };

  const handleSelectSubcategory = (key: string | null) => {
    setSelectedSubcategory(key);
    if (key === null) setSelectedCategory(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.title}>Entrate</Text>
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
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Andamento Temporale</Text>
              <SimpleTrendChart data={trendPoints} color={COLORS.success} />
            </View>

            <DistributionCard 
              title="Fonti di Entrata"
              data={catDist}
              selectedKey={selectedCategory}
              onSelect={handleSelectCategory}
              emptyMessage="Nessuna entrata registrata"
            />

            <DistributionCard 
              title="Dettaglio Fonti"
              data={subDist}
              selectedKey={selectedSubcategory}
              onSelect={handleSelectSubcategory} 
              emptyMessage={selectedCategory ? "Nessun dettaglio in questo periodo" : "Tutte le entrate"}
            />

            {/* Transaction List */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Movimenti in Entrata</Text>
                <View style={styles.sortContainer}>
                  <Pressable onPress={() => setSortBy('date')} style={[styles.sortBtn, sortBy === 'date' && styles.sortBtnActive]}>
                    <Ionicons name="time-outline" size={16} color={sortBy === 'date' ? '#FFF' : COLORS.secondary} />
                  </Pressable>
                  <Pressable onPress={() => setSortBy('amount_desc')} style={[styles.sortBtn, sortBy === 'amount_desc' && styles.sortBtnActive]}>
                    <Ionicons name="trending-up-outline" size={16} color={sortBy === 'amount_desc' ? '#FFF' : COLORS.secondary} />
                  </Pressable>
                  <Pressable onPress={() => setSortBy('amount_asc')} style={[styles.sortBtn, sortBy === 'amount_asc' && styles.sortBtnActive]}>
                    <Ionicons name="trending-down-outline" size={16} color={sortBy === 'amount_asc' ? '#FFF' : COLORS.secondary} />
                  </Pressable>
                </View>
              </View>

              {transactions.length === 0 ? (
                <Text style={styles.emptyText}>Nessuna entrata trovata</Text>
              ) : (
                transactions.map((tx, idx) => (
                  <View key={tx.id} style={[styles.txItem, idx === transactions.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.txInfo}>
                      <Text style={styles.txDesc} numberOfLines={1}>{tx.description || 'Entrata generica'}</Text>
                      <Text style={styles.txMeta}>{tx.date} • {tx.subcategory_key}</Text>
                    </View>
                    <Text style={[styles.txAmount, styles.txIn]}>
                      + € {tx.amount.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.sizes.lg, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  resetFilterText: { color: COLORS.accent, fontSize: TYPOGRAPHY.sizes.xs, fontFamily: TYPOGRAPHY.fontBold },
  distContent: { flexDirection: 'row', alignItems: 'center' },
  pieSide: { width: 140, alignItems: 'center' },
  legendSide: { flex: 1, marginLeft: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8 },
  legendItemActive: { backgroundColor: '#F3F4F6' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendTextWrapper: { flex: 1 },
  legendText: { fontSize: 11, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  legendPerc: { fontSize: 9, fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.secondary },
  legendValue: { fontSize: 11, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary, marginLeft: 4 },
  emptyLegend: { alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  emptyText: { textAlign: 'center', color: COLORS.secondary, fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontFamily, marginTop: 10 },
  sortContainer: { flexDirection: 'row', gap: 8 },
  sortBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sortBtnActive: { backgroundColor: COLORS.primary },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  txMeta: { fontSize: 11, color: COLORS.secondary, marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: TYPOGRAPHY.fontBold },
  txIn: { color: COLORS.success },
  txOut: { color: COLORS.danger }
});
