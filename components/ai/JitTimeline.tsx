import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface JitTimelineProps {
  type: 'month' | 'year' | 'bar_vertical' | 'heatmap_calendar';
  title: string;
  data: { label: string; value: number; intensity?: number }[];
  granularity: string;
}

export default function JitTimeline({ type, title, data, granularity }: JitTimelineProps) {
  const safeTitle = (title || 'Timeline').toUpperCase();
  const displayData = data || [];

  const isBarChart = type === 'bar_vertical' || type === 'month' || type === 'year';

  if (isBarChart) {
    const max = Math.max(...displayData.map(d => d.value), 1);
    
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{safeTitle}</Text>
        <View style={styles.barCard}>
          <View style={styles.barsRow}>
            {displayData.map((d, i) => {
              const height = (d.value / max) * 100;
              const isPeak = d.value === max && d.value > 0;
              return (
                <View key={i} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View 
                      style={[
                        styles.barFill, 
                        { height: `${height}%`, backgroundColor: isPeak ? COLORS.accent : COLORS.primary + '80' }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.barLabel, isPeak && styles.peakLabel]}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // Heatmap Calendar (Simplified Mockup for the contract)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{safeTitle}</Text>
      <View style={styles.heatmapCard}>
        <View style={styles.calendarGrid}>
          {['L','M','M','G','V','S','D'].map(d => (
            <Text key={d} style={styles.dayHeader}>{d}</Text>
          ))}
          {Array.from({ length: 30 }).map((_, i) => {
            const intensity = Math.random(); // Mock intensity
            return (
              <View 
                key={i} 
                style={[
                  styles.heatCell, 
                  { backgroundColor: intensity > 0.8 ? COLORS.primary : intensity > 0.5 ? COLORS.accent + '80' : intensity > 0.2 ? COLORS.border : 'transparent' }
                ]} 
              />
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={[styles.heatCell, { width: 10, height: 10, backgroundColor: COLORS.border }]} /><Text style={styles.legendText}>€0-20</Text>
          <View style={[styles.heatCell, { width: 10, height: 10, backgroundColor: COLORS.accent + '80' }]} /><Text style={styles.legendText}>€20-100</Text>
          <View style={[styles.heatCell, { width: 10, height: 10, backgroundColor: COLORS.primary }]} /><Text style={styles.legendText}>€100+</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: SPACING.md,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 10,
    color: '#BADBFF',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  barCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.lg,
    ...SHADOWS.soft,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 12,
    height: '100%',
    backgroundColor: COLORS.border,
    borderRadius: 6,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 10,
    color: COLORS.secondary,
  },
  peakLabel: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  heatmapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.lg,
    ...SHADOWS.soft,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayHeader: {
    width: (SCREEN_WIDTH - 120) / 7,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 10,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  heatCell: {
    width: (SCREEN_WIDTH - 120) / 7,
    height: (SCREEN_WIDTH - 120) / 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border + '20',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.secondary,
    marginRight: 8,
  }
});
