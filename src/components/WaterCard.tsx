import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WaterDropIcon } from './NutritionIcons';
import { colors, radius, spacing } from '../theme';

interface Props {
  ml: number;
  targetMl: number;
  cupMl: number;
  label: string;
  onAddCup: () => void;
  onRemoveCup: () => void;
}

export function WaterCard({ ml, targetMl, cupMl, label, onAddCup, onRemoveCup }: Props) {
  const percent = targetMl > 0 ? Math.min(1, ml / targetMl) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <WaterDropIcon size={18} color={colors.water} />
          </View>
          <View>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.amount}>
              {ml} <Text style={styles.amountMuted}>/ {targetMl} ml</Text>
            </Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressedDim]}
            onPress={onRemoveCup}
            hitSlop={8}
            accessibilityLabel="Remove a cup of water"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>−</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              pressed && styles.pressedDim,
            ]}
            onPress={onAddCup}
            hitSlop={8}
            accessibilityLabel="Add a cup of water"
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>+</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.trackBg}>
        <View style={[styles.trackFill, { width: `${percent * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  amount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  amountMuted: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.water,
    borderColor: colors.water,
  },
  buttonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  buttonTextPrimary: {
    color: colors.white,
  },
  trackBg: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.water,
  },
});
