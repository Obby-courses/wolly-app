import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import CategoryPill from '../CategoryPill';

interface JitListProps {
  title: string;
  items: {
    id: string;
    date: string;
    description: string;
    amount: number;
    category_key: string;
    city?: string;
    is_impulsive?: boolean;
  }[];
  totalCount: number;
}

export default function JitList({ title, items, totalCount }: JitListProps) {
  const displayItems = items || [];
  const safeTitle = (title || 'Lista').toUpperCase();
  const hasMore = totalCount > 5;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{safeTitle}</Text>
      <View style={styles.listCard}>
        {displayItems.map((item, index) => (
          <View key={item.id || index} style={[styles.item, index === displayItems.length - 1 && !hasMore && styles.lastItem]}>
            <View style={styles.left}>
              {item.is_impulsive && (
                <Ionicons name="flash" size={16} color={COLORS.warning} style={{ marginRight: 4 }} />
              )}
              <View style={styles.details}>
                <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
                <View style={styles.meta}>
                  <CategoryPill categoryKey={item.category_key} size="sm" />
                  <Text style={styles.date}>{new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.amount, { color: item.amount > 0 ? COLORS.success : COLORS.primary }]}>
              {item.amount > 0 ? '+' : ''}€{Math.abs(item.amount).toFixed(2)}
            </Text>
          </View>
        ))}

        {hasMore && (
          <Pressable style={styles.seeMore}>
            <Text style={styles.seeMoreText}>Vedi tutte le {totalCount} →</Text>
          </Pressable>
        )}
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
    borderRadius: 24,
    padding: SPACING.lg,
    ...SHADOWS.soft,
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
  },
  details: {
    flex: 1,
  },
  desc: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 11,
    color: COLORS.secondary,
  },
  amount: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 15,
  },
  seeMore: {
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  seeMoreText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 12,
    color: COLORS.accent,
  },
});
