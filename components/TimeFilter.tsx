import React from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';

export type TimeRange = 'Settimana' | 'Mese' | 'Anno' | 'Tutto';

interface TimeFilterProps {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  baseDate: string;
  onDateChange: (newDate: string) => void;
}

export default function TimeFilter({ timeRange, setTimeRange, baseDate, onDateChange }: TimeFilterProps) {
  const ranges: TimeRange[] = ['Settimana', 'Mese', 'Anno', 'Tutto'];
  
  const shiftDate = (direction: number) => {
    const date = new Date(baseDate);
    if (timeRange === 'Settimana') date.setDate(date.getDate() + (direction * 7));
    else if (timeRange === 'Mese') date.setMonth(date.getMonth() + direction);
    else if (timeRange === 'Anno') date.setFullYear(date.getFullYear() + direction);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const getLabel = () => {
    const date = new Date(baseDate);
    if (timeRange === 'Settimana') {
       const start = new Date(date);
       start.setDate(date.getDate() - 6);
       return `${start.getDate()}/${start.getMonth()+1} - ${date.getDate()}/${date.getMonth()+1}`;
    }
    if (timeRange === 'Mese') return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    if (timeRange === 'Anno') return date.getFullYear().toString();
    return 'Da sempre';
  };

  return (
    <View style={styles.stickyFilterWrapper}>
      <View style={styles.filterContainer}>
        {ranges.map((r) => (
          <Pressable key={r} onPress={() => setTimeRange(r)} style={[styles.filterButton, timeRange === r && styles.filterButtonActive]}>
            <Text style={[styles.filterButtonText, timeRange === r && styles.filterButtonTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      
      {timeRange !== 'Tutto' && (
        <View style={styles.periodSlider}>
          <Pressable onPress={() => shiftDate(-1)} style={styles.sliderBtn}>
             <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </Pressable>
          <Text style={styles.periodLabel}>{getLabel()}</Text>
          <Pressable onPress={() => shiftDate(1)} style={styles.sliderBtn}>
             <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stickyFilterWrapper: { backgroundColor: COLORS.surface, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, zIndex: 10 },
  filterContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: 4 },
  filterButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  filterButtonActive: { backgroundColor: COLORS.surface, ...SHADOWS.soft },
  filterButtonText: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.secondary },
  filterButtonTextActive: { color: COLORS.primary },
  periodSlider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, marginHorizontal: SPACING.lg },
  sliderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary, textTransform: 'capitalize' },
});
