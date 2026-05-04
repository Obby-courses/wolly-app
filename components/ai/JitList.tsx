import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import CategoryPill from '../CategoryPill';

interface JitListProps {
  title: string;
  items: {
    date: string;
    description: string;
    amount: number;
    category_key: string;
    city?: string;
  }[];
}

export default function JitList({ title, items }: JitListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      <View style={styles.listCard}>
        {items.map((item, index) => (
          <View key={index} style={[styles.item, index === items.length - 1 && styles.lastItem]}>
            <View style={styles.left}>
              <Text style={styles.date}>{new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</Text>
              <View style={styles.details}>
                <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
                <View style={styles.meta}>
                  <CategoryPill categoryKey={item.category_key} size="sm" />
                  {item.city && <Text style={styles.city}>• {item.city}</Text>}
                </View>
              </View>
            </View>
            <Text style={[styles.amount, { color: item.amount > 0 ? COLORS.success : COLORS.primary }]}>
              {item.amount > 0 ? '+' : ''}€{Math.abs(item.amount).toFixed(2)}
            </Text>
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
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.md,
    ...SHADOWS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastItem: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  date: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 12,
    color: COLORS.secondary,
    width: 45,
    textAlign: 'center',
  },
  details: {
    flex: 1,
    gap: 4,
  },
  desc: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  city: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 11,
    color: COLORS.secondary,
  },
  amount: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 15,
  },
});
