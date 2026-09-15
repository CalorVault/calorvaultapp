import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface WeekStripDay {
  date: string; // ISO yyyy-mm-dd
  dayLabel: string; // "Tue", "Wed", ...
  totalCalories: number;
  target: number;
  hasEntries: boolean;
}

interface Props {
  days: WeekStripDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function WeekStrip({ days, selectedDate, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const selected = day.date === selectedDate;
        const isFuture = day.date > selectedDate;
        const logged = day.hasEntries && !selected;
        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.date)}
            style={styles.dayColumn}
            accessibilityLabel={`${day.dayLabel} ${Number(day.date.slice(-2))}${logged ? ', logged' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
              {day.dayLabel}
            </Text>
            <View
              style={[
                styles.dateCircle,
                logged && styles.dateCircleLogged,
                selected && styles.dateCircleSelected,
                isFuture && !selected && styles.dateCircleFuture,
              ]}
            >
              <Text
                style={[
                  styles.dateNum,
                  logged && styles.dateNumLogged,
                  selected && styles.dateNumSelected,
                ]}
              >
                {Number(day.date.slice(-2))}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  dayLabelSelected: {
    color: colors.text,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleLogged: {
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
  dateCircleFuture: {
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  dateCircleSelected: {
    borderColor: colors.ink,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  dateNum: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dateNumLogged: {
    color: colors.text,
  },
  dateNumSelected: {
    color: colors.ink,
    fontWeight: '700',
  },
});
