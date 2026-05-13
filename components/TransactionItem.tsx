import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { getCategory } from '../constants/categories';
import { getCategoryColor } from './CategoryPill';

interface TransactionItemProps {
  item: any;
  hideCategory?: boolean;
}

export default function TransactionItem({ item, hideCategory }: TransactionItemProps) {
  const router = useRouter();
  const isIncome = item.direction === 'in';
  
  // Trova i dettagli della categoria per label e colore coerenti
  const category = getCategory(item.category_key);
  const categoryColor = getCategoryColor(item.category_key);
  const displayCategory = category ? category.label : item.category_key.replace(/_/g, ' ');

  // Formatta la data
  const dateStr = item.date ? new Date(item.date).toLocaleDateString('it-IT') : '';

  return (
    <Pressable 
      style={styles.transactionCard}
      onPress={() => router.push(`/transaction/${item.id}`)}
    >
      <View style={[styles.categoryIndicator, { backgroundColor: categoryColor }]} />
      <View style={styles.transactionInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.transactionTitle} numberOfLines={1}>
            {item.description || displayCategory}
          </Text>
          {item.holiday && (
            <View style={styles.holidayBadge}>
              <Text style={styles.holidayText}>{item.holiday}</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.transactionMeta}>
            {dateStr}
          </Text>
          {item.tags && item.tags.split(',').map((tag: string, idx: number) => (
            <View key={idx} style={styles.tagBadge}>
              <Text style={styles.tagText}>{tag.trim()}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.transactionAmount, isIncome ? styles.income : styles.expense]}>
          {!isIncome ? '- ' : '+ '}€{Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  transactionCard: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: 16,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.soft
  },
  categoryIndicator: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
    marginRight: SPACING.md,
  },
  transactionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  transactionTitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    textTransform: 'capitalize',
  },
  transactionMeta: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'uppercase',
  },
  holidayBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FCA5A5',
  },
  holidayText: {
    fontSize: 8,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#B91C1C',
    textTransform: 'uppercase',
  },
  tagBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 8,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'lowercase',
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginLeft: SPACING.sm,
  },
  transactionAmount: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  income: {
    color: COLORS.success,
  },
  expense: {
    color: COLORS.primary,
  },
});
