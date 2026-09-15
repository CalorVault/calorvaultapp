import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MealIcon } from './NavIcons';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';

interface Props {
  consumed: number;
  target: number;
  goalLabel: string;
  showEaten: boolean;
  onToggle: () => void;
}

const RING_SIZE = 90;
const STROKE_WIDTH = 7;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieSummary({ consumed, target, goalLabel, showEaten, onToggle }: Props) {
  const { t } = useApp();
  const over = consumed > target;
  const remainingOrOver = over ? consumed - target : Math.max(0, target - consumed);
  const bigNumber = showEaten ? consumed : remainingOrOver;
  const caption = showEaten ? t.calorieSummary.eaten : over ? t.calorieSummary.over : t.calorieSummary.left;
  const percent = target > 0 ? Math.min(1, consumed / target) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - percent);

  return (
    <Pressable
      style={styles.card}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${bigNumber.toLocaleString()} calories ${caption}`}
      accessibilityHint="Double tap to toggle between calories eaten and calories left"
    >
      <View style={styles.left}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{goalLabel}</Text>
        </View>
        <Text style={styles.bigNumber}>{bigNumber.toLocaleString()}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={over ? colors.danger : colors.accent}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            fill="none"
            rotation={-90}
            originX={RING_SIZE / 2}
            originY={RING_SIZE / 2}
          />
        </Svg>
        <View style={styles.ringIconWrap}>
          <MealIcon size={24} color={colors.ink} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  left: {
    gap: spacing.xs,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  pillText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  bigNumber: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
  },
  caption: {
    color: colors.textMuted,
    fontSize: 14,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIconWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
