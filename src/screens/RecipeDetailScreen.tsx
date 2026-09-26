import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
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
import { CarbsIcon, FatIcon, ProteinIcon } from '../components/NutritionIcons';
import { MealIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { recipeImage } from '../data/recipePhotos';
import { servingsText } from '../lib/mealPlan';
import { getRecipeMethod, RecipeMethod } from '../lib/recipeApi';
import { RootStackParamList } from '../navigation/types';
import { todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { RecipeIngredient } from '../types';

const PLURAL_UNITS: Record<string, string> = { clove: 'cloves', slice: 'slices', pinch: 'pinches' };

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

function formatAmount(amount: number, unit: string): string {
  if (amount <= 0) return '';
  if (unit === 'g' || unit === 'ml') {
    return String(amount >= 20 ? Math.round(amount / 5) * 5 : Math.round(amount));
  }
  const quarters = Math.round(amount * 4) / 4;
  if (quarters === 0) return String(Math.round(amount * 10) / 10);
  const whole = Math.floor(quarters);
  const frac = FRACTIONS[String(quarters - whole)] ?? '';
  return whole > 0 ? `${whole}${frac}` : frac;
}

function metricAmount(ing: RecipeIngredient, multiplier: number): string {
  const m = ing.unit === 'g' || ing.unit === 'ml' ? { amount: ing.amount, unit: ing.unit } : ing.metric;
  if (!m) return '';
  const amount = formatAmount(m.amount * multiplier, m.unit);
  return amount ? `${amount}${m.unit}` : '';
}

function ingredientLine(ing: RecipeIngredient, multiplier: number): string {
  const amount = formatAmount(ing.amount * multiplier, ing.unit);
  const scaled = ing.amount * multiplier;
  const unitWord = scaled > 1 && PLURAL_UNITS[ing.unit] ? PLURAL_UNITS[ing.unit] : ing.unit;
  const unit = unitWord && amount ? (unitWord === 'g' || unitWord === 'ml' ? unitWord : ` ${unitWord}`) : '';
  const line = [amount ? `${amount}${unit}` : '', ing.name].filter(Boolean).join(' ');
  const metric = ing.metric ? metricAmount(ing, multiplier) : '';
  return metric ? `${line} (${metric})` : line;
}

// Built-in steps mark amounts as "{index}" so they scale with the servings.
function stepLine(step: string, ingredients: RecipeIngredient[], multiplier: number): string {
  return step.replace(/\{(\d+)\}/g, (token, i) => {
    const ing = ingredients[Number(i)];
    return ing ? metricAmount(ing, multiplier) || formatAmount(ing.amount * multiplier, ing.unit) : token;
  });
}

// Methods fetched from the recipe API are cached for the session so reopening
// a recipe doesn't spend another request from the daily quota.
const methodCache = new Map<string, RecipeMethod>();

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RecipeDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'RecipeDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logFood, recipeApiKey, t } = useApp();
  const [saving, setSaving] = useState(false);
  const { recipe, servings } = route.params;
  const servingsLabel = servings ? servingsText(servings, t) : null;
  const multiplier = servings ?? 1;

  const builtIn: RecipeMethod | null = recipe.steps
    ? { ingredients: recipe.ingredients ?? [], steps: recipe.steps }
    : null;
  const [method, setMethod] = useState<RecipeMethod | null>(
    builtIn ?? methodCache.get(recipe.id) ?? null
  );
  const [methodLoading, setMethodLoading] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);

  useEffect(() => {
    if (method || !recipeApiKey || !recipe.imageUrl) return;
    let cancelled = false;
    setMethodLoading(true);
    getRecipeMethod(recipeApiKey, recipe.id)
      .then((m) => {
        methodCache.set(recipe.id, m);
        if (!cancelled) setMethod(m);
      })
      .catch((err) => {
        if (!cancelled) setMethodError(err instanceof Error ? err.message : t.recipes.methodFailed);
      })
      .finally(() => {
        if (!cancelled) setMethodLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [method, recipeApiKey, recipe.id, recipe.imageUrl, t]);

  async function handleLog() {
    setSaving(true);
    await logFood({
      id: makeId(),
      foodName: recipe.name,
      quantity: servingsLabel ?? `1 ${t.mealPlan.serving}`,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
      date: todayIso(),
      loggedAt: new Date().toISOString(),
      method: 'recipe',
      recipeId: recipe.id,
      imageUrl: recipe.imageUrl,
    });
    setSaving(false);
    navigation.goBack();
  }

  const image = recipeImage(recipe);

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <ScrollView>
      <View style={[styles.hero, image ? null : { backgroundColor: recipe.tint ?? colors.surfaceAlt }]}>
        {image ? (
          <Image source={image} style={styles.heroImage} />
        ) : (
          <Text style={styles.heroEmoji}>{recipe.emoji}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{recipe.name}</Text>
        <Text style={styles.time}>
          {recipe.timeMinutes} {t.recipes.minutes}
          {servingsLabel ? ` · ${servingsLabel}` : ''}
        </Text>

        <View style={styles.caloriesRow}>
          <MealIcon size={22} color={colors.ink} />
          <Text style={styles.caloriesText}>{recipe.calories} kcal</Text>
        </View>

        <View style={styles.macroRow}>
          <MacroStat Icon={CarbsIcon} color={colors.carbs} label={t.onboarding.carbs} grams={recipe.carbsG} />
          <MacroStat Icon={FatIcon} color={colors.fat} label={t.onboarding.fat} grams={recipe.fatG} />
          <MacroStat Icon={ProteinIcon} color={colors.protein} label={t.onboarding.protein} grams={recipe.proteinG} />
        </View>

        <Pressable style={styles.logButton} onPress={handleLog} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.logButtonText}>{t.recipes.logThisMeal}</Text>
          )}
        </Pressable>

        {methodLoading && (
          <View style={styles.methodLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.methodNote}>{t.recipes.methodLoading}</Text>
          </View>
        )}
        {methodError && <Text style={styles.methodNote}>{methodError}</Text>}
        {!method && !methodLoading && !methodError && (
          <Text style={styles.methodNote}>{t.recipes.methodUnavailable}</Text>
        )}

        {method && method.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.recipes.ingredients}</Text>
            {servingsLabel && (
              <Text style={styles.methodNote}>
                {t.recipes.amountsFor} {servingsLabel}
              </Text>
            )}
            {method.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingredientRow}>
                <View style={styles.bullet} />
                <Text style={styles.ingredientText}>{ingredientLine(ing, multiplier)}</Text>
              </View>
            ))}
          </View>
        )}

        {method && method.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.recipes.method}</Text>
            {method.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>
                  {stepLine(step, method.ingredients, multiplier)}
                </Text>
              </View>
            ))}
          </View>
        )}

      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroStat({
  Icon,
  color,
  label,
  grams,
}: {
  Icon: React.ComponentType<{ size?: number; color: string }>;
  color: string;
  label: string;
  grams: number;
}) {
  return (
    <View style={styles.macroStat}>
      <View style={[styles.macroRing, { borderColor: color }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={styles.macroGrams}>{grams}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  hero: {
    height: 240,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 72 },
  heroImage: { width: '100%', height: '100%' },
  body: { padding: spacing.lg },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  time: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  caloriesText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  macroStat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  macroRing: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroGrams: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  logButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  logButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  methodLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  methodNote: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  section: { marginTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  ingredientText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
});
