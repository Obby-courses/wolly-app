import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';
import { getCategory } from '../constants/categories';
import { getCategoryColor } from './CategoryPill';

interface TransactionPreviewProps {
  item: any;
  onPress?: () => void;
}

export default function TransactionPreview({ item, onPress }: TransactionPreviewProps) {
  const router = useRouter();
  
  // A subscription can use item.direction (defaults to 'out'), transaction uses item.direction
  const isIncome = item.direction === 'in';
  
  // Category Details
  const categoryKey = item.category_key || 'default';
  const category = getCategory(categoryKey);
  const categoryColor = getCategoryColor(categoryKey);
  const displayCategory = category ? category.label : categoryKey.replace(/_/g, ' ');

  // Display Name / Title
  const displayName = item.description || item.name || displayCategory;

  // Date Formatting
  let dateStr = item.displayDate || '';
  if (!dateStr) {
    if (item.date) {
      // If it's an ISO string or a date string
      dateStr = new Date(item.date).toLocaleDateString('it-IT');
    } else if (item.nextDate) {
      const nextDateObj = new Date(item.nextDate);
      dateStr = nextDateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    } else if (item.start_date) {
      dateStr = new Date(item.start_date).toLocaleDateString('it-IT');
    }
  }

  // Handle Default Navigation if onPress is not provided
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (item.id) {
      if (item.isSubscription) {
        // If it's a subscription, navigate or handle appropriately
        router.push('/subscriptions');
      } else {
        router.push(`/transaction/${item.id}`);
      }
    }
  };

  const isActive = item.is_active !== false;

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        !isActive && { opacity: 0.55 },
        pressed && { opacity: 0.7 }
      ]}
      onPress={handlePress}
    >
      {/* Indicator line with Category Color */}
      <View style={[styles.categoryIndicator, { backgroundColor: categoryColor }]} />
      
      {/* Transaction Info (Name & Date) */}
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {displayName}
          </Text>
          {item.holiday && (
            <View style={styles.holidayBadge}>
              <Text style={styles.holidayText}>{item.holiday}</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {dateStr}
          </Text>
          {item.frequency && (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.meta}>
                {item.frequency === 'monthly' ? 'Mensile' : 
                 item.frequency === 'weekly' ? 'Settimanale' : 
                 item.frequency === 'biweekly' ? 'Bisettimanale' : 
                 item.frequency === 'yearly' ? 'Annuale' : item.frequency}
              </Text>
            </>
          )}
          {item.tags && item.tags.split(',').map((tag: string, idx: number) => (
            <View key={idx} style={styles.tagBadge}>
              <Text style={styles.tagText}>{tag.trim()}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Amount: Black for negative (expense), Green for positive (income) */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, isIncome ? styles.income : styles.expense]}>
          {!isIncome ? '- ' : '+ '}€{Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: 'transparent', // Transparent background
    marginBottom: 4,
  },
  categoryIndicator: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
    marginRight: SPACING.md,
  },
  infoContainer: {
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
  title: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    textTransform: 'capitalize',
  },
  meta: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'uppercase',
  },
  metaSep: {
    color: COLORS.secondary,
    fontSize: 10,
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
  amount: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  income: {
    color: COLORS.success, // Green for positive
  },
  expense: {
    color: '#000000', // Black for negative
  },
});
