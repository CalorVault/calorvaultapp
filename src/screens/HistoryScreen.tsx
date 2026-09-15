import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieTrendChart } from '../components/CalorieTrendChart';
import { WeekStrip } from '../components/WeekStrip';
import { WeightChart } from '../components/WeightChart';
import { useApp } from '../context/AppContext';
import { useWeekDays } from '../hooks/useWeekDays';
import { getDayLogs, lastNDates, todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

interface HistoryRow {
  date: string;
  totalCalories: number;
  entryCount: number;
}

export function HistoryScreen() {
  const { plan, t, weightLog, logWeight } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);
  const { days: weekDays } = useWeekDays(plan?.calorieTarget ?? 0);

  const trendDays = useMemo(
    () => weekDays.map((d) => ({ date: d.date, dayLabel: d.dayLabel, calories: d.totalCalories })),
    [weekDays]
  );

  async function handleLogWeight() {
    const kg = parseFloat(weightInput);
    if (Number.isNaN(kg) || kg <= 0) return;
    setLoggingWeight(true);
    try {
      await logWeight(Math.round(kg * 10) / 10);
      setWeightInput('');
    } catch (err) {
      Alert.alert(t.tracking.couldNotLogWeightTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setLoggingWeight(false);
    }
  }

  const loadRows = useCallback(async () => {
    const dates = lastNDates(30);
    const logs = await getDayLogs(dates);
    const history = logs
      .slice()
      .reverse()
      .map((log) => ({
        date: log.date,
        totalCalories: log.entries.reduce((s, e) => s + e.calories, 0),
        entryCount: log.entries.length,
      }))
      .filter((r) => r.entryCount > 0);
    setRows(history);
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.history.title}</Text>
      </View>
      <View style={styles.weekWrap}>
        <WeekStrip
          days={weekDays}
          selectedDate={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            navigation.navigate('DayDetail', { date });
          }}
        />
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(item) => item.date}
        ListHeaderComponent={
          <View style={styles.chartsBlock}>
            <CalorieTrendChart
              days={trendDays}
              target={plan?.calorieTarget ?? 0}
              label={t.tracking.thisWeek}
            />

            <View style={styles.logWeightCard}>
              <Text style={styles.logWeightLabel}>{t.tracking.logWeightTitle}</Text>
              <View style={styles.logWeightRow}>
                <TextInput
                  style={styles.logWeightInput}
                  placeholder={t.settings.weightLabel}
                  placeholderTextColor={colors.textMuted}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.logWeightButton,
                    !weightInput.trim() && styles.logWeightButtonDisabled,
                    pressed && styles.pressedDim,
                  ]}
                  onPress={handleLogWeight}
                  disabled={!weightInput.trim() || loggingWeight}
                >
                  {loggingWeight ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.logWeightButtonText}>{t.logFood.logButton}</Text>
                  )}
                </Pressable>
              </View>
            </View>

            {weightLog.length > 0 && (
              <WeightChart entries={weightLog} label={t.tracking.weightChartLabel} />
            )}

            <Text style={styles.sectionTitle}>{t.tracking.recentDays}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const target = plan?.calorieTarget ?? 0;
          const diff = item.totalCalories - target;
          return (
            <View
              style={styles.rowTouchable}
              onTouchEnd={() => navigation.navigate('DayDetail', { date: item.date })}
            >
              <View>
                <Text style={styles.rowDate}>
                  {new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.rowMeta}>{item.entryCount} {t.history.itemsLogged}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowCalories}>{item.totalCalories} kcal</Text>
                {target > 0 && (
                  <Text
                    style={[
                      styles.rowDiff,
                      diff > 0 ? styles.rowDiffOver : styles.rowDiffUnder,
                    ]}
                  >
                    {diff > 0 ? `+${diff}` : diff} {t.history.vsTarget}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t.history.emptyState}</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  weekWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  chartsBlock: { gap: spacing.md, marginBottom: spacing.sm },
  logWeightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  logWeightLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  logWeightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logWeightInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
  },
  logWeightButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logWeightButtonDisabled: { opacity: 0.4 },
  logWeightButtonText: { color: colors.background, fontWeight: '700' },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  rowTouchable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowDate: { color: colors.text, fontWeight: '600', fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowCalories: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowDiff: { fontSize: 12, marginTop: 2 },
  rowDiffOver: { color: colors.danger },
  rowDiffUnder: { color: colors.primary },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: 14,
  },
});
