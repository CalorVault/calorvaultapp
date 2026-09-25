import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CaloriesChart,
  PanelLegendItem,
  PANEL,
  panelStyles,
  StatTile,
  DayMacros,
  hitAllGoals,
  MACRO_ORDER,
  MacroGoalChart,
} from '../components/ProgressCharts';
import { WeightChart } from '../components/WeightChart';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { getDayLogs, lastNDates, todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';

type Range = 7 | 30;

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function HistoryScreen() {
  const { plan, profile, t, weightLog, logWeight, today } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [range, setRange] = useState<Range>(7);
  const [allDays, setAllDays] = useState<DayMacros[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDayLogs(lastNDates(30)).then((logs) => {
        if (cancelled) return;
        setAllDays(
          logs.map((log) => {
            const sum = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
              log.entries.reduce((s, e) => s + e[k], 0);
            return {
              date: log.date,
              axisLabel: '',
              calories: sum('calories'),
              proteinG: sum('proteinG'),
              carbsG: sum('carbsG'),
              fatG: sum('fatG'),
              hasEntries: log.entries.length > 0,
            };
          })
        );
      });
      return () => {
        cancelled = true;
      };
    }, [today])
  );

  const days = useMemo(
    () =>
      allDays.slice(-range).map((d) => {
        const date = new Date(d.date + 'T00:00:00');
        return {
          ...d,
          axisLabel:
            range === 7 ? date.toLocaleDateString(undefined, { weekday: 'short' }) : String(date.getDate()),
        };
      }),
    [allDays, range]
  );

  // 30 days of three bars each is unreadable, so the 30-day macro chart shows
  // weekly averages instead: 7-day chunks back from today, with the leftover
  // oldest days folded into the first chunk.
  const macroDays = useMemo(() => {
    if (range === 7 || !plan) return days;
    const targets = { proteinG: plan.proteinG, fatG: plan.fatG, carbsG: plan.carbsG };
    const chunks: DayMacros[][] = [];
    for (let end = days.length; end > 0; end -= 7) chunks.unshift(days.slice(Math.max(0, end - 7), end));
    if (chunks.length > 1 && chunks[0].length < 7) chunks.splice(0, 2, [...chunks[0], ...chunks[1]]);
    const fmt = (iso: string) =>
      new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return chunks.map((chunk) => {
      const logged = chunk.filter((d) => d.hasEntries);
      const avg = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
        logged.length ? logged.reduce((s, d) => s + d[k], 0) / logged.length : 0;
      return {
        date: chunk[0].date,
        axisLabel: fmt(chunk[0].date),
        calories: avg('calories'),
        proteinG: avg('proteinG'),
        carbsG: avg('carbsG'),
        fatG: avg('fatG'),
        hasEntries: logged.length > 0,
        hitCount: chunk.filter((d) => hitAllGoals(d, targets)).length,
        spanLabel: `${fmt(chunk[0].date)} – ${fmt(chunk[chunk.length - 1].date)}`,
      };
    });
  }, [days, range, plan]);

  const stats = useMemo(() => {
    const logged = days.filter((d) => d.hasEntries);
    const avg = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
      logged.length ? logged.reduce((s, d) => s + d[k], 0) / logged.length : 0;
    const target = plan?.calorieTarget ?? 0;
    const onTarget = target
      ? logged.filter((d) => Math.abs(d.calories - target) <= target * 0.1).length
      : 0;
    return {
      loggedCount: logged.length,
      onTarget,
      calories: avg('calories'),
      proteinG: avg('proteinG'),
      carbsG: avg('carbsG'),
      fatG: avg('fatG'),
    };
  }, [days, plan]);

  const goals = useMemo(() => {
    if (!plan) return null;
    const targets = { proteinG: plan.proteinG, fatG: plan.fatG, carbsG: plan.carbsG };
    const logged = days.filter((d) => d.hasEntries);
    const pct = (k: keyof typeof targets) =>
      logged.length
        ? Math.round(
            (logged.reduce((s, d) => s + Math.min(d[k] / targets[k], 1), 0) / logged.length) * 100
          )
        : 0;
    const percents = { proteinG: pct('proteinG'), fatG: pct('fatG'), carbsG: pct('carbsG') };
    const hitDays = days.filter((d) => hitAllGoals(d, targets)).length;

    // Streak of consecutive days hitting all three, counting back from today;
    // today doesn't break it while it's still in progress.
    let streak = 0;
    const history = [...allDays].reverse();
    for (let i = 0; i < history.length; i++) {
      if (hitAllGoals(history[i], targets)) streak++;
      else if (i === 0 && history[i].date === todayIso()) continue;
      else break;
    }

    const worst = MACRO_ORDER.map((m) => m.key).reduce((a, b) => (percents[a] <= percents[b] ? a : b));
    const gap = Math.round((stats[worst] as number) - targets[worst]);
    return { targets, percents, hitDays, streak, worst, gap };
  }, [plan, days, allDays, stats]);

  const selected =
    macroDays.find((d) => d.date === selectedDate) ?? days.find((d) => d.date === selectedDate) ?? null;

  function handleSelect(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
  }

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

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t.nav.progress}</Text>
          <View style={styles.rangeToggle}>
            {([7, 30] as Range[]).map((r) => (
              <Pressable
                key={r}
                style={[styles.rangeOption, range === r && styles.rangeOptionActive]}
                onPress={() => {
                  setRange(r);
                  setSelectedDate(null);
                }}
              >
                <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>
                  {r === 7 ? t.progress.range7 : t.progress.range30}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {plan && goals && (
          <View style={panelStyles.card}>
            <View style={panelStyles.tiles}>
              <StatTile label={t.progress.allGoalsHit} value={`${goals.hitDays}/${range} ${t.progress.days}`} />
              <StatTile label={t.progress.streak} value={`${goals.streak} ${t.progress.days}`} />
              <StatTile
                label={t.progress.biggestGap}
                value={
                  stats.loggedCount === 0
                    ? '–'
                    : goals.gap >= 0 || goals.percents[goals.worst] >= 95
                    ? t.progress.onTrack
                    : `${goals.gap}g`
                }
                sub={
                  stats.loggedCount > 0 && goals.gap < 0 && goals.percents[goals.worst] < 95
                    ? `${({ proteinG: t.onboarding.protein, fatG: t.onboarding.fat, carbsG: t.onboarding.carbs })[goals.worst]} ${t.progress.perDay}`
                    : undefined
                }
                subColor={MACRO_ORDER.find((m) => m.key === goals.worst)?.color}
              />
            </View>
            <View style={panelStyles.headerRow}>
              <Text style={panelStyles.title}>{t.progress.macrosVsGoal}</Text>
              <Text style={panelStyles.meta}>{range === 7 ? t.progress.range7 : t.progress.range30}</Text>
            </View>
            <View style={panelStyles.legendRow}>
              {MACRO_ORDER.map((m) => (
                <PanelLegendItem
                  key={m.key}
                  color={m.color}
                  label={({ proteinG: t.onboarding.protein, fatG: t.onboarding.fat, carbsG: t.onboarding.carbs })[m.key]}
                  percent={goals.percents[m.key]}
                  suffix={t.progress.avgOfGoal}
                />
              ))}
            </View>
            <MacroGoalChart
              days={macroDays}
              targets={goals.targets}
              todayDate={todayIso()}
              todayLabel={t.progress.today}
              selectedDate={selectedDate}
              onSelect={handleSelect}
            />
            {selected ? (
              <View style={panelStyles.detail}>
                <Text style={panelStyles.detailDate}>
                  {selected.spanLabel
                    ? `${selected.spanLabel}\n${t.progress.weekAvg}`
                    : new Date(selected.date + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                      })}
                </Text>
                <View style={panelStyles.detailValues}>
                  {MACRO_ORDER.map((m) => (
                    <View key={m.key} style={panelStyles.detailValue}>
                      <View style={[panelStyles.swatch, { backgroundColor: m.color }]} />
                      <Text style={panelStyles.detailText}>
                        {Math.round(selected[m.key])}g / {goals.targets[m.key]}g
                      </Text>
                    </View>
                  ))}
                </View>
                {!selected.spanLabel && (
                  <Pressable
                    style={({ pressed }) => [panelStyles.openDay, pressed && styles.pressedDim]}
                    onPress={() => navigation.navigate('DayDetail', { date: selected.date })}
                  >
                    <Text style={panelStyles.openDayText}>{t.progress.openDay} ›</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={panelStyles.hint}>{t.progress.goalLegend}</Text>
            )}
          </View>
        )}

        <View style={panelStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={panelStyles.title}>{t.progress.caloriesChart}</Text>
            {plan && (
              <View style={styles.targetKey}>
                <View style={[styles.targetKeyLine, { backgroundColor: PANEL.text }]} />
                <Text style={panelStyles.meta}>
                  {t.progress.target} {plan.calorieTarget.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
          <CaloriesChart
            days={days}
            target={plan?.calorieTarget ?? 0}
            selectedDate={selectedDate}
            onSelect={handleSelect}
            dark
          />
          <Text style={panelStyles.hint}>
            {t.progress.avgCalories}: {Math.round(stats.calories).toLocaleString()} kcal · {t.progress.onTarget}:{' '}
            {stats.onTarget} {t.progress.days}
          </Text>
        </View>

        {stats.loggedCount === 0 && <Text style={styles.empty}>{t.progress.noData}</Text>}

        <View style={panelStyles.card}>
          <Text style={panelStyles.title}>{t.tracking.logWeightTitle}</Text>
          <View style={styles.logWeightRow}>
            <TextInput
              style={styles.logWeightInput}
              placeholder={t.settings.weightLabel}
              placeholderTextColor={PANEL.muted}
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

        {weightLog.length > 0 && profile && (
          <WeightChart
            entries={weightLog}
            goal={profile.goal}
            labels={{
              title: t.tracking.weightProgress,
              lost: t.tracking.lost,
              gained: t.tracking.gained,
              fromStart: t.tracking.fromStart,
              needMore: t.tracking.weightNeedMore,
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  rangeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 3,
  },
  rangeOption: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full },
  rangeOptionActive: { backgroundColor: colors.surface },
  rangeText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  rangeTextActive: { color: colors.text },
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpi: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  kpiLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  kpiValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  kpiUnit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailText: { flex: 1, gap: 2 },
  detailDate: { color: colors.white, fontWeight: '700', fontSize: 14 },
  detailValues: { color: '#D1D5DB', fontSize: 13 },
  openDay: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  openDayText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  targetKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetKeyLine: { width: 14, height: 1.5, backgroundColor: colors.ink, opacity: 0.55 },
  hint: { color: colors.textMuted, fontSize: 12 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  logWeightRow: { flexDirection: 'row', gap: spacing.sm },
  logWeightInput: {
    flex: 1,
    backgroundColor: PANEL.input,
    borderWidth: 1,
    borderColor: PANEL.grid,
    borderRadius: radius.md,
    padding: spacing.md,
    color: PANEL.text,
  },
  logWeightButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logWeightButtonDisabled: { opacity: 0.4 },
  logWeightButtonText: { color: colors.white, fontWeight: '700' },
});
