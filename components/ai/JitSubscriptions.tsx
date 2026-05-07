import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import { Subscription } from '../../services/database/repositories/SubscriptionRepository';

interface JitSubscriptionsProps {
  items: Subscription[];
  totalMonthly: number;
}

export default function JitSubscriptions({ items, totalMonthly }: JitSubscriptionsProps) {
  const activeCount = items.filter(s => s.is_active).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Abbonamenti Attivi</Text>
          <Text style={styles.subtitle}>{activeCount} servizi ricorrenti</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalLabel}>MENSILE</Text>
          <Text style={styles.totalValue}>€{totalMonthly.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {items.filter(s => s.is_active).map((sub) => (
          <View key={sub.id} style={styles.subItem}>
            <View style={styles.iconWrapper}>
              <Ionicons name="repeat-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.subInfo}>
              <Text style={styles.subName}>{sub.name}</Text>
              <Text style={styles.subFreq}>{sub.frequency === 'monthly' ? 'Mensile' : sub.frequency}</Text>
            </View>
            <Text style={styles.subAmount}>€{sub.amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  totalBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalLabel: {
    fontSize: 8,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  list: {
    gap: SPACING.sm,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  subInfo: {
    flex: 1,
  },
  subName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  subFreq: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  subAmount: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
});
