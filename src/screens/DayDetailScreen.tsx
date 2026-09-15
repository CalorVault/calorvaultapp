import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieSummary } from '../components/CalorieSummary';
import { FoodEntryRow } from '../components/FoodEntryRow';
import { MacroBars } from '../components/MacroBars';
import { useApp } from '../context/AppContext';
import { goalLabels } from '../lib/goalLabels';
import { RootStackParamList } from '../navigation/types';
import { getDayLog } from '../storage/db';
import { colors, spacing } from '../theme';
import { DayLog } from '../types';

export function DayDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DayDetail'>>();
  const { plan, profile, t } = useApp();
  const { date } = route.params;
  const goalLabel = profile ? goalLabels(t)[profile.goal] : t.goals.gettingStarted;
  const [dayLog, setDayLog] = useState<DayLog>({ date, entries: [] });
  const [showEaten, setShowEaten] = useState(false);

  useEffect(() => {
    getDayLog(date).then(setDayLog);
  }, [date]);

  const totals = useMemo(() => {
    return dayLog.entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.proteinG,
        carbs: acc.carbs + e.carbsG,
        fat: acc.fat + e.fatG,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dayLog.entries]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.container}
        data={dayLog.entries}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>
              {new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <View style={styles.spacer} />
            <CalorieSummary
              consumed={totals.calories}
              target={plan?.calorieTarget ?? 0}
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
            <Text style={styles.sectionTitle}>{t.dayDetail.foodLogged}</Text>
          </View>
        }
        renderItem={({ item }) => <FoodEntryRow entry={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t.dayDetail.emptyState}</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  spacer: { height: spacing.md },
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
