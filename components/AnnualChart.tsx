import React from 'react';
import { StyleSheet, View, Dimensions, Alert, Text } from 'react-native';
import Svg, { Line, Rect, G, Circle, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH;

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
    return `${m} ${yy}`;
  } else {
    return `${d.getDate()} ${m}`;
  }
};

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
  absoluteMax?: number;
  absoluteMin?: number;
  timeRange?: string;
}

export default function AnnualChart({ data, previousData, title, labels, showNetWorth, height = 280, absoluteMax, absoluteMin, timeRange = 'Anno' }: AnnualChartProps) {
  if (data.length === 0) return null;

  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const touchStart = React.useRef<number>(0);
  const activeIdxRef = React.useRef<number | null>(null);
  const lastTouchX = React.useRef<number>(0);

  // Trova il valore massimo considerando il tipo di dato (previousData in pratica è undefined, ma gestito per robustezza)
  const allPoints = [...data, ...(previousData || [])];
  const absoluteMaxCurrent = Math.max(...allPoints.map(d => 
    showNetWorth ? (d.netWorth || 0) : Math.max(d.income, d.expense)
  ), 0);
  
  // Per il patrimonio, consideriamo anche il minimo per scalare meglio se i valori sono tutti alti
  const absoluteMinCurrent = showNetWorth 
    ? Math.min(...allPoints.map(d => d.netWorth || 0))
    : 0;
    
  const finalAbsoluteMax = absoluteMax !== undefined ? Math.max(absoluteMax, absoluteMaxCurrent) : absoluteMaxCurrent;
  const finalAbsoluteMin = absoluteMinCurrent;

  const range = finalAbsoluteMax - finalAbsoluteMin;
  const maxVal = showNetWorth ? finalAbsoluteMax : (finalAbsoluteMax + (range * 0.1 || finalAbsoluteMax * 0.1 || 100));
  const minVal = showNetWorth ? finalAbsoluteMin : 0;

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

  const displayLabels = labels || data.map((_, i) => (i + 1).toString());

  const totalSlots = data.length;
  const mainGap = totalSlots > 15 ? 3 : (totalSlots > 8 ? 6 : 10);
  const totalGaps = totalSlots > 1 ? totalSlots - 1 : 0;
  
  let slotWidth = (usableWidth - (totalGaps * mainGap)) / totalSlots;
  if (slotWidth > 64) slotWidth = 64;

  const totalChartContentWidth = (totalSlots * slotWidth) + (totalGaps * mainGap);
  const startX = (CHART_WIDTH - totalChartContentWidth) / 2;

  const getSlotIndexFromX = (touchX: number) => {
    if (data.length === 0) return null;
    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < data.length; i++) {
      const slotCenterX = startX + i * (slotWidth + mainGap) + slotWidth / 2;
      const distance = Math.abs(touchX - slotCenterX);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  };

  const handleTouchStart = (evt: any) => {
    touchStart.current = Date.now();
    const touchX = evt.nativeEvent.locationX;
    lastTouchX.current = touchX;
    const index = getSlotIndexFromX(touchX);
    if (index !== null) {
      setActiveIdx(index);
      activeIdxRef.current = index;
    }
  };

  const handleTouchMove = (evt: any) => {
    const touchX = evt.nativeEvent.locationX;
    lastTouchX.current = touchX;
    const index = getSlotIndexFromX(touchX);
    if (index !== null) {
      setActiveIdx(index);
      activeIdxRef.current = index;
    }
  };

  const handleTouchEnd = () => {
    const duration = Date.now() - touchStart.current;
    if (duration < 250 && activeIdxRef.current !== null) {
      triggerAlert(activeIdxRef.current, lastTouchX.current);
    }
    setActiveIdx(null);
    activeIdxRef.current = null;
  };

  const triggerAlert = (index: number, touchX: number) => {
    const d = data[index];
    const periodLabel = displayLabels[index];
    if (showNetWorth) {
      const val = d.netWorth || 0;
      Alert.alert(
        'Dettaglio Patrimonio',
        `Periodo: ${periodLabel}\nPatrimonio: € ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
    } else {
      const slotCenterX = startX + index * (slotWidth + mainGap) + slotWidth / 2;
      if (touchX < slotCenterX) {
        Alert.alert(
          'Dettaglio Entrate',
          `Periodo: ${periodLabel}\nEntrate: € ${(d.income || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
      } else {
        Alert.alert(
          'Dettaglio Uscite',
          `Periodo: ${periodLabel}\nUscite: € ${(d.expense || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
      }
    }
  };

  const getFilteredLabels = () => {
    const total = displayLabels.length;
    if (total === 0) return [];

    const getFormatted = (l: string, index: number) => {
      let label = l;
      const dStr = (data[index] as any).date;
      if (dStr) {
        label = formatDateLabel(dStr, timeRange, l);
      }
      return { label, index };
    };

    if (total <= 5) return displayLabels.map(getFormatted);
    const indices: number[] = [];
    for (let i = 0; i < 5; i++) {
      indices.push(Math.round((i * (total - 1)) / 4));
    }
    return displayLabels
      .map(getFormatted)
      .filter((_, idx) => indices.includes(idx));
  };

  let activeTooltip = null;
  if (activeIdx !== null && activeIdx < data.length) {
    const fallbackLabel = displayLabels[activeIdx];
    const dateStr = (data[activeIdx] as any).date;
    
    if (showNetWorth) {
      const val = data[activeIdx].netWorth || 0;
      const valueText = `€${formatCompactValue(val)} (${formatDateLabel(dateStr, timeRange, fallbackLabel)})`;
      const rectWidth = Math.max(46, valueText.length * 7.5 + 12);
      const rawX = startX + activeIdx * (slotWidth + mainGap) + slotWidth / 2 - rectWidth / 2;
      const rectX = Math.max(4, Math.min(CHART_WIDTH - rectWidth - 4, rawX));
      const textX = rectX + rectWidth / 2;
      activeTooltip = { valueText, rectWidth, rectX, textX };
    } else {
      const incVal = data[activeIdx].income || 0;
      const expVal = data[activeIdx].expense || 0;
      const dateLabelText = formatDateLabel(dateStr, timeRange, fallbackLabel);
      const valueText = `E: €${formatCompactValue(incVal)} | U: €${formatCompactValue(expVal)} (${dateLabelText})`;
      const rectWidth = Math.max(80, valueText.length * 7 + 14);
      const rectX = CHART_WIDTH / 2 - rectWidth / 2;
      const textX = CHART_WIDTH / 2;
      activeTooltip = { valueText, rectWidth, rectX, textX };
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height: height - 24 }]}>
        <Svg width={CHART_WIDTH} height={height - 24}>
          {/* Griglie e Ordinate */}
          <Line x1={SAFE_MARGIN} y1={VERTICAL_PADDING} x2={CHART_WIDTH - SAFE_MARGIN} y2={VERTICAL_PADDING} stroke={COLORS.border} strokeWidth="0.5" />
          <SvgText x={CHART_WIDTH - SAFE_MARGIN} y={VERTICAL_PADDING + 10} fontSize="10" fontFamily={TYPOGRAPHY.fontFamily} fill={COLORS.secondary} textAnchor="end">{formatCompactValue(maxVal)}</SvgText>
          
          <Line x1={SAFE_MARGIN} y1={(bottomReference + VERTICAL_PADDING) / 2} x2={CHART_WIDTH - SAFE_MARGIN} y2={(bottomReference + VERTICAL_PADDING) / 2} stroke={COLORS.border} strokeWidth="0.5" />
          <SvgText x={CHART_WIDTH - SAFE_MARGIN} y={(bottomReference + VERTICAL_PADDING) / 2 - 4} fontSize="10" fontFamily={TYPOGRAPHY.fontFamily} fill={COLORS.secondary} textAnchor="end">{formatCompactValue((maxVal + minVal) / 2)}</SvgText>
          
          <Line x1={SAFE_MARGIN} y1={bottomReference} x2={CHART_WIDTH - SAFE_MARGIN} y2={bottomReference} stroke={COLORS.border} strokeWidth="0.5" />
          <SvgText x={CHART_WIDTH - SAFE_MARGIN} y={bottomReference - 4} fontSize="10" fontFamily={TYPOGRAPHY.fontFamily} fill={COLORS.secondary} textAnchor="end">{formatCompactValue(minVal)}</SvgText>

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
                </G>
              );
            }
          })}

          {/* Touch interactive overlays */}
          {activeIdx !== null && activeIdx < data.length && (
            <G>
              {/* Linea tratteggiata verticale */}
              <Line
                x1={startX + activeIdx * (slotWidth + mainGap) + slotWidth / 2}
                y1={VERTICAL_PADDING}
                x2={startX + activeIdx * (slotWidth + mainGap) + slotWidth / 2}
                y2={bottomReference}
                stroke={COLORS.secondary}
                strokeWidth="1.5"
                strokeDasharray="4, 4"
              />

              {showNetWorth ? (
                <G>
                  <Circle
                    cx={startX + activeIdx * (slotWidth + mainGap) + slotWidth / 2}
                    cy={getY(data[activeIdx].netWorth || 0)}
                    r="5"
                    fill={COLORS.accent}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  {activeTooltip && (
                    <G>
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
                </G>
              ) : (
                <G>
                  <Circle
                    cx={startX + activeIdx * (slotWidth + mainGap) + slotWidth * 0.3}
                    cy={getY(data[activeIdx].income || 0)}
                    r="4"
                    fill={COLORS.success}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <Circle
                    cx={startX + activeIdx * (slotWidth + mainGap) + slotWidth * 0.7}
                    cy={getY(data[activeIdx].expense || 0)}
                    r="4"
                    fill={COLORS.danger}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  {activeTooltip && (
                    <G>
                      <Rect
                        x={activeTooltip.rectX}
                        y={4}
                        width={activeTooltip.rectWidth}
                        height={20}
                        rx={6}
                        fill="#1F2937"
                        opacity="0.9"
                      />
                      <SvgText
                        x={activeTooltip.textX}
                        y={17}
                        fontSize="9"
                        fontFamily={TYPOGRAPHY.fontBold}
                        fill="#FFFFFF"
                        textAnchor="middle"
                      >
                        {activeTooltip.valueText}
                      </SvgText>
                    </G>
                  )}
                </G>
              )}
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
  chartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  chartLabelText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  labelBadge: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
