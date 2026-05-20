import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH;
const CHART_HEIGHT = 280;
const SAFE_MARGIN = SPACING.lg; 

interface DataPoint {
  income: number;
  expense: number;
  netWorth?: number;
  label?: string;
}

interface AnnualChartProps {
  data: DataPoint[];
  previousData?: DataPoint[];
  title: string;
  labels?: string[];
  showNetWorth?: boolean;
  height?: number;
}

export default function AnnualChart({ data, previousData, title, labels, showNetWorth, height = 280 }: AnnualChartProps) {
  if (data.length === 0) return null;

  // Trova il valore massimo considerando anche il periodo precedente e il tipo di dato
  const allPoints = [...data, ...(previousData || [])];
  const absoluteMax = Math.max(...allPoints.map(d => 
    showNetWorth ? (d.netWorth || 0) : Math.max(d.income, d.expense)
  ), 0);
  
  // Per il patrimonio, consideriamo anche il minimo per scalare meglio se i valori sono tutti alti
  const absoluteMin = showNetWorth 
    ? Math.min(...allPoints.map(d => d.netWorth || 0))
    : 0;
    
  const range = absoluteMax - absoluteMin;
  const maxVal = showNetWorth ? absoluteMax : (absoluteMax + (range * 0.1 || absoluteMax * 0.1 || 100));
  const minVal = showNetWorth ? absoluteMin : 0;

  const pointsCount = Math.max(data.length, previousData?.length || 0);
  const denominator = pointsCount > 1 ? pointsCount - 1 : 1;

  // Calcola le coordinate per i punti con margine di sicurezza
  const getX = (index: number, count: number) => {
    const usableWidth = CHART_WIDTH - (SAFE_MARGIN * 2);
    const currentDenominator = count > 1 ? count - 1 : 1;
    return (index * usableWidth / currentDenominator) + SAFE_MARGIN;
  };
  
  const VERTICAL_PADDING = 4; // Padding per evitare che lo stroke venga tagliato
  
  const getY = (value: number) => {
    const usableHeight = height - (VERTICAL_PADDING * 2);
    const effectiveMax = maxVal - minVal;
    const effectiveValue = value - minVal;
    
    if (effectiveMax === 0) return height / 2;
    return (height - VERTICAL_PADDING) - (effectiveValue / effectiveMax) * usableHeight;
  };

  // Costruisci il path per le linee
  const createPath = (dataset: DataPoint[], field: 'income' | 'expense' | 'netWorth') => {
    return dataset.map((stat, i) => {
      const x = getX(i, dataset.length);
      const y = getY(stat[field] || 0);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const incomePath = !showNetWorth ? createPath(data, 'income') : null;
  const expensePath = !showNetWorth ? createPath(data, 'expense') : null;
  const netWorthPath = showNetWorth ? createPath(data, 'netWorth') : null;
  
  const prevIncomePath = (previousData && !showNetWorth) ? createPath(previousData, 'income') : null;
  const prevExpensePath = (previousData && !showNetWorth) ? createPath(previousData, 'expense') : null;
  const prevNetWorthPath = (previousData && showNetWorth) ? createPath(previousData, 'netWorth') : null;

  // Determina quali label mostrare
  const displayLabels = labels || data.map((_, i) => (i + 1).toString());
  const labelStep = Math.max(1, Math.floor(displayLabels.length / 10));

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height: height }]}>
        <Svg width={CHART_WIDTH} height={height}>
          {/* Griglie */}
          <Line x1={SAFE_MARGIN} y1={VERTICAL_PADDING} x2={CHART_WIDTH - SAFE_MARGIN} y2={VERTICAL_PADDING} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4" />
          <Line x1={SAFE_MARGIN} y1={height / 2} x2={CHART_WIDTH - SAFE_MARGIN} y2={height / 2} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4" />
          <Line x1={SAFE_MARGIN} y1={height - VERTICAL_PADDING} x2={CHART_WIDTH - SAFE_MARGIN} y2={height - VERTICAL_PADDING} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4" />

          {/* Linee periodo precedente (Sottili) */}
          {prevExpensePath && <Path d={prevExpensePath} fill="none" stroke={COLORS.danger} strokeWidth="1" strokeOpacity={0.3} strokeLinejoin="round" strokeLinecap="round" />}
          {prevIncomePath && <Path d={prevIncomePath} fill="none" stroke={COLORS.success} strokeWidth="1" strokeOpacity={0.3} strokeLinejoin="round" strokeLinecap="round" />}
          {prevNetWorthPath && <Path d={prevNetWorthPath} fill="none" stroke={COLORS.accent} strokeWidth="1" strokeOpacity={0.3} strokeLinejoin="round" strokeLinecap="round" />}

          {/* Linee periodo attuale (Bold) */}
          {expensePath && <Path d={expensePath} fill="none" stroke={COLORS.danger} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
          {incomePath && <Path d={incomePath} fill="none" stroke={COLORS.success} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
          {netWorthPath && <Path d={netWorthPath} fill="none" stroke={COLORS.accent} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
        </Svg>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xl,
  },
  chartTitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  chartArea: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yAxisLabels: {
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingRight: 6,
    width: 45,
    paddingVertical: 0,
    marginTop: -6, // Compensa l'altezza del testo per allineare il centro alla linea
  },
  yLabel: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textAlign: 'right',
    height: 12,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: CHART_WIDTH - 55,
    marginTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 45,
  },
  monthLabel: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textAlign: 'center',
    width: 25,
  },
  legend: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    justifyContent: 'center',
    gap: SPACING.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineSymbol: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  }
});
