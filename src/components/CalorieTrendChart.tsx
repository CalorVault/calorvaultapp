import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface TrendDay {
  date: string;
  dayLabel: string;
  calories: number;
}

interface Props {
  days: TrendDay[];
  target: number;
  label: string;
}

const BAR_MAX_HEIGHT = 90;

export function CalorieTrendChart({ days, target, label }: Props) {
  const maxValue = Math.max(target, ...days.map((d) => d.calories), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barsRow}>
        {days.map((day) => {
          const over = target > 0 && day.calories > target;
          const height = Math.max(2, (day.calories / maxValue) * BAR_MAX_HEIGHT);
          return (
            <View key={day.date} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height, backgroundColor: over ? colors.danger : colors.accent },
                  ]}
                />
                {target > 0 && (
                  <View
                    style={[
                      styles.targetLine,
                      { bottom: Math.min(BAR_MAX_HEIGHT, (target / maxValue) * BAR_MAX_HEIGHT) },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.dayLabel}>{day.dayLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  barTrack: {
    width: 18,
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    borderRadius: radius.sm,
  },
  targetLine: {
    position: 'absolute',
    left: -3,
    right: -3,
    height: 1.5,
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
