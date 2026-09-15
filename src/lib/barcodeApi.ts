import { NutrientEstimate } from '../types';

// Open Food Facts is a free, open product database -- no API key needed.
const BASE = 'https://world.openfoodfacts.org/api/v0/product';

export class BarcodeLookupError extends Error {}

interface OffNutriments {
  'energy-kcal_serving'?: number;
  'energy-kcal_100g'?: number;
  proteins_serving?: number;
  proteins_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates_100g?: number;
  fat_serving?: number;
  fat_100g?: number;
}

export async function lookupBarcode(barcode: string): Promise<NutrientEstimate> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json`);
  } catch {
    throw new BarcodeLookupError("Couldn't reach the product database. Check your connection.");
  }
  if (!res.ok) {
    throw new BarcodeLookupError(`Product lookup failed (${res.status}).`);
  }

  const data = await res.json();
  if (data.status !== 1 || !data.product) {
    throw new BarcodeLookupError("No product found for that barcode.");
  }

  const product = data.product;
  const n: OffNutriments = product.nutriments ?? {};
  const hasServing = typeof n['energy-kcal_serving'] === 'number';

  return {
    foodName: product.product_name || product.generic_name || 'Unknown product',
    quantity: hasServing ? product.serving_size || '1 serving' : 'per 100g',
    calories: Math.round((hasServing ? n['energy-kcal_serving'] : n['energy-kcal_100g']) ?? 0),
    proteinG: Math.round((hasServing ? n.proteins_serving : n.proteins_100g) ?? 0),
    carbsG: Math.round((hasServing ? n.carbohydrates_serving : n.carbohydrates_100g) ?? 0),
    fatG: Math.round((hasServing ? n.fat_serving : n.fat_100g) ?? 0),
    confidence: 'high',
  };
}
