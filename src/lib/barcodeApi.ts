import { getCached, setCached } from '../storage/db';
import { Micros, NutrientEstimate } from '../types';
import { parseMicros } from './nutrients';

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

// Products rarely change, so a scanned barcode is remembered for 30 days and
// scanning it again works instantly, even offline.
const BARCODE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export async function lookupBarcode(barcode: string): Promise<NutrientEstimate> {
  const cached = await getCached<NutrientEstimate>('barcode2', barcode, BARCODE_CACHE_MS);
  if (cached) return cached;
  const estimate = await fetchBarcode(barcode);
  await setCached('barcode2', barcode, estimate);
  return estimate;
}

async function fetchBarcode(barcode: string): Promise<NutrientEstimate> {
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
    micros: labelMicros(product.nutriments ?? {}, hasServing),
  };
}

// Open Food Facts gives every nutrient in grams, per serving and per 100 g.
// Only values the product actually lists are used.
function labelMicros(n: Record<string, unknown>, perServing: boolean): Micros | undefined {
  const get = (name: string, factor: number) => {
    const v = n[`${name}_${perServing ? 'serving' : '100g'}`];
    return typeof v === 'number' ? v * factor : undefined;
  };
  return parseMicros({
    fiberG: get('fiber', 1),
    sugarG: get('sugars', 1),
    satFatG: get('saturated-fat', 1),
    saltG: get('salt', 1),
    ironMg: get('iron', 1000),
    calciumMg: get('calcium', 1000),
    potassiumMg: get('potassium', 1000),
    vitaminCMg: get('vitamin-c', 1000),
    vitaminDMcg: get('vitamin-d', 1_000_000),
    vitaminB12Mcg: get('vitamin-b12', 1_000_000),
  });
}
