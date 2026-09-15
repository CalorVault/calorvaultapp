import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CarbsIcon, FatIcon, ProteinIcon } from './NutritionIcons';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';

interface MacroCardProps {
  label: string;
  consumed: number;
  target: number;
  color: string;
  Icon: React.ComponentType<{ size?: number; color: string }>;
  showEaten: boolean;
  onToggle: () => void;
}

function MacroCard({ label, consumed, target, color, Icon, showEaten, onToggle }: MacroCardProps) {
  const { t } = useApp();
  const over = consumed > target;
  const remainingOrOver = over ? consumed - target : Math.max(0, target - consumed);
  const amount = showEaten ? consumed : remainingOrOver;
  const suffix = showEaten ? t.macroBars.eaten : over ? t.macroBars.over : t.macroBars.left;
  const ringColor = over ? colors.danger : color;

  return (
    <Pressable
      style={styles.card}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${amount} grams ${suffix}`}
      accessibilityHint="Double tap to toggle between grams eaten and grams left"
    >
      <View style={[styles.ring, { borderColor: ringColor }]}>
        <Icon size={26} color={ringColor} />
      </View>
      <Text style={styles.amount}>{amount}g</Text>
      <Text style={styles.label}>
        {label} <Text style={styles.labelEmphasis}>{suffix}</Text>
      </Text>
    </Pressable>
  );
}

interface Props {
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
  showEaten: boolean;
  onToggle: () => void;
}

export function MacroBars({ protein, carbs, fat, showEaten, onToggle }: Props) {
  const { t } = useApp();
  return (
    <View style={styles.row}>
      <MacroCard
        label={t.onboarding.carbs}
        color={colors.carbs}
        Icon={CarbsIcon}
        showEaten={showEaten}
        onToggle={onToggle}
        {...carbs}
      />
      <MacroCard
        label={t.onboarding.fat}
        color={colors.fat}
        Icon={FatIcon}
        showEaten={showEaten}
        onToggle={onToggle}
        {...fat}
      />
      <MacroCard
        label={t.onboarding.protein}
        color={colors.protein}
        Icon={ProteinIcon}
        showEaten={showEaten}
        onToggle={onToggle}
        {...protein}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  amount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  labelEmphasis: {
    color: colors.text,
    fontWeight: '700',
  },
});
