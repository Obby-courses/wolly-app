import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';

export type TimeRange = 'Settimana' | 'Mese' | 'Anno' | 'Tutto';

interface TimeFilterProps {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  baseDate: string;
  onDateChange: (newDate: string) => void;
}

export default function TimeFilter({ timeRange, setTimeRange, baseDate, onDateChange }: TimeFilterProps) {
  const ranges: TimeRange[] = ['Settimana', 'Mese', 'Anno', 'Tutto'];
  const [firstDateStr, setFirstDateStr] = useState<string | null>(null);

  useEffect(() => {
    TransactionRepository.getFirstTransactionDate().then(setFirstDateStr).catch(console.error);
  }, []);
  
  const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const isFutureLimitReached = (): boolean => {
    const date = parseLocalDate(baseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (timeRange === 'Settimana') {
      return date >= today;
    }
    if (timeRange === 'Mese') {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const dateYear = date.getFullYear();
      const dateMonth = date.getMonth();
      return dateYear > todayYear || (dateYear === todayYear && dateMonth >= todayMonth);
    }
    if (timeRange === 'Anno') {
      return date.getFullYear() >= today.getFullYear();
    }
    return false;
  };

  const isPastLimitReached = (): boolean => {
    if (!firstDateStr) return false;
    const date = parseLocalDate(baseDate);
    const firstDate = parseLocalDate(firstDateStr);
    
    date.setHours(0, 0, 0, 0);
    firstDate.setHours(0, 0, 0, 0);

    if (timeRange === 'Settimana') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - 6);
      return startOfWeek <= firstDate;
    }
    if (timeRange === 'Mese') {
      const firstYear = firstDate.getFullYear();
      const firstMonth = firstDate.getMonth();
      const dateYear = date.getFullYear();
      const dateMonth = date.getMonth();
      return dateYear < firstYear || (dateYear === firstYear && dateMonth <= firstMonth);
    }
    if (timeRange === 'Anno') {
      return date.getFullYear() <= firstDate.getFullYear();
    }
    return false;
  };

  const isNextDisabled = isFutureLimitReached();
  const isPrevDisabled = isPastLimitReached();

  const shiftDate = (direction: number) => {
    if (direction > 0 && isNextDisabled) return;
    if (direction < 0 && isPrevDisabled) return;

    const date = parseLocalDate(baseDate);
    if (timeRange === 'Settimana') date.setDate(date.getDate() + (direction * 7));
    else if (timeRange === 'Mese') date.setMonth(date.getMonth() + direction);
    else if (timeRange === 'Anno') date.setFullYear(date.getFullYear() + direction);
    
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    const nextD = String(date.getDate()).padStart(2, '0');
    onDateChange(`${nextY}-${nextM}-${nextD}`);
  };

  const getLabel = () => {
    const date = parseLocalDate(baseDate);
    if (timeRange === 'Settimana') {
       const start = new Date(date);
       start.setDate(date.getDate() - 6);
       return `${start.getDate()}/${start.getMonth()+1} - ${date.getDate()}/${date.getMonth()+1}`;
    }
    if (timeRange === 'Mese') return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    if (timeRange === 'Anno') return date.getFullYear().toString();
    return 'Da sempre';
  };

  const handleRangeChange = (r: TimeRange) => {
    setTimeRange(r);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${d}`);
  };

  return (
    <View style={styles.stickyFilterWrapper}>
      <View style={styles.filterContainer}>
        {ranges.map((r) => (
          <Pressable key={r} onPress={() => handleRangeChange(r)} style={[styles.filterButton, timeRange === r && styles.filterButtonActive]}>
            <Text style={[styles.filterButtonText, timeRange === r && styles.filterButtonTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      
      {timeRange !== 'Tutto' && (
        <View style={styles.periodSlider}>
          <Pressable 
            onPress={() => shiftDate(-1)} 
            disabled={isPrevDisabled}
            style={[styles.sliderBtn, isPrevDisabled && styles.sliderBtnDisabled]}
          >
             <Ionicons name="chevron-back" size={20} color={isPrevDisabled ? COLORS.secondary : COLORS.primary} />
          </Pressable>
          <Text style={styles.periodLabel}>{getLabel()}</Text>
          <Pressable 
            onPress={() => shiftDate(1)} 
            disabled={isNextDisabled}
            style={[styles.sliderBtn, isNextDisabled && styles.sliderBtnDisabled]}
          >
             <Ionicons name="chevron-forward" size={20} color={isNextDisabled ? COLORS.secondary : COLORS.primary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stickyFilterWrapper: { paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, zIndex: 10, backgroundColor: COLORS.background },
  filterContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: 4 },
  filterButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  filterButtonActive: { backgroundColor: COLORS.surface, ...SHADOWS.soft },
  filterButtonText: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.secondary },
  filterButtonTextActive: { color: COLORS.primary },
  periodSlider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, marginHorizontal: SPACING.lg },
  sliderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sliderBtnDisabled: { opacity: 0.3 },
  periodLabel: { fontSize: TYPOGRAPHY.sizes.sm, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary, textTransform: 'capitalize' },
});

