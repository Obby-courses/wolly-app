import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';

interface JitTotalProps {
  value: number;
  comparison?: {
    diff: number;
    percentage: number;
    is_better: boolean;
  };
  periodLabel: string;
}

export default function JitTotal({ value, comparison, periodLabel = 'Periodo' }: JitTotalProps) {
  const label = (periodLabel || 'Periodo').toUpperCase();
  return (
    <View style={styles.container}>
      <Text style={styles.periodLabel}>{label}</Text>
      
      <View style={styles.valueRow}>
        <Text style={styles.currency}>€</Text>
        <Text style={styles.value}>{value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
      </View>

      {comparison && (
        <View style={styles.comparisonRow}>
          <Ionicons 
            name={comparison.is_better ? 'arrow-down' : 'arrow-up'} 
            size={14} 
            color={comparison.is_better ? COLORS.success : COLORS.error} 
          />
          <Text style={[styles.comparisonText, { color: comparison.is_better ? COLORS.success : COLORS.error }]}>
            €{Math.abs(comparison.diff).toFixed(0)} ({comparison.percentage.toFixed(0)}%) rispetto al periodo precedente
          </Text>
        </View>
      )}

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '65%' }]} />
        </View>
        <Text style={styles.progressText}>Budget mensile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    width: '100%',
  },
  periodLabel: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 12,
    color: COLORS.secondary,
    letterSpacing: 2,
    marginBottom: SPACING.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  currency: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 32,
    color: COLORS.primary,
    marginTop: 10,
    marginRight: 4,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 72,
    color: COLORS.primary,
    letterSpacing: -2,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xl,
  },
  comparisonText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 240,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 11,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
