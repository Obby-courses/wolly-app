import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';

const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export type Frequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly';

interface Props {
  frequency: Frequency;
  recurrenceDay: string;
  startDate: string;
  onChange: (recurrenceDay: string, startDate: string) => void;
  // Per personalizzare il look negli schermi diversi
  containerStyle?: any;
  labelStyle?: any;
  inputStyle?: any;
}

export default function PeriodicDateSelector({
  frequency,
  recurrenceDay,
  startDate,
  onChange,
  containerStyle,
  labelStyle,
  inputStyle
}: Props) {
  // Calendar state for Yearly
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    if (isNaN(d.getTime())) {
      const today = new Date();
      return { year: today.getFullYear(), month: today.getMonth() };
    }
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Reset calendar to current month or selected date when frequency changes to yearly
  useEffect(() => {
    if (frequency === 'yearly') {
      const d = startDate ? new Date(startDate) : new Date();
      if (!isNaN(d.getTime())) {
        setCalendarDate({ year: d.getFullYear(), month: d.getMonth() });
      } else {
        const today = new Date();
        setCalendarDate({ year: today.getFullYear(), month: today.getMonth() });
      }
    }
  }, [frequency, startDate]);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
  };

  const changeMonth = (dir: 'next' | 'prev') => {
    setCalendarDate(curr => {
      let m = curr.month + (dir === 'next' ? 1 : -1);
      let y = curr.year;
      if (m > 11) { m = 0; y += 1; }
      if (m < 0) { m = 11; y -= 1; }
      return { year: y, month: m };
    });
  };

  const handleWeekdayToggle = (dayIndex: number) => {
    let mask = parseInt(recurrenceDay, 10);
    if (isNaN(mask)) mask = 0;
    
    // Toggle the bit
    const bit = 1 << dayIndex;
    mask = mask ^ bit;
    
    onChange(String(mask), startDate);
  };

  if (frequency === 'monthly') {
    return (
      <View style={containerStyle}>
        <Text style={[styles.label, labelStyle]}>Giorno del mese (1-31)</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          keyboardType="number-pad"
          placeholder="es. 15"
          placeholderTextColor={COLORS.secondary}
          value={recurrenceDay}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9]/g, '');
            if (clean === '') {
              onChange('', startDate);
              return;
            }
            const num = parseInt(clean, 10);
            if (num > 31) {
              onChange('31', startDate);
            } else if (num < 1) {
              onChange('1', startDate);
            } else {
              onChange(String(num), startDate);
            }
          }}
        />
      </View>
    );
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    let mask = parseInt(recurrenceDay, 10);
    if (isNaN(mask)) mask = 0;

    return (
      <View style={containerStyle}>
        <Text style={[styles.label, labelStyle]}>Giorni della settimana</Text>
        <View style={styles.weekdaysContainer}>
          {WEEKDAYS.map((d, i) => {
            const isSelected = (mask & (1 << i)) !== 0;
            return (
              <Pressable
                key={i}
                onPress={() => handleWeekdayToggle(i)}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelectedContainer
                ]}
              >
                {isSelected && (
                  <LinearGradient
                    colors={['#B3D9FF', '#E6F2FF']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                )}
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (frequency === 'yearly') {
    return (
      <View style={containerStyle}>
        <Text style={[styles.label, labelStyle]}>Data rinnovo annuale</Text>
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => changeMonth('prev')} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            </Pressable>
            <Text style={styles.calendarTitle}>
              {MONTHS_IT[calendarDate.month]} {calendarDate.year}
            </Text>
            <Pressable onPress={() => changeMonth('next')} style={{ padding: 4 }}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </Pressable>
          </View>
          <View style={styles.calendarWeekdaysRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.calendarWeekdayText}>{d}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {(() => {
              const days = getDaysInMonth(calendarDate.year, calendarDate.month);
              const firstDay = getFirstDayOfMonth(calendarDate.year, calendarDate.month);
              const grid = [];
              for (let i = 0; i < firstDay; i++) {
                grid.push(<View key={`empty-${i}`} style={styles.calendarCell} />);
              }
              for (let i = 1; i <= days; i++) {
                const dateStr = `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const isSelected = startDate === dateStr;
                grid.push(
                  <Pressable 
                    key={`day-${i}`} 
                    onPress={() => onChange(String(i), dateStr)}
                    style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                  >
                    <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>{i}</Text>
                  </Pressable>
                );
              }
              return grid;
            })()}
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  label: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weekdaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dayCell: {
    flex: 1,
    marginHorizontal: 2,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCellSelectedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  dayText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  dayTextSelected: {
    color: COLORS.brandBlue,
  },
  calendarContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarTitle: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    fontSize: 14,
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarCellSelected: {
    backgroundColor: '#0A74FF',
  },
  calendarDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  calendarDayCircleSelectedContainer: {
    backgroundColor: 'transparent',
  },
  calendarDayText: {
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontBold,
  },
});
