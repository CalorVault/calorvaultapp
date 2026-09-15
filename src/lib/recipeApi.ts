import { Recipe, RecipeCategory } from '../types';

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
