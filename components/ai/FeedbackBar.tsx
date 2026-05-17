import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { QueryIntent } from '../../services/aiQueryParser';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import { translateSocialContext } from '../../constants/i18n';

interface FeedbackBarProps {
  intent: QueryIntent;
  onUpdate: (newIntent: QueryIntent) => void;
}

export default function FeedbackBar({ intent, onUpdate }: FeedbackBarProps) {
  const getCosaLabel = () => {
    if (intent.subject === 'net_worth') return 'Patrimonio';
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

  // Build the list of active pills dynamically
  const pills: { key: string; text: string; isInteractive?: boolean; onPress?: () => void }[] = [];

  // 1. Cosa (Category / Merchant / Domain)
  pills.push({ key: 'cosa', text: getCosaLabel() });

  // 2. Social Context (Amici, Famiglia, etc.)
  if (intent.social_context_filter) {
    pills.push({ 
      key: 'social', 
      text: translateSocialContext(intent.social_context_filter) 
    });
  }

  // 3. City
  if (intent.city_filter) {
    pills.push({ key: 'city', text: intent.city_filter });
  }

  // 4. Holiday
  if (intent.holiday_filter) {
    pills.push({ key: 'holiday', text: intent.holiday_filter });
  }

  // 5. Tag
  if (intent.tag_filter) {
    pills.push({ key: 'tag', text: `#${intent.tag_filter}` });
  }

  // 6. Period
  pills.push({ key: 'period', text: intent.period_label || 'Periodo' });

  // 7. Aggregation (Interactive)
  pills.push({ 
    key: 'come', 
    text: getComeLabel(), 
    isInteractive: true, 
    onPress: cycleCome 
  });

  return (
    <View style={styles.container}>
      {pills.map((pill, idx) => (
        <React.Fragment key={pill.key}>
          {idx > 0 && <Text style={styles.dot}>·</Text>}
          {pill.isInteractive ? (
            <Pressable style={[styles.pill, styles.interactive]} onPress={pill.onPress}>
              <Text style={[styles.label, styles.interactiveText]}>{pill.text}</Text>
            </Pressable>
          ) : (
            <View style={styles.pill}>
              <Text style={styles.label}>{pill.text}</Text>
            </View>
          )}
        </React.Fragment>
      ))}
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
    flexWrap: 'wrap',
    gap: 4,
  },
  pill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 2,
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
    marginHorizontal: 4,
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
