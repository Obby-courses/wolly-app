import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import type { AiChartPayload, ChartDataPoint } from '../../services/aiChat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_W = SCREEN_WIDTH - SPACING.lg * 6;
const CHART_H = 160;
const SAFE = 10;

// ─── Color palette per i punti del grafico ───────────────────────────────────
const PALETTE = [
  COLORS.categories.cibo_bevande,
  COLORS.categories.trasporti,
  COLORS.categories.alloggio,
  COLORS.categories.vita_intrattenimento,
  COLORS.categories.acquisti,
  COLORS.categories.comunicazione_pc,
  COLORS.categories.entrata,
  COLORS.categories.investimenti,
  COLORS.accent,
  COLORS.warning,
];

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({ data }: { data: ChartDataPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1) * 1.2;
  const barW = Math.min(36, (CHART_W - SAFE * 2) / data.length - 8);
  const gap = (CHART_W - SAFE * 2 - barW * data.length) / (data.length + 1);

  return (
    <Svg width={CHART_W} height={CHART_H + 30}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <Line
          key={i}
          x1={SAFE} y1={CHART_H - f * (CHART_H - SAFE * 2) - SAFE}
          x2={CHART_W - SAFE} y2={CHART_H - f * (CHART_H - SAFE * 2) - SAFE}
          stroke={COLORS.border} strokeWidth="1" strokeDasharray="4,4"
        />
      ))}
      {data.map((d, i) => {
        const barH = Math.max(4, ((d.value / max) * (CHART_H - SAFE * 2)));
        const x = SAFE + gap * (i + 1) + barW * i;
        const y = CHART_H - SAFE - barH;
        const color = d.color || PALETTE[i % PALETTE.length];
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={6} fill={color} opacity={0.9} />
            <SvgText
              x={x + barW / 2} y={CHART_H + 14}
              fontSize="9" fill={COLORS.secondary}
              textAnchor="middle" fontFamily={TYPOGRAPHY.fontFamily}
            >
              {d.label.length > 6 ? d.label.slice(0, 5) + '…' : d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Pie Chart ───────────────────────────────────────────────────────────────
function PieChart({ data }: { data: ChartDataPoint[] }) {
  const total = data.reduce((a, c) => a + c.value, 0) || 1;
  const cx = CHART_W / 2;
  const cy = CHART_H / 2;
  const r = Math.min(cx, cy) - 20;

  let cumulAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const startAngle = cumulAngle;
    cumulAngle += angle;
    return { ...d, startAngle, endAngle: cumulAngle, color: d.color || PALETTE[i % PALETTE.length] };
  });

  const polarToCartesian = (angle: number, radius = r) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {slices.map((s, i) => {
        const start = polarToCartesian(s.startAngle);
        const end = polarToCartesian(s.endAngle);
        const largeArc = s.endAngle - s.startAngle > Math.PI ? 1 : 0;
        const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
        return <Path key={i} d={d} fill={s.color} stroke="#FFF" strokeWidth={2} />;
      })}
      {/* Center hole */}
      <Circle cx={cx} cy={cy} r={r * 0.45} fill={COLORS.surface} />
    </Svg>
  );
}

// ─── Line Chart ──────────────────────────────────────────────────────────────
function LineChart({ data }: { data: ChartDataPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1) * 1.2;
  const denom = data.length > 1 ? data.length - 1 : 1;
  const getX = (i: number) => SAFE + (i * (CHART_W - SAFE * 2)) / denom;
  const getY = (v: number) => CHART_H - SAFE - (v / max) * (CHART_H - SAFE * 2);

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');

  return (
    <Svg width={CHART_W} height={CHART_H + 20}>
      {[0.5, 1].map((f, i) => (
        <Line key={i}
          x1={SAFE} y1={CHART_H - f * (CHART_H - SAFE * 2) - SAFE}
          x2={CHART_W - SAFE} y2={CHART_H - f * (CHART_H - SAFE * 2) - SAFE}
          stroke={COLORS.border} strokeWidth="1" strokeDasharray="4,4"
        />
      ))}
      <Path d={pathD} fill="none" stroke={COLORS.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <G key={i}>
          <Circle cx={getX(i)} cy={getY(d.value)} r={4} fill={COLORS.accent} />
          <SvgText
            x={getX(i)} y={CHART_H + 14}
            fontSize="9" fill={COLORS.secondary}
            textAnchor="middle" fontFamily={TYPOGRAPHY.fontFamily}
          >
            {d.label.length > 4 ? d.label.slice(0, 3) + '…' : d.label}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ data, type }: { data: ChartDataPoint[]; type: 'bar' | 'pie' | 'line' }) {
  if (type === 'line') return null;
  return (
    <View style={styles.legend}>
      {data.slice(0, 5).map((d, i) => (
        <View key={i} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: d.color || PALETTE[i % PALETTE.length] }]} />
          <Text style={styles.legendLabel} numberOfLines={1}>
            {d.label} <Text style={styles.legendValue}>€{d.value.toFixed(0)}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface InlineChartProps {
  payload: AiChartPayload;
}

/**
 * InlineChart — Grafico JIT generato dal payload AI.
 * Componente puro: riceve dati, non fa fetch, non chiama AI.
 * Supporta bar, pie e line chart tramite react-native-svg.
 */
export default function InlineChart({ payload }: InlineChartProps) {
  const { type, title, data } = payload;

  if (!data || data.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartArea}>
        {type === 'bar' && <BarChart data={data} />}
        {type === 'pie' && <PieChart data={data} />}
        {type === 'line' && <LineChart data={data} />}
      </View>
      <Legend data={data} type={type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  chartArea: {
    alignItems: 'center',
  },
  legend: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    flex: 1,
  },
  legendValue: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
});
