import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - (SPACING.lg * 4);
const CHART_HEIGHT = 160;
const SAFE_MARGIN = 10; // Margine interno per evitare che i punti tocchino i bordi

interface DataPoint {
  income: number;
  expense: number;
  label?: string;
}

interface AnnualChartProps {
  data: DataPoint[];
  title: string;
  labels?: string[];
}

export default function AnnualChart({ data, title, labels }: AnnualChartProps) {
  if (data.length === 0) return null;

  // Trova il valore massimo e aggiungi un margine del 25% sopra
  const absoluteMax = Math.max(...data.map(d => Math.max(d.income, d.expense)), 0);
  const maxVal = absoluteMax === 0 ? 100 : absoluteMax * 1.25;

  const pointsCount = data.length;
  const denominator = pointsCount > 1 ? pointsCount - 1 : 1;

  // Calcola le coordinate per i punti con margine di sicurezza
  const getX = (index: number) => {
    const usableWidth = CHART_WIDTH - 55; // Ridotto da 80 per dare più spazio
    return (index * (usableWidth - SAFE_MARGIN * 2) / denominator) + SAFE_MARGIN;
  };
  const getY = (value: number) => {
    const usableHeight = CHART_HEIGHT - SAFE_MARGIN * 2;
    return (CHART_HEIGHT - SAFE_MARGIN) - (value / maxVal) * usableHeight;
  };

  // Costruisci il path per le linee
  const createPath = (type: 'income' | 'expense') => {
    return data.map((stat, i) => {
      const x = getX(i);
      const y = getY(stat[type]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const incomePath = createPath('income');
  const expensePath = createPath('expense');

  // Determina quali label mostrare (se troppe, ne saltiamo alcune)
  const displayLabels = labels || data.map((_, i) => (i + 1).toString());
  const labelStep = Math.max(1, Math.floor(displayLabels.length / 10));

  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>{title}</Text>
      
      <View style={styles.chartArea}>
        {/* Y-Axis Labels - Allineati alle grid lines entro il safe margin */}
        <View style={[styles.yAxisLabels, { height: CHART_HEIGHT, paddingVertical: SAFE_MARGIN - 6 }]}>
          <Text style={styles.yLabel}>€{Math.round(maxVal)}</Text>
          <Text style={styles.yLabel}>€{Math.round(maxVal / 2)}</Text>
          <Text style={styles.yLabel}>€0</Text>
        </View>

        <Svg width={CHART_WIDTH - 45} height={CHART_HEIGHT}>
          {/* Top Grid */}
          <Line
            x1="0" y1={SAFE_MARGIN}
            x2={CHART_WIDTH - 45} y2={SAFE_MARGIN}
            stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4"
          />
          {/* Mid Grid */}
          <Line
            x1="0" y1={CHART_HEIGHT / 2}
            x2={CHART_WIDTH - 45} y2={CHART_HEIGHT / 2}
            stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4"
          />
          {/* Bottom Grid */}
          <Line
            x1="0" y1={CHART_HEIGHT - SAFE_MARGIN}
            x2={CHART_WIDTH - 45} y2={CHART_HEIGHT - SAFE_MARGIN}
            stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4"
          />

          <Path
            d={expensePath}
            fill="none"
            stroke={COLORS.danger}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <Path
            d={incomePath}
            fill="none"
            stroke={COLORS.success}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {data.length < 40 && data.map((stat, i) => (
            <G key={i}>
              <Circle cx={getX(i)} cy={getY(stat.income)} r="3" fill={COLORS.success} />
              <Circle cx={getX(i)} cy={getY(stat.expense)} r="3" fill={COLORS.danger} />
            </G>
          ))}
        </Svg>

        <View style={[styles.labelsContainer, { width: CHART_WIDTH - 80 }]}>
          {displayLabels.map((label, i) => {
            if (i % labelStep !== 0 && i !== displayLabels.length - 1) return null;
            return <Text key={i} style={styles.monthLabel}>{label}</Text>;
          })}
        </View>
      </View>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.lineSymbol, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>Entrate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.lineSymbol, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.legendText}>Uscite</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 24,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  chartTitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  chartArea: {
    height: CHART_HEIGHT + 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 10,
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
