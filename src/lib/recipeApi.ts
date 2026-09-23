import { Recipe, RecipeCategory, RecipeIngredient } from '../types';

const BASE = 'https://api.spoonacular.com';

// Spoonacular's dish "type" filter doesn't have a dedicated "lunch" value --
// map our four categories onto the closest types it supports.
const CATEGORY_TYPE: Record<RecipeCategory, string> = {
  breakfast: 'breakfast',
  lunch: 'main course',
  dinner: 'main course',
  snack: 'snack',
};

interface SpoonacularNutrient {
  name: string;
  amount: number;
}

function nutrientAmount(nutrients: SpoonacularNutrient[] | undefined, name: string): number {
  const found = nutrients?.find((n) => n.name === name);
  return found ? Math.round(found.amount) : 0;
}

function toRecipe(raw: any): Recipe {
  const nutrients: SpoonacularNutrient[] | undefined = raw.nutrition?.nutrients;
  return {
    id: String(raw.id),
    name: raw.title,
    imageUrl: raw.image,
    timeMinutes: raw.readyInMinutes ?? 0,
    calories: nutrientAmount(nutrients, 'Calories'),
    proteinG: nutrientAmount(nutrients, 'Protein'),
    carbsG: nutrientAmount(nutrients, 'Carbohydrates'),
    fatG: nutrientAmount(nutrients, 'Fat'),
  };
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // fall through to the generic message below
  }
  if (res.status === 401) return 'That Spoonacular API key was rejected.';
  if (res.status === 402) return "You've hit today's Spoonacular request limit.";
  return `Recipe search failed (${res.status}).`;
}

export interface MacroTargets {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

const MACRO_TOLERANCE = 0.25;

export async function searchRecipesByMacros(
  apiKey: string,
  targets: MacroTargets
): Promise<Recipe[]> {
  const params = new URLSearchParams({
    apiKey,
    number: '20',
    addRecipeNutrition: 'true',
    sort: 'popularity',
  });

  function setRange(paramName: string, value: number | undefined) {
    if (!value || value <= 0) return;
    params.set(`min${paramName}`, String(Math.round(value * (1 - MACRO_TOLERANCE))));
    params.set(`max${paramName}`, String(Math.round(value * (1 + MACRO_TOLERANCE))));
  }
  setRange('Calories', targets.calories);
  setRange('Protein', targets.proteinG);
  setRange('Carbs', targets.carbsG);
  setRange('Fat', targets.fatG);

  let res: Response;
  try {
    res = await fetch(`${BASE}/recipes/complexSearch?${params.toString()}`);
  } catch {
    throw new Error("Couldn't reach the recipe service. Check your connection.");
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = await res.json();
  const results: any[] = data.results ?? [];
  return results.map(toRecipe);
}

export interface RecipeMethod {
  /** Per single serving, to match the per-serving nutrition shown everywhere else. */
  ingredients: RecipeIngredient[];
  steps: string[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function getRecipeMethod(apiKey: string, recipeId: string): Promise<RecipeMethod> {
  const params = new URLSearchParams({ apiKey, includeNutrition: 'false' });
  let res: Response;
  try {
    res = await fetch(`${BASE}/recipes/${encodeURIComponent(recipeId)}/information?${params}`);
  } catch {
    throw new Error("Couldn't reach the recipe service. Check your connection.");
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = await res.json();
  const recipeServings: number = data.servings > 0 ? data.servings : 1;

  const ingredients: RecipeIngredient[] = (data.extendedIngredients ?? []).map((ing: any) => {
    const metric = ing.measures?.metric;
    const amount: number = metric?.amount ?? ing.amount ?? 0;
    return {
      amount: amount / recipeServings,
      unit: metric?.unitShort ?? ing.unit ?? '',
      name: ing.nameClean ?? ing.name ?? ing.original ?? '',
    };
  });

  let steps: string[] = (data.analyzedInstructions?.[0]?.steps ?? []).map((s: any) =>
    String(s.step).trim()
  );
  if (steps.length === 0 && typeof data.instructions === 'string' && data.instructions.trim()) {
    steps = stripHtml(data.instructions)
      .split(/\.\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.endsWith('.') ? s : `${s}.`));
  }
  return { ingredients, steps };
}

// Only calories and a protein floor are filtered on: pinning all four macros
// at once almost always returns nothing, and portion scaling in the meal
// planner closes the remaining gap anyway.
export async function searchRecipesForMeal(
  apiKey: string,
  category: RecipeCategory,
  targets: { calories: number; proteinG: number }
): Promise<Recipe[]> {
  const params = new URLSearchParams({
    apiKey,
    number: '10',
    addRecipeNutrition: 'true',
    type: CATEGORY_TYPE[category],
    minCalories: String(Math.round(targets.calories * 0.6)),
    maxCalories: String(Math.round(targets.calories * 1.4)),
    minProtein: String(Math.round(targets.proteinG * 0.5)),
    sort: 'random',
  });

  let res: Response;
  try {
    res = await fetch(`${BASE}/recipes/complexSearch?${params.toString()}`);
  } catch {
    throw new Error("Couldn't reach the recipe service. Check your connection.");
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = await res.json();
  const results: any[] = data.results ?? [];
  return results.map((raw) => ({ ...toRecipe(raw), category }));
}

export async function searchRecipes(
  apiKey: string,
  query: string,
  category: RecipeCategory | null
): Promise<Recipe[]> {
  const params = new URLSearchParams({
    apiKey,
    number: '20',
    addRecipeNutrition: 'true',
  });
  const trimmed = query.trim();
  if (trimmed) params.set('query', trimmed);
  if (category) params.set('type', CATEGORY_TYPE[category]);
  if (!trimmed) params.set('sort', 'popularity');

  let res: Response;
  try {
    res = await fetch(`${BASE}/recipes/complexSearch?${params.toString()}`);
  } catch {
    throw new Error("Couldn't reach the recipe service. Check your connection.");
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = await res.json();
  const results: any[] = data.results ?? [];
  return results.map(toRecipe);
}
