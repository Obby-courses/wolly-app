import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';

interface JitDistributionProps {
  title: string;
  items: { label: string; value: number; percentage: number; color: string }[];
}

export default function JitDistribution({ title, items }: JitDistributionProps) {
  const safeTitle = (title || 'Distribuzione').toUpperCase();
  const displayItems = items || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{safeTitle}</Text>
      <View style={styles.card}>
        {displayItems.map((item, index) => (
          <View key={index} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>€{item.value.toFixed(0)} <Text style={styles.percentage}>{item.percentage.toFixed(0)}%</Text></Text>
            </View>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.barFill, 
                  { width: `${item.percentage}%`, backgroundColor: item.color }
                ]} 
              />
            </View>
          </View>
        ))}
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
    color: COLORS.secondary,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.lg,
    ...SHADOWS.soft,
    gap: SPACING.md,
  },
  row: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  percentage: {
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    fontSize: 12,
  },
  barContainer: {
    width: '100%',
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
});
