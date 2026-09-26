import { Directory, File, Paths } from 'expo-file-system';
import { ImageSourcePropType, Platform } from 'react-native';
import { RECIPES } from '../data/recipes';
import { recipeImage } from '../data/recipePhotos';
import { FoodEntry } from '../types';

const PHOTO_DIR = 'meal-photos';

// Camera and photo-library pictures start out in a temporary folder that iOS
// can clear, and the app's folder path changes with every update. Copying the
// photo into Documents and storing only its relative path keeps it working.
export async function keepMealPhoto(uri: string | undefined, id: string): Promise<string | undefined> {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return uri;
  try {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    dir.create({ idempotent: true });
    const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
    const name = `${id}.${ext && ext.length <= 4 ? ext : 'jpg'}`;
    await new File(uri).copy(new File(dir, name));
    return `${PHOTO_DIR}/${name}`;
  } catch {
    return uri;
  }
}

const RECIPES_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
const RECIPES_BY_NAME = new Map(RECIPES.map((r) => [r.name.trim().toLowerCase(), r]));

/**
 * The picture for a logged meal: the user's own photo, else the recipe's photo.
 * Older recipe entries didn't store which recipe they came from, so built-in
 * recipes are also matched by name.
 */
export function mealImage(entry: FoodEntry): ImageSourcePropType | null {
  if (entry.photoUri) {
    if (/^[a-z]+:/i.test(entry.photoUri)) return { uri: entry.photoUri };
    return { uri: new File(Paths.document, entry.photoUri).uri };
  }
  if (entry.imageUrl) return { uri: entry.imageUrl };
  const recipe =
    (entry.recipeId ? RECIPES_BY_ID.get(entry.recipeId) : undefined) ??
    RECIPES_BY_NAME.get(entry.foodName.trim().toLowerCase());
  return recipe ? recipeImage(recipe) : null;
}
