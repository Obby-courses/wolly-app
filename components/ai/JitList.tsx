import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
    subscription_name?: string;
  }[];
  totalCount: number;
}

export default function JitList({ title, items, totalCount }: JitListProps) {
  const router = useRouter();
  const displayItems = items || [];
  const safeTitle = (title || 'Lista').toUpperCase();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{safeTitle}</Text>
      <View style={styles.listCard}>
        {displayItems.map((item, index) => (
          <Pressable 
            key={item.id || index} 
            style={({ pressed }) => [
              styles.item, 
              index === displayItems.length - 1 && styles.lastItem,
              pressed && { opacity: 0.7, backgroundColor: '#F9FAFB' }
            ]}
            onPress={() => item.id && router.push({ pathname: "/transaction/[id]", params: { id: item.id } })}
          >
            <View style={styles.left}>
              {item.is_impulsive && (
                <Ionicons name="flash" size={16} color={COLORS.warning} style={{ marginRight: 4 }} />
              )}
              <View style={styles.details}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
                  {item.subscription_name && (
                    <Text style={styles.subTag}>{item.subscription_name}</Text>
                  )}
                </View>
                <View style={styles.meta}>
                  <CategoryPill categoryKey={item.category_key} size="sm" />
                  <Text style={styles.date}>{new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.amount, { color: (item.amount || 0) > 0 ? COLORS.success : COLORS.primary }]}>
                {(item.amount || 0) > 0 ? '+' : ''}€{Math.abs(item.amount || 0).toFixed(2)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.border} style={{ marginLeft: 4 }} />
            </View>
          </Pressable>
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
    color: '#BADBFF',
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
  subTag: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginLeft: 4,
    opacity: 0.8,
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
