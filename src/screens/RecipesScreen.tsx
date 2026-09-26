import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RECIPES } from '../data/recipes';
import { recipeImage } from '../data/recipePhotos';
import { CarbsIcon, FatIcon, ProteinIcon } from '../components/NutritionIcons';
import { BookmarkIcon, BowlIcon, MealIcon, PlanDayIcon, SearchIcon, SettingsIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { Translations } from '../i18n';
import { searchRecipes } from '../lib/recipeApi';
import { RecipesScreenNavigationProp } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { Recipe, RecipeCategory } from '../types';

function categories(
  t: Translations
): { value: RecipeCategory; label: string; emoji: string; tint: string }[] {
  return [
    { value: 'breakfast', label: t.recipes.categories.breakfast, emoji: '🍳', tint: '#FDECC8' },
    { value: 'lunch', label: t.recipes.categories.lunch, emoji: '🥗', tint: '#DCE9FB' },
    { value: 'dinner', label: t.recipes.categories.dinner, emoji: '🍔', tint: '#DDF0E4' },
    { value: 'snack', label: t.recipes.categories.snack, emoji: '🍎', tint: '#FBDFE0' },
  ];
}

export function RecipesScreen() {
  const navigation = useNavigation<RecipesScreenNavigationProp>();
  const { savedRecipes, toggleSavedRecipe, recipeApiKey, plan, t } = useApp();
  const CATEGORIES = useMemo(() => categories(t), [t]);
  const [subTab, setSubTab] = useState<'discover' | 'saved' | 'macros'>('discover');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RecipeCategory | null>(null);
  const [apiResults, setApiResults] = useState<Recipe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [macroCalories, setMacroCalories] = useState(
    plan ? String(Math.round(plan.calorieTarget / 3)) : ''
  );
  const [macroProtein, setMacroProtein] = useState(
    plan ? String(Math.round(plan.proteinG / 3)) : ''
  );
  const [macroCarbs, setMacroCarbs] = useState(plan ? String(Math.round(plan.carbsG / 3)) : '');
  const [macroFat, setMacroFat] = useState(plan ? String(Math.round(plan.fatG / 3)) : '');
  const [macroResults, setMacroResults] = useState<Recipe[] | null>(null);
  const [bannerSize, setBannerSize] = useState<{ width: number; height: number } | null>(null);

  function handleFindByMacros() {
    setMacroResults(
      closestRecipes({
        calories: Number(macroCalories) || 0,
        proteinG: Number(macroProtein) || 0,
        carbsG: Number(macroCarbs) || 0,
        fatG: Number(macroFat) || 0,
      })
    );
  }

  const searching = query.trim().length > 0;

  // The app's own list is shown by default; the online search only runs when
  // someone types, so the recommendations stay everyday food.
  useEffect(() => {
    const id = ++requestId.current;
    setApiResults(null);
    setError(null);
    setLoading(false);
    if (subTab !== 'discover' || !recipeApiKey || !searching) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchRecipes(recipeApiKey, query, category);
        if (id === requestId.current) setApiResults(results);
      } catch (err) {
        if (id === requestId.current) {
          setError(err instanceof Error ? err.message : t.recipes.searchFailed);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [subTab, recipeApiKey, searching, query, category, t]);

  const results = useMemo(() => {
    if (subTab === 'saved') {
      let list = savedRecipes;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        list = list.filter((r) => r.name.toLowerCase().includes(q));
      }
      return list;
    }
    if (subTab === 'macros') return macroResults ?? [];
    let list = RECIPES;
    if (category) list = list.filter((r) => r.category === category);
    if (searching) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
      const own = new Set(list.map((r) => r.id));
      list = [...list, ...(apiResults ?? []).filter((r) => !own.has(r.id))];
    }
    return list;
  }, [subTab, category, query, searching, savedRecipes, apiResults, macroResults]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.container}
        data={results}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={styles.titleRow}>
                <BowlIcon size={26} color={colors.accent} />
                <Text style={styles.title}>{t.recipes.title}</Text>
              </View>
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

            {plan && (
              <Pressable
                style={({ pressed }) => [styles.planBanner, pressed && styles.pressedDim]}
                onPress={() => navigation.navigate('MealPlan')}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  if (width !== bannerSize?.width || height !== bannerSize?.height) {
                    setBannerSize({ width, height });
                  }
                }}
              >
                {/* Percentage sizes don't fill the card on iOS, so draw at the measured size. */}
                {bannerSize && (
                  <Svg
                    style={StyleSheet.absoluteFill}
                    width={bannerSize.width}
                    height={bannerSize.height}
                  >
                    <Defs>
                      <LinearGradient id="planBannerBg" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={colors.ink} />
                        <Stop offset="1" stopColor="#232C3D" />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x={0}
                      y={0}
                      width={bannerSize.width}
                      height={bannerSize.height}
                      fill="url(#planBannerBg)"
                    />
                  </Svg>
                )}
                <View style={styles.planBannerBadge}>
                  <PlanDayIcon size={28} color={colors.accent} fill={colors.white} />
                </View>
                <View style={styles.planBannerText}>
                  <Text style={styles.planBannerTitle}>{t.mealPlan.bannerTitle}</Text>
                  <Text style={styles.planBannerCopy}>
                    {plan.calorieTarget.toLocaleString()} kcal · {t.mealPlan.bannerCopy}
                  </Text>
                </View>
                <Text style={styles.planBannerChevron}>›</Text>
              </Pressable>
            )}

            <View style={styles.subTabRow}>
              <Pressable style={styles.subTabButton} onPress={() => setSubTab('discover')}>
                <Text style={[styles.subTabText, subTab === 'discover' && styles.subTabTextActive]}>
                  {t.recipes.discover}
                </Text>
                {subTab === 'discover' && <View style={styles.subTabUnderline} />}
              </Pressable>
              <Pressable style={styles.subTabButton} onPress={() => setSubTab('saved')}>
                <Text style={[styles.subTabText, subTab === 'saved' && styles.subTabTextActive]}>
                  {t.recipes.saved}
                </Text>
                {subTab === 'saved' && <View style={styles.subTabUnderline} />}
              </Pressable>
              <Pressable style={styles.subTabButton} onPress={() => setSubTab('macros')}>
                <Text style={[styles.subTabText, subTab === 'macros' && styles.subTabTextActive]}>
                  {t.recipes.byMacros}
                </Text>
                {subTab === 'macros' && <View style={styles.subTabUnderline} />}
              </Pressable>
            </View>

            {subTab !== 'macros' && (
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t.recipes.searchPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                />
                <SearchIcon size={18} color={colors.textMuted} />
              </View>
            )}

            {subTab === 'macros' && (
              <View style={styles.macroForm}>
                <Text style={styles.macroIntro}>{t.recipes.macrosIntro}</Text>
                <View style={styles.macroFieldRow}>
                  <View style={styles.macroField}>
                    <Text style={styles.macroFieldLabel}>{t.recipes.macrosCaloriesLabel}</Text>
                    <TextInput
                      style={styles.macroInput}
                      keyboardType="number-pad"
                      value={macroCalories}
                      onChangeText={setMacroCalories}
                    />
                  </View>
                  <View style={styles.macroField}>
                    <Text style={styles.macroFieldLabel}>{t.recipes.macrosProteinLabel}</Text>
                    <TextInput
                      style={styles.macroInput}
                      keyboardType="number-pad"
                      value={macroProtein}
                      onChangeText={setMacroProtein}
                    />
                  </View>
                </View>
                <View style={styles.macroFieldRow}>
                  <View style={styles.macroField}>
                    <Text style={styles.macroFieldLabel}>{t.recipes.macrosCarbsLabel}</Text>
                    <TextInput
                      style={styles.macroInput}
                      keyboardType="number-pad"
                      value={macroCarbs}
                      onChangeText={setMacroCarbs}
                    />
                  </View>
                  <View style={styles.macroField}>
                    <Text style={styles.macroFieldLabel}>{t.recipes.macrosFatLabel}</Text>
                    <TextInput
                      style={styles.macroInput}
                      keyboardType="number-pad"
                      value={macroFat}
                      onChangeText={setMacroFat}
                    />
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.macroFindButton, pressed && styles.pressedDim]}
                  onPress={handleFindByMacros}
                >
                  <Text style={styles.macroFindButtonText}>{t.recipes.macrosFindButton}</Text>
                </Pressable>
              </View>
            )}

            {subTab === 'discover' && (
              <View style={styles.categoryRow}>
                {CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      style={styles.categoryItem}
                      onPress={() => setCategory(active ? null : c.value)}
                    >
                      <View
                        style={[
                          styles.categoryCircle,
                          { backgroundColor: c.tint },
                          active && styles.categoryCircleActive,
                        ]}
                      >
                        <Text style={styles.categoryEmoji}>{c.emoji}</Text>
                      </View>
                      <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!recipeApiKey && subTab === 'discover' && (
              <Pressable
                style={styles.apiPrompt}
                onPress={() => navigation.navigate('Settings')}
              >
                <Text style={styles.apiPromptText}>{t.recipes.apiPrompt}</Text>
              </Pressable>
            )}

            {subTab === 'discover' && error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.sectionTitle}>
              {subTab === 'saved'
                ? t.recipes.savedRecipes
                : subTab === 'macros'
                ? t.recipes.byMacros
                : searching
                ? `${t.recipes.resultsFor} "${query.trim()}"`
                : t.recipes.recommendedToday}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            saved={savedRecipes.some((r) => r.id === item.id)}
            onToggleSave={() => toggleSavedRecipe(item)}
            onPress={() => navigation.navigate('RecipeDetail', { recipe: item })}
            t={t}
          />
        )}
        ListEmptyComponent={
          subTab === 'discover' && loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
          ) : (
            <Text style={styles.emptyText}>
              {subTab === 'saved'
                ? t.recipes.emptySaved
                : subTab === 'macros'
                ? t.recipes.macrosEmptyBeforeSearch
                : t.recipes.emptySearch}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Ranks the app's recipes by how close one serving is to the targets. Blank
// fields are ignored, and protein counts double like in the meal planner.
function closestRecipes(targets: MacroTargets, count = 10): Recipe[] {
  const parts: [keyof MacroTargets, number][] = [
    ['calories', 1],
    ['proteinG', 2],
    ['carbsG', 1],
    ['fatG', 1],
  ];
  const active = parts.filter(([key]) => targets[key] > 0);
  if (active.length === 0) return [];
  const distance = (r: Recipe) =>
    active.reduce((sum, [key, weight]) => sum + (weight * Math.abs(r[key] - targets[key])) / targets[key], 0);
  return [...RECIPES].sort((a, b) => distance(a) - distance(b)).slice(0, count);
}

function RecipeCard({
  recipe,
  saved,
  onToggleSave,
  onPress,
  t,
}: {
  recipe: Recipe;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
  t: Translations;
}) {
  const image = recipeImage(recipe);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {image ? (
        <Image source={image} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: recipe.tint ?? colors.surfaceAlt }]}>
          <Text style={styles.thumbEmoji}>{recipe.emoji ?? '🍽️'}</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {recipe.name}
        </Text>
        <Text style={styles.cardTime}>{recipe.timeMinutes} {t.recipes.minutes}</Text>
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <CarbsIcon size={11} color={colors.carbs} />
            <Text style={[styles.macroText, { color: colors.carbs }]}>{recipe.carbsG}g</Text>
          </View>
          <View style={styles.macroItem}>
            <FatIcon size={11} color={colors.fat} />
            <Text style={[styles.macroText, { color: colors.fat }]}>{recipe.fatG}g</Text>
          </View>
          <View style={styles.macroItem}>
            <ProteinIcon size={11} color={colors.protein} />
            <Text style={[styles.macroText, { color: colors.protein }]}>{recipe.proteinG}g</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={styles.caloriePill}>
          <MealIcon size={12} color={colors.text} />
          <Text style={styles.calorieText}>{recipe.calories}</Text>
        </View>
        <Pressable onPress={onToggleSave} hitSlop={10} style={styles.bookmarkButton}>
          <BookmarkIcon size={16} color={colors.textMuted} filled={saved} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  planBannerBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBannerText: { flex: 1, gap: 2 },
  planBannerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  planBannerCopy: { color: colors.white, fontSize: 13, opacity: 0.85 },
  planBannerChevron: { color: colors.white, fontSize: 26, fontWeight: '600' },
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
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
  subTabRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  subTabButton: {
    paddingBottom: spacing.sm,
  },
  subTabText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: colors.text,
  },
  subTabUnderline: {
    marginTop: 6,
    height: 2,
    backgroundColor: colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  categoryItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCircleActive: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  categoryEmoji: { fontSize: 24 },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: colors.text,
  },
  apiPrompt: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  macroForm: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  macroIntro: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  macroFieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroField: {
    flex: 1,
    gap: 4,
  },
  macroFieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  macroInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  macroFindButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  macroFindButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  apiPromptText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  thumbEmoji: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  cardTime: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 6,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  macroText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  caloriePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  calorieText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  bookmarkButton: {
    padding: 2,
  },
  loadingIndicator: {
    marginTop: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
