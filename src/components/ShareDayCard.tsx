import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CarbsIcon, FatIcon, ProteinIcon } from './NutritionIcons';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';

interface Props {
  calories: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
  streak: number;
  dateLabel: string;
}

const RING_SIZE = 168;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ShareDayCard({ calories, target, protein, carbs, fat, streak, dateLabel }: Props) {
  const { t } = useApp();
  const percent = target > 0 ? Math.min(1, calories / target) : 0;
  const dashoffset = RING_CIRCUMFERENCE * (1 - percent);

  return (
    <View style={styles.card}>
      <Text style={styles.wordmark}>
        <Text style={styles.wordmarkCalor}>Calor</Text>
        <Text style={styles.wordmarkVault}>Vault</Text>
      </Text>
      <Text style={styles.date}>{dateLabel.toUpperCase()}</Text>

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.accent}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={dashoffset}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.ringNum}>{calories}</Text>
          <Text style={styles.ringLabel}>{t.shareCard.kcalEaten}</Text>
        </View>
      </View>

      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <View style={styles.macroIconWrap}>
            <ProteinIcon size={22} color={colors.protein} />
          </View>
          <Text style={styles.macroVal}>{protein}g</Text>
          <Text style={styles.macroLabel}>{t.settings.protein}</Text>
        </View>
        <View style={styles.macroItem}>
          <View style={styles.macroIconWrap}>
            <CarbsIcon size={22} color={colors.carbs} />
          </View>
          <Text style={styles.macroVal}>{carbs}g</Text>
          <Text style={styles.macroLabel}>{t.settings.carbs}</Text>
        </View>
        <View style={styles.macroItem}>
          <View style={styles.macroIconWrap}>
            <FatIcon size={22} color={colors.fat} />
          </View>
          <Text style={styles.macroVal}>{fat}g</Text>
          <Text style={styles.macroLabel}>{t.settings.fat}</Text>
        </View>
      </View>

      {streak > 0 && (
        <View style={styles.streakPill}>
          <Text style={styles.streakText}>
            🔥 {streak} {t.shareCard.dayStreak}
          </Text>
        </View>
      )}
    </View>
  );
}

const CARD_WIDTH = 300;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    aspectRatio: 9 / 16,
    backgroundColor: colors.ink,
    borderRadius: 28,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  wordmark: { fontSize: 15, fontWeight: '800' },
  wordmarkCalor: { color: colors.white },
  wordmarkVault: { color: colors.accent },
  date: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  ringWrap: {
    marginTop: spacing.xl,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringCenter: { alignItems: 'center' },
  ringNum: { color: '#fff', fontSize: 34, fontWeight: '800' },
  ringLabel: { color: '#D1D5DB', fontSize: 11, marginTop: 2 },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  macroItem: { alignItems: 'center', gap: 6 },
  macroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroVal: { color: '#fff', fontSize: 14, fontWeight: '700' },
  macroLabel: { color: '#9CA3AF', fontSize: 9 },
  streakPill: {
    marginTop: 'auto',
    backgroundColor: 'rgba(216,101,44,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(216,101,44,0.4)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  streakText: { color: '#F0A576', fontSize: 12, fontWeight: '700' },
});
