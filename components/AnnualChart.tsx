import React from 'react';
import { StyleSheet, View, Dimensions, Alert } from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH;

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

  // Trova il valore massimo considerando il tipo di dato (previousData in pratica è undefined, ma gestito per robustezza)
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

  const SAFE_MARGIN = SPACING.md; 
  const VERTICAL_PADDING = 8;
  const bottomReference = height - 24; // 24px left at the bottom for labels and padding
  const usableWidth = CHART_WIDTH - (SAFE_MARGIN * 2);

  const getY = (value: number) => {
    const usableHeight = height - 20 - (VERTICAL_PADDING * 2);
    const effectiveMax = maxVal - minVal;
    const effectiveValue = value - minVal;
    
    if (effectiveMax === 0) return bottomReference - usableHeight / 2;
    return bottomReference - (effectiveValue / effectiveMax) * usableHeight;
  };

  // Determina quali label mostrare
  const displayLabels = labels || data.map((_, i) => (i + 1).toString());
  
  const shouldShowLabel = (index: number) => {
    if (data.length <= 12) return true; // Mostra tutto per settimana o 12 mesi
    return index % 5 === 0; // Mostra una su 5 per i giorni del mese
  };

  const totalSlots = data.length;
  const mainGap = totalSlots > 15 ? 3 : (totalSlots > 8 ? 6 : 10);
  const totalGaps = totalSlots > 1 ? totalSlots - 1 : 0;
  
  let slotWidth = (usableWidth - (totalGaps * mainGap)) / totalSlots;
  if (slotWidth > 64) slotWidth = 64;

  const totalChartContentWidth = (totalSlots * slotWidth) + (totalGaps * mainGap);
  const startX = (CHART_WIDTH - totalChartContentWidth) / 2;

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height: height }]}>
        <Svg width={CHART_WIDTH} height={height}>
          {/* Griglie */}
          <Line x1={SAFE_MARGIN} y1={VERTICAL_PADDING} x2={CHART_WIDTH - SAFE_MARGIN} y2={VERTICAL_PADDING} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4" />
          <Line x1={SAFE_MARGIN} y1={(bottomReference + VERTICAL_PADDING) / 2} x2={CHART_WIDTH - SAFE_MARGIN} y2={(bottomReference + VERTICAL_PADDING) / 2} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4" />
          <Line x1={SAFE_MARGIN} y1={bottomReference} x2={CHART_WIDTH - SAFE_MARGIN} y2={bottomReference} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4, 4" />

          {/* Colonne dell'istogramma */}
          {data.map((d, i) => {
            const periodLabel = displayLabels[i];

            if (showNetWorth) {
              // Patrimonio: singola colonna scura/accento
              const barWidth = Math.max(4, slotWidth * 0.7);
              const x = startX + i * (slotWidth + mainGap) + (slotWidth - barWidth) / 2;
              const val = d.netWorth || 0;
              const y = getY(val);
              const h = Math.max(val > 0 ? 3 : 0, bottomReference - y);
              const roundedRadius = Math.min(barWidth / 2, 4);

              return (
                <G key={i}>
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={roundedRadius}
                    ry={roundedRadius}
                    fill={COLORS.accent}
                  />
                  {/* Area di tocco invisibile */}
                  <Rect
                    x={startX + i * (slotWidth + mainGap)}
                    y={0}
                    width={slotWidth}
                    height={height}
                    fill="transparent"
                    onPress={() => {
                      Alert.alert(
                        'Dettaglio Patrimonio',
                        `Periodo: ${periodLabel}\nPatrimonio: € ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      );
                    }}
                  />
                </G>
              );
            } else {
              // Entrate vs Uscite: due colonne affiancate (verde e rossa)
              const innerGap = 2;
              const barWidth = Math.max(2, (slotWidth * 0.95 - innerGap) / 2);
              
              const xInc = startX + i * (slotWidth + mainGap) + (slotWidth - (2 * barWidth + innerGap)) / 2;
              const xExp = xInc + barWidth + innerGap;
              
              const yInc = getY(d.income || 0);
              const yExp = getY(d.expense || 0);
              
              const hInc = Math.max(d.income > 0 ? 3 : 0, bottomReference - yInc);
              const hExp = Math.max(d.expense > 0 ? 3 : 0, bottomReference - yExp);
              
              const roundedRadius = Math.min(barWidth / 2, 4);

              return (
                <G key={i}>
                  {/* Barra Entrate (Verde) */}
                  <Rect
                    x={xInc}
                    y={yInc}
                    width={barWidth}
                    height={hInc}
                    rx={roundedRadius}
                    ry={roundedRadius}
                    fill={COLORS.success}
                  />
                  {/* Barra Uscite (Rossa) */}
                  <Rect
                    x={xExp}
                    y={yExp}
                    width={barWidth}
                    height={hExp}
                    rx={roundedRadius}
                    ry={roundedRadius}
                    fill={COLORS.danger}
                  />

                  {/* Target di tocco invisibile Entrate (Metà sinistra dello slot) */}
                  <Rect
                    x={startX + i * (slotWidth + mainGap)}
                    y={0}
                    width={slotWidth / 2}
                    height={height}
                    fill="transparent"
                    onPress={() => {
                      Alert.alert(
                        'Dettaglio Entrate',
                        `Periodo: ${periodLabel}\nEntrate: € ${(d.income || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      );
                    }}
                  />
                  {/* Target di tocco invisibile Uscite (Metà destra dello slot) */}
                  <Rect
                    x={startX + i * (slotWidth + mainGap) + slotWidth / 2}
                    y={0}
                    width={slotWidth / 2}
                    height={height}
                    fill="transparent"
                    onPress={() => {
                      Alert.alert(
                        'Dettaglio Uscite',
                        `Periodo: ${periodLabel}\nUscite: € ${(d.expense || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      );
                    }}
                  />
                </G>
              );
            }
          })}

          {/* Asse delle ascisse (Etichette periodi) */}
          {data.map((d, i) => {
            if (!shouldShowLabel(i)) return null;
            const xText = startX + i * (slotWidth + mainGap) + slotWidth / 2;
            return (
              <SvgText
                key={`lbl-${i}`}
                x={xText}
                y={height - 6}
                fontSize="9"
                fill={COLORS.secondary}
                textAnchor="middle"
                fontFamily={TYPOGRAPHY.fontFamily}
              >
                {displayLabels[i]}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
