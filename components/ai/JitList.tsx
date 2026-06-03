import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import TransactionPreview from '../TransactionPreview';

interface JitListProps {
  title: string;
  items: any[];
  totalCount: number;
}

export default function JitList({ title, items, totalCount }: JitListProps) {
  const displayItems = items || [];
  const safeTitle = (title || 'Lista').toUpperCase();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{safeTitle}</Text>
      <View style={styles.listCard}>
        {displayItems.map((item, index) => (
          <View 
            key={item.id || index}
            style={[
              index < displayItems.length - 1 && { 
                borderBottomWidth: 1, 
                borderBottomColor: COLORS.border 
              }
            ]}
          >
            <TransactionPreview item={item} />
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
    color: '#BADBFF',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    ...SHADOWS.soft,
    width: '100%',
  },
});
