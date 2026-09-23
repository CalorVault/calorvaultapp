import { RECIPES } from '../data/recipes';
import { DailyPlan, DayMealPlan, PlannedMeal, Recipe, RecipeCategory } from '../types';
import { searchRecipesForMeal } from './recipeApi';

export const MEAL_SLOTS: RecipeCategory[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const SLOT_SHARE: Record<RecipeCategory, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

const MIN_SERVINGS = 0.5;
const MAX_SERVINGS = 3;
const CLOSE_ENOUGH = 0.35;

interface Targets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function slotTargets(plan: DailyPlan, slot: RecipeCategory): Targets {
  const share = SLOT_SHARE[slot];
  return {
    calories: plan.calorieTarget * share,
    proteinG: plan.proteinG * share,
    carbsG: plan.carbsG * share,
    fatG: plan.fatG * share,
  };
}

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function clampServings(n: number): number {
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, roundToQuarter(n)));
}

function portion(slot: RecipeCategory, recipe: Recipe, servings: number): PlannedMeal {
  return {
    slot,
    recipe,
    servings,
    calories: Math.round(recipe.calories * servings),
    proteinG: Math.round(recipe.proteinG * servings),
    carbsG: Math.round(recipe.carbsG * servings),
    fatG: Math.round(recipe.fatG * servings),
  };
}

function relErr(actual: number, target: number): number {
  return Math.abs(actual - target) / Math.max(target, 1);
}

// Protein is weighted highest: it's the macro people cutting or bulking care
// about most, and the one a portion tweak can't fix if the recipe is low in it.
function score(meal: PlannedMeal, t: Targets): number {
  return (
    relErr(meal.calories, t.calories) +
    2 * relErr(meal.proteinG, t.proteinG) +
    relErr(meal.carbsG, t.carbsG) +
    relErr(meal.fatG, t.fatG)
  );
}

function pickMeal(
  slot: RecipeCategory,
  targets: Targets,
  candidates: Recipe[],
  avoidIds: Set<string>
): PlannedMeal | null {
  const usable = candidates.filter((r) => r.calories > 0);
  const fresh = usable.filter((r) => !avoidIds.has(r.id));
  const pool = fresh.length > 0 ? fresh : usable;
  if (pool.length === 0) return null;

  const ranked = pool
    .map((r) => {
      const meal = portion(slot, r, clampServings(targets.calories / r.calories));
      return { meal, s: score(meal, targets) };
    })
    .sort((a, b) => a.s - b.s);
  // Pick randomly among options nearly as good as the best one, so "New plan"
  // and "Swap" give variety without trading away the macro fit.
  const best = ranked[0].s;
  const close = ranked.filter((r) => r.s <= best + CLOSE_ENOUGH).slice(0, 3);
  return close[Math.floor(Math.random() * close.length)].meal;
}

async function candidatesFor(
  slot: RecipeCategory,
  targets: Targets,
  apiKey: string | null
): Promise<Recipe[]> {
  if (apiKey) {
    try {
      const live = await searchRecipesForMeal(apiKey, slot, targets);
      if (live.length > 0) return live;
    } catch {
      // Fall back to the built-in list below (no key quota, offline, etc.).
    }
  }
  return RECIPES.filter((r) => r.category === slot);
}

// Rounding each meal to quarter servings leaves the day a little off target;
// nudge the biggest meal's portion to close the calorie gap.
function rebalance(meals: PlannedMeal[], calorieTarget: number): PlannedMeal[] {
  const idx = meals.findIndex((m) => m.slot === 'lunch');
  if (idx === -1) return meals;
  const others = meals.reduce((sum, m, i) => (i === idx ? sum : sum + m.calories), 0);
  const lunch = meals[idx];
  const servings = clampServings((calorieTarget - others) / lunch.recipe.calories);
  const next = [...meals];
  next[idx] = portion('lunch', lunch.recipe, servings);
  return next;
}

export async function generateMealPlan(
  plan: DailyPlan,
  apiKey: string | null,
  date: string
): Promise<DayMealPlan> {
  const candidateLists = await Promise.all(
    MEAL_SLOTS.map((slot) => candidatesFor(slot, slotTargets(plan, slot), apiKey))
  );
  const used = new Set<string>();
  const meals: PlannedMeal[] = [];
  MEAL_SLOTS.forEach((slot, i) => {
    const meal = pickMeal(slot, slotTargets(plan, slot), candidateLists[i], used);
    if (meal) {
      meals.push(meal);
      used.add(meal.recipe.id);
    }
  });
  return { date, calorieTarget: plan.calorieTarget, meals: rebalance(meals, plan.calorieTarget) };
}

export async function swapMeal(
  plan: DailyPlan,
  apiKey: string | null,
  current: DayMealPlan,
  slot: RecipeCategory
): Promise<DayMealPlan> {
  const targets = slotTargets(plan, slot);
  const candidates = await candidatesFor(slot, targets, apiKey);
  const avoid = new Set(current.meals.map((m) => m.recipe.id));
  const replacement = pickMeal(slot, targets, candidates, avoid);
  if (!replacement) return current;
  return {
    ...current,
    meals: current.meals.map((m) => (m.slot === slot ? replacement : m)),
  };
}

export function planTotals(meals: PlannedMeal[]) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

export function servingsText(
  servings: number,
  t: { mealPlan: { serving: string; servings: string } }
): string {
  const n = Number.isInteger(servings) ? String(servings) : servings.toFixed(2).replace(/0$/, '');
  return `${n} ${servings === 1 ? t.mealPlan.serving : t.mealPlan.servings}`;
}
