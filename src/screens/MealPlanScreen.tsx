import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Translations } from '../i18n';
import { goalLabels } from '../lib/goalLabels';
import { recipeImage } from '../data/recipePhotos';
import { generateMealPlan, planTotals, servingsText, swapMeal } from '../lib/mealPlan';
import { RootStackParamList } from '../navigation/types';
import { getMealPlan, saveMealPlan, todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { DayMealPlan, PlannedMeal, RecipeCategory } from '../types';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function MealPlanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { plan, profile, logFood, t } = useApp();
  const [mealPlan, setMealPlan] = useState<DayMealPlan | null>(null);
  const [building, setBuilding] = useState(true);
  const [swapping, setSwapping] = useState<RecipeCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(async (next: DayMealPlan) => {
    setMealPlan(next);
    await saveMealPlan(next);
  }, []);

  const buildNew = useCallback(async () => {
    if (!plan) return;
    setBuilding(true);
    setError(null);
    try {
      await persist(generateMealPlan(plan, todayIso()));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mealPlan.failed);
    } finally {
      setBuilding(false);
    }
  }, [plan, persist, t]);

  useEffect(() => {
    if (!plan) return;
    (async () => {
      const saved = await getMealPlan();
      // Reuse today's plan so it doesn't reshuffle every time the screen
      // opens; rebuild on a new day or after the calorie target changes.
      if (saved && saved.date === todayIso() && saved.calorieTarget === plan.calorieTarget) {
        setMealPlan(saved);
        setBuilding(false);
      } else {
        await buildNew();
      }
    })();
  }, [plan, buildNew]);

  async function handleSwap(slot: RecipeCategory) {
    if (!plan || !mealPlan) return;
    setSwapping(slot);
    try {
      const next = swapMeal(plan, mealPlan, slot);
      await persist({
        ...next,
        loggedSlots: (next.loggedSlots ?? []).filter((s) => s !== slot),
      });
    } finally {
      setSwapping(null);
    }
  }

  async function handleLog(meal: PlannedMeal) {
    if (!mealPlan) return;
    await logFood({
      id: makeId(),
      foodName: meal.recipe.name,
      quantity: servingsText(meal.servings, t),
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      date: todayIso(),
      loggedAt: new Date().toISOString(),
      method: 'recipe',
      recipeId: meal.recipe.id,
      imageUrl: meal.recipe.imageUrl,
    });
    await persist({ ...mealPlan, loggedSlots: [...(mealPlan.loggedSlots ?? []), meal.slot] });
  }

  function openMeal(meal: PlannedMeal) {
    navigation.navigate('RecipeDetail', {
      recipe: {
        ...meal.recipe,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
      },
      servings: meal.servings,
    });
  }

  if (!plan || !profile) return null;

  const totals = mealPlan ? planTotals(mealPlan.meals) : null;
  const goal = goalLabels(t)[profile.goal];

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t.mealPlan.title}</Text>
        <Text style={styles.subtitle}>
          {goal} · {plan.calorieTarget.toLocaleString()} kcal
        </Text>

        {building ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t.mealPlan.building}</Text>
          </View>
        ) : error || !mealPlan || !totals ? (
          <Text style={styles.errorText}>{error ?? t.mealPlan.failed}</Text>
        ) : (
          <>
            <View style={styles.totalsCard}>
              <TotalRow
                label="kcal"
                planned={totals.calories}
                target={plan.calorieTarget}
                color={colors.ink}
                unit=""
              />
              <TotalRow
                label={t.onboarding.protein}
                planned={totals.proteinG}
                target={plan.proteinG}
                color={colors.protein}
                unit="g"
              />
              <TotalRow
                label={t.onboarding.carbs}
                planned={totals.carbsG}
                target={plan.carbsG}
                color={colors.carbs}
                unit="g"
              />
              <TotalRow
                label={t.onboarding.fat}
                planned={totals.fatG}
                target={plan.fatG}
                color={colors.fat}
                unit="g"
              />
            </View>

            {mealPlan.meals.map((meal) => (
              <MealCard
                key={meal.slot}
                meal={meal}
                t={t}
                logged={(mealPlan.loggedSlots ?? []).includes(meal.slot)}
                swapping={swapping === meal.slot}
                onPress={() => openMeal(meal)}
                onSwap={() => handleSwap(meal.slot)}
                onLog={() => handleLog(meal)}
              />
            ))}
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.newPlanButton, pressed && styles.pressedDim]}
          onPress={buildNew}
          disabled={building}
        >
          <Text style={styles.newPlanText}>{t.mealPlan.newPlan}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TotalRow({
  label,
  planned,
  target,
  color,
  unit,
}: {
  label: string;
  planned: number;
  target: number;
  color: string;
  unit: string;
}) {
  const pct = Math.min(1, planned / Math.max(target, 1));
  return (
    <View style={styles.totalRow}>
      <View style={styles.totalLabels}>
        <Text style={styles.totalLabel}>{label}</Text>
        <Text style={styles.totalValue}>
          {planned.toLocaleString()}
          {unit} / {target.toLocaleString()}
          {unit}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MealCard({
  meal,
  t,
  logged,
  swapping,
  onPress,
  onSwap,
  onLog,
}: {
  meal: PlannedMeal;
  t: Translations;
  logged: boolean;
  swapping: boolean;
  onPress: () => void;
  onSwap: () => void;
  onLog: () => void;
}) {
  const { recipe } = meal;
  const image = recipeImage(recipe);
  return (
    <View style={styles.mealCard}>
      <Text style={styles.slotLabel}>{t.recipes.categories[meal.slot]}</Text>
      <Pressable
        style={({ pressed }) => [styles.mealRow, pressed && styles.pressedDim]}
        onPress={onPress}
      >
        <View style={[styles.thumb, { backgroundColor: recipe.tint ?? colors.surfaceAlt }]}>
          {image ? (
            <Image source={image} style={styles.thumbImage} />
          ) : (
            <Text style={styles.thumbEmoji}>{recipe.emoji ?? '🍽️'}</Text>
          )}
        </View>
        <View style={styles.mealInfo}>
          <Text style={styles.mealName} numberOfLines={2}>
            {recipe.name}
          </Text>
          <Text style={styles.mealMeta}>
            {servingsText(meal.servings, t)}
            {recipe.timeMinutes ? ` · ${recipe.timeMinutes} ${t.recipes.minutes}` : ''}
          </Text>
          <Text style={styles.mealMacros}>
            {meal.calories} kcal · P {meal.proteinG}g · C {meal.carbsG}g · F {meal.fatG}g
          </Text>
        </View>
      </Pressable>
      <View style={styles.mealActions}>
        <Pressable
          style={({ pressed }) => [styles.swapButton, pressed && styles.pressedDim]}
          onPress={onSwap}
          disabled={swapping}
        >
          {swapping ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.swapText}>{t.mealPlan.swap}</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.logButton,
            logged && styles.logButtonDone,
            pressed && styles.pressedDim,
          ]}
          onPress={onLog}
          disabled={logged}
        >
          <Text style={[styles.logText, logged && styles.logTextDone]}>
            {logged ? `✓ ${t.mealPlan.logged}` : t.mealPlan.log}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  pressedDim: { opacity: 0.6 },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: -spacing.sm },
  loadingBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 14 },
  totalsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  totalRow: { gap: 4 },
  totalLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  totalValue: { color: colors.textMuted, fontSize: 13 },
  barTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbEmoji: { fontSize: 30 },
  mealInfo: { flex: 1, gap: 2 },
  mealName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  mealMeta: { color: colors.textMuted, fontSize: 13 },
  mealMacros: { color: colors.text, fontSize: 13, fontWeight: '500' },
  mealActions: { flexDirection: 'row', gap: spacing.sm },
  swapButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  swapText: { color: colors.text, fontWeight: '700' },
  logButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  logButtonDone: { backgroundColor: colors.primaryMuted },
  logText: { color: colors.background, fontWeight: '700' },
  logTextDone: { color: colors.primaryDark },
  newPlanButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  newPlanText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
