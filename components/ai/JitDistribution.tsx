import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import PieChart from './PieChart';

interface JitDistributionProps {
  title: string;
  items: { label: string; value: number; percentage: number; color: string }[];
}

export default function JitDistribution({ title, items }: JitDistributionProps) {
  const safeTitle = (title || 'Distribuzione').toUpperCase();
  const rawItems = items || [];

  // Applichiamo la regola del "Massimo 6 categorie"
  let displayItems = rawItems.slice(0, 5);
  if (rawItems.length > 5) {
    const otherItems = rawItems.slice(5);
    const otherValue = otherItems.reduce((acc, curr) => acc + curr.value, 0);
    const otherPercentage = otherItems.reduce((acc, curr) => acc + curr.percentage, 0);
    displayItems.push({
      label: 'Altro',
      value: otherValue,
      percentage: otherPercentage,
      color: '#9CA3AF',
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{safeTitle}</Text>
      <View style={styles.card}>
        <View style={styles.chartContainer}>
          <PieChart data={displayItems} size={140} strokeWidth={24} />
          <View style={styles.totalOverlay}>
            <Text style={styles.totalOverlayLabel}>Totale</Text>
            <Text style={styles.totalOverlayValue}>
              €{displayItems.reduce((a, b) => a + b.value, 0).toFixed(0)}
            </Text>
          </View>
        </View>

        <View style={styles.legend}>
          {displayItems.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={styles.legendLeft}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>{item.label}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.legendAbsValue}>
                  €{item.value.toFixed(2)}
                </Text>
                <Text style={styles.legendValue}>
                  {item.percentage.toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}
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
    color: COLORS.secondary,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    ...SHADOWS.soft,
    alignItems: 'center',
  },
  chartContainer: {
    position: 'relative',
    marginBottom: SPACING.xl,
  },
  totalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalOverlayLabel: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    textTransform: 'uppercase',
  },
  totalOverlayValue: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  legend: {
    width: '100%',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  legendLabel: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  legendValue: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 10,
    color: COLORS.secondary,
  },
  legendAbsValue: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: COLORS.primary,
  },
});
