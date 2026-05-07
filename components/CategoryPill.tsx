import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getDomainForCategory } from '../constants/categories';
import { COLORS } from '../constants/Theme';

export function getCategoryColor(categoryKey: string): string {
  const domain = getDomainForCategory(categoryKey);
  if (!domain) return COLORS.categories.default;
  return COLORS.categories[domain.key as keyof typeof COLORS.categories] || COLORS.categories.default;
}

interface CategoryPillProps {
  categoryKey: string;
  size?: 'sm' | 'md';
}

export default function CategoryPill({ categoryKey, size = 'md' }: CategoryPillProps) {
  const domain = getDomainForCategory(categoryKey);
  const color = getCategoryColor(categoryKey);

  if (!domain) return null;

  return (
    <View style={[styles.domainPill, { backgroundColor: color + '20' }, size === 'sm' && styles.pillSm]}>
      <View style={[styles.domainPillDot, { backgroundColor: color }, size === 'sm' && styles.dotSm]} />
      <Text style={[styles.domainPillText, { color: color }, size === 'sm' && styles.textSm]}>
        {domain.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  domainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  domainPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  dotSm: {
    width: 4,
    height: 4,
  },
  domainPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textSm: {
    fontSize: 10,
  },
});
