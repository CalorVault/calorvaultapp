import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieSummary } from '../components/CalorieSummary';
import { FoodEntryRow } from '../components/FoodEntryRow';
import { MacroBars } from '../components/MacroBars';
import { SettingsIcon, ShareIcon } from '../components/NavIcons';
import { WaterCard } from '../components/WaterCard';
import { WeekStrip } from '../components/WeekStrip';
import { useApp } from '../context/AppContext';
import { useWeekDays } from '../hooks/useWeekDays';
import { goalLabels } from '../lib/goalLabels';
import { HomeScreenNavigationProp } from '../navigation/types';
import { getDayLog, todayIso, WATER_CUP_ML } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { DayLog } from '../types';

export function HomeScreen() {
  const { profile, plan, today, deleteFood, t, waterMl, waterTargetMl, addWater } = useApp();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { days: weekDays } = useWeekDays(plan?.calorieTarget ?? 0, today.entries.length);
  const [showEaten, setShowEaten] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [pastDayLog, setPastDayLog] = useState<DayLog | null>(null);
  const isToday = selectedDate === todayIso();

  useEffect(() => {
    if (isToday) {
      setPastDayLog(null);
      return;
    }
    getDayLog(selectedDate).then(setPastDayLog);
  }, [selectedDate, isToday]);

  const displayLog = isToday ? today : pastDayLog ?? { date: selectedDate, entries: [] };

  const totals = useMemo(() => {
    return displayLog.entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.proteinG,
        carbs: acc.carbs + e.carbsG,
        fat: acc.fat + e.fatG,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [displayLog.entries]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = weekDays.length - 1; i >= 0; i--) {
      if (weekDays[i].hasEntries) count++;
      else break;
    }
    return count;
  }, [weekDays]);

  const target = plan?.calorieTarget ?? 2000;
  const goalLabel = profile ? goalLabels(t)[profile.goal] : t.goals.gettingStarted;

  function handleSelectDay(date: string) {
    setSelectedDate(date);
  }

  function handleShare() {
    navigation.navigate('ShareDay', {
      calories: totals.calories,
      target,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      streak,
      dateLabel: new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    });
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.container}
        data={displayLog.entries}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={styles.topBarSide}>
                <View style={styles.streakPill}>
                  <Text style={styles.streakIcon}>🔥</Text>
                  <Text style={styles.streakText}>{streak}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.shareIconButton, pressed && styles.pressedDim]}
                  onPress={handleShare}
                  hitSlop={8}
                  accessibilityLabel={t.shareCard.title}
                >
                  <ShareIcon size={16} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.wordmark}>
                <Text style={styles.wordmarkCalor}>Calor</Text>
                <Text style={styles.wordmarkVault}>Vault</Text>
              </Text>
              <View style={[styles.topBarSide, styles.topBarSideRight]}>
                <Pressable
                  style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedDim]}
                  onPress={() => navigation.navigate('Settings')}
                  hitSlop={8}
                  accessibilityLabel={t.common.settings}
                  accessibilityRole="button"
                >
                  <SettingsIcon size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <View style={styles.spacerLg} />
            <WeekStrip
              days={weekDays}
              selectedDate={selectedDate}
              onSelect={handleSelectDay}
            />
            <View style={styles.spacerLg} />
            <CalorieSummary
              consumed={totals.calories}
              target={target}
              goalLabel={goalLabel}
              showEaten={showEaten}
              onToggle={() => setShowEaten((v) => !v)}
            />
            <MacroBars
              protein={{ consumed: totals.protein, target: plan?.proteinG ?? 0 }}
              carbs={{ consumed: totals.carbs, target: plan?.carbsG ?? 0 }}
              fat={{ consumed: totals.fat, target: plan?.fatG ?? 0 }}
              showEaten={showEaten}
              onToggle={() => setShowEaten((v) => !v)}
            />
            {isToday && (
              <>
                <View style={styles.spacerLg} />
                <WaterCard
                  ml={waterMl}
                  targetMl={waterTargetMl}
                  cupMl={WATER_CUP_ML}
                  label={t.tracking.waterLabel}
                  onAddCup={() => addWater(WATER_CUP_ML)}
                  onRemoveCup={() => addWater(-WATER_CUP_ML)}
                />
              </>
            )}
            {!isToday && (
              <>
                <View style={styles.spacerLg} />
                <Text style={styles.dateHeading}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </>
            )}
            <Text style={styles.sectionTitle}>
              {isToday ? t.home.recentUploads : t.dayDetail.foodLogged}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FoodEntryRow entry={item} onDelete={isToday ? deleteFood : undefined} />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isToday ? t.home.emptyState : t.dayDetail.emptyState}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareIconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  topBarSideRight: {
    justifyContent: 'flex-end',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  streakIcon: { fontSize: 14 },
  streakText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  wordmark: {
    fontSize: 24,
    fontWeight: '800',
  },
  wordmarkCalor: {
    color: colors.ink,
  },
  wordmarkVault: {
    color: colors.accent,
  },
  spacerLg: { height: spacing.lg },
  dateHeading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
