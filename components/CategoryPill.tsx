import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getDomainForCategory } from '../constants/categories';
import { COLORS } from '../constants/Theme';

export const CATEGORY_COLORS: Record<string, string> = {
  cibo_bevande: '#6366F1', acquisti: '#06B6D4', alloggio: '#8B5CF6',
  trasporti: '#3B82F6', veicolo: '#F59E0B', vita_intrattenimento: '#EC4899',
  comunicazione_pc: '#10B981', spese_finanziarie: '#EF4444',
  investimenti: '#D97706', entrata: '#059669',
};

export function getCategoryColor(categoryKey: string): string {
  const domain = getDomainForCategory(categoryKey);
  return domain ? (CATEGORY_COLORS[domain.key] || '#9CA3AF') : '#9CA3AF';
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
