import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { QueryIntent } from '../../services/aiQueryParser';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';

interface FeedbackBarProps {
  intent: QueryIntent;
  onUpdate: (newIntent: QueryIntent) => void;
}

export default function FeedbackBar({ intent, onUpdate }: FeedbackBarProps) {
  const getCosaLabel = () => {
    if (intent.merchant_filter) return intent.merchant_filter;
    if (intent.category_filter) return intent.category_filter.replace(/_/g, ' ');
    if (intent.domain_filter) return intent.domain_filter.replace(/_/g, ' ');
    return 'Tutto';
  };

  const getComeLabel = () => {
    const agg = intent.aggregation_type || 'total';
    if (agg === 'count') return 'Conteggio';
    if (agg === 'average') return 'Media';
    return 'Totale';
  };

  const cycleCome = () => {
    const types: ('total' | 'average' | 'count')[] = ['total', 'average', 'count'];
    const currentIdx = types.indexOf(intent.aggregation_type || 'total');
    const nextIdx = (currentIdx + 1) % types.length;
    onUpdate({ ...intent, aggregation_type: types[nextIdx] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <Text style={styles.label}>{getCosaLabel()}</Text>
      </View>
      <Text style={styles.dot}>·</Text>
      <View style={styles.pill}>
        <Text style={styles.label}>{intent.period_label || 'Periodo'}</Text>
      </View>
      <Text style={styles.dot}>·</Text>
      <Pressable style={[styles.pill, styles.interactive]} onPress={cycleCome}>
        <Text style={[styles.label, styles.interactiveText]}>{getComeLabel()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  pill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  interactive: {
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  label: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  interactiveText: {
    color: COLORS.primary,
  },
  dot: {
    marginHorizontal: 6,
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
