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
  chartStyles,
  DayMacros,
  LegendItem,
  MacroMeter,
  MacroStackChart,
} from '../components/ProgressCharts';
import { WeightChart } from '../components/WeightChart';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { getDayLogs, lastNDates } from '../storage/db';
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
  const { plan, t, weightLog, logWeight, today } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [range, setRange] = useState<Range>(7);
  const [days, setDays] = useState<DayMacros[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDayLogs(lastNDates(range)).then((logs) => {
        if (cancelled) return;
        setDays(
          logs.map((log) => {
            const sum = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
              log.entries.reduce((s, e) => s + e[k], 0);
            const d = new Date(log.date + 'T00:00:00');
            return {
              date: log.date,
              axisLabel:
                range === 7
                  ? d.toLocaleDateString(undefined, { weekday: 'short' })
                  : String(d.getDate()),
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
    }, [range, today])
  );

  const stats = useMemo(() => {
    const logged = days.filter((d) => d.hasEntries);
    const avg = (k: keyof Pick<DayMacros, 'calories' | 'proteinG' | 'carbsG' | 'fatG'>) =>
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

  const selected = days.find((d) => d.date === selectedDate) ?? null;

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

  const macroLabels = {
    proteinG: t.onboarding.protein,
    fatG: t.onboarding.fat,
    carbsG: t.onboarding.carbs,
  };

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

        <View style={styles.kpiRow}>
          <Kpi label={t.progress.avgCalories} value={Math.round(stats.calories).toLocaleString()} />
          <Kpi label={t.progress.daysLogged} value={`${stats.loggedCount}/${range}`} />
          <Kpi label={t.progress.onTarget} value={String(stats.onTarget)} unit={t.progress.days} />
        </View>

        {selected && (
          <View style={styles.detailCard}>
            <View style={styles.detailText}>
              <Text style={styles.detailDate}>{formatDate(selected.date)}</Text>
              <Text style={styles.detailValues}>
                {selected.calories.toLocaleString()} kcal · P {Math.round(selected.proteinG)}g · F{' '}
                {Math.round(selected.fatG)}g · C {Math.round(selected.carbsG)}g
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.openDay, pressed && styles.pressedDim]}
              onPress={() => navigation.navigate('DayDetail', { date: selected.date })}
            >
              <Text style={styles.openDayText}>{t.progress.openDay} ›</Text>
            </Pressable>
          </View>
        )}

        <View style={chartStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t.progress.caloriesChart}</Text>
            {plan && (
              <View style={styles.targetKey}>
                <View style={styles.targetKeyLine} />
                <Text style={styles.cardMeta}>
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
          />
          <Text style={styles.hint}>{t.progress.tapHint}</Text>
        </View>

        <View style={chartStyles.card}>
          <Text style={styles.cardTitle}>{t.progress.macrosChart}</Text>
          <View style={styles.legendRow}>
            {(['proteinG', 'fatG', 'carbsG'] as const).map((k) => (
              <LegendItem
                key={k}
                color={k === 'proteinG' ? colors.protein : k === 'fatG' ? colors.fat : colors.carbs}
                label={macroLabels[k]}
                value={`${Math.round(stats[k])}g ${t.progress.avgPerDay}`}
              />
            ))}
          </View>
          <MacroStackChart days={days} selectedDate={selectedDate} onSelect={handleSelect} />
        </View>

        {plan && (
          <View style={chartStyles.card}>
            <Text style={styles.cardTitle}>{t.progress.avgVsTarget}</Text>
            <MacroMeter label={t.onboarding.protein} color={colors.protein} value={stats.proteinG} target={plan.proteinG} />
            <MacroMeter label={t.onboarding.fat} color={colors.fat} value={stats.fatG} target={plan.fatG} />
            <MacroMeter label={t.onboarding.carbs} color={colors.carbs} value={stats.carbsG} target={plan.carbsG} />
          </View>
        )}

        {stats.loggedCount === 0 && <Text style={styles.empty}>{t.progress.noData}</Text>}

        <View style={chartStyles.card}>
          <Text style={styles.cardTitle}>{t.tracking.logWeightTitle}</Text>
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

        {weightLog.length > 0 && <WeightChart entries={weightLog} label={t.tracking.weightChartLabel} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>
        {value}
        {unit ? <Text style={styles.kpiUnit}> {unit}</Text> : null}
      </Text>
    </View>
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
});
