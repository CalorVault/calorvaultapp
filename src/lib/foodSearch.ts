import { RECIPES } from '../data/recipes';
import { FoodEntry, Micros } from '../types';
import { scaleMicros } from './nutrients';

/** Nutrition for some amount of a food. */
export interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micros?: Micros;
}

/** One way to measure a food: a household portion with its weight, or (for
 * foods logged before) a fixed serving with its own nutrition. */
export interface FoodUnit {
  label: string;
  grams?: number;
  nutrition?: Nutrition;
}

export interface FoodItem {
  key: string;
  name: string;
  brand?: string;
  source: 'recent' | 'food' | 'product';
  /** Per 100 g; absent for recent foods, which only have a serving. */
  per100?: Nutrition;
  units: FoodUnit[];
  recipeId?: string;
  imageUrl?: string;
}

// ---------- Built-in everyday foods (USDA FoodData Central, public domain) ----------

// [name, kcal, protein, carbs, fat, fibre, sugar, sat fat, salt, iron, calcium,
//  potassium, vitamin C, vitamin D, B12, [[portion, grams], ...]], per 100 g.
type FoodRow = [
  string, number, number, number, number, number, number, number, number, number, number, number,
  number, number, number, [string, number][],
];

let foods: FoodItem[] | null = null;

// Parsed on first search rather than at app start, as the list is large.
function allFoods(): FoodItem[] {
  if (foods) return foods;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rows = require('../data/foods.json') as FoodRow[];
  foods = rows.map((r, i) => ({
    key: `food-${i}`,
    name: r[0],
    source: 'food',
    per100: {
      calories: r[1],
      proteinG: r[2],
      carbsG: r[3],
      fatG: r[4],
      micros: {
        fiberG: r[5],
        sugarG: r[6],
        satFatG: r[7],
        saltG: r[8],
        ironMg: r[9],
        calciumMg: r[10],
        potassiumMg: r[11],
        vitaminCMg: r[12],
        vitaminDMcg: r[13],
        vitaminB12Mcg: r[14],
      },
    },
    units: [...r[15].map(([label, grams]) => ({ label, grams })), { label: 'g', grams: 1 }],
  }));
  // The app's own recipes first, so "spaghetti bolognese" finds the familiar dish.
  const recipes: FoodItem[] = RECIPES.map((r) => ({
    key: `recipe-${r.id}`,
    name: r.name,
    source: 'food',
    units: [
      {
        label: '1 serving',
        nutrition: { calories: r.calories, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG, micros: r.micros },
      },
    ],
    recipeId: r.id,
  }));
  foods = [...recipes, ...foods];
  return foods;
}

// The food list uses American names; these let Irish and British words find them.
const SYNONYMS: Record<string, string[]> = {
  crisps: ['crisps'],
  crisp: ['chip', 'crisp'],
  chips: ['fries', 'chips'],
  mince: ['ground', 'mince'],
  minced: ['ground', 'minced'],
  rasher: ['bacon'],
  rashers: ['bacon'],
  courgette: ['zucchini', 'courgette'],
  aubergine: ['eggplant', 'aubergine'],
  biscuit: ['cookie', 'biscuit'],
  biscuits: ['cookies', 'biscuits'],
  porridge: ['oatmeal', 'porridge', 'oats'],
  prawn: ['shrimp', 'prawn'],
  prawns: ['shrimp', 'prawns'],
  coriander: ['cilantro', 'coriander'],
  yoghurt: ['yogurt'],
  sweets: ['candy', 'sweets'],
  rocket: ['arugula', 'rocket'],
  spud: ['potato'],
  spuds: ['potato'],
  jacket: ['baked'],
  takeaway: ['restaurant'],
  sultanas: ['raisins', 'sultanas'],
  scallion: ['green onion'],
  'spring onion': ['green onion'],
  courgettes: ['zucchini'],
  peppers: ['pepper', 'peppers'],
};

// Whole-query rewrites for everyday words the list names differently.
const PHRASES: Record<string, string> = {
  crisps: 'potato chips',
  'bag of crisps': 'potato chips',
  chips: 'french fries',
  'brown bread': 'bread whole wheat',
  'white bread': 'bread white',
  coke: 'soft drink cola',
  'coca cola': 'soft drink cola',
  pepsi: 'soft drink cola',
  'diet coke': 'soft drink cola diet',
  guinness: 'beer',
  pint: 'beer',
  lager: 'beer',
  bolognese: 'meat sauce',
  'spaghetti bolognese': 'spaghetti meat sauce',
  'jacket potato': 'potato baked',
  'cup of tea': 'tea',
  'cup of coffee': 'coffee',
  'fry up': 'bacon',
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
}

function words(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

/** Everyday foods matching every typed word (as the start of a word in the name). */
export function searchFoods(query: string, limit = 25): FoodItem[] {
  const q = normalize(query).replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const direct = rankFoods(q);
  const alias = PHRASES[q] ? rankFoods(PHRASES[q]) : [];
  // For words like "crisps" or "coke", the translated results come first,
  // apart from matching recipes (e.g. the "Spaghetti Bolognese" recipe).
  const seen = new Set<string>();
  const ordered = alias.length
    ? [...direct.filter((x) => x.recipeId), ...alias, ...direct.filter((x) => !x.recipeId)]
    : direct;
  return ordered
    .filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)))
    .slice(0, limit);
}

// Plain, everyday forms of a food come before prepared versions ("Banana, raw" before "Banana, baked").
const PLAIN = new Set(['raw', 'plain', 'whole', 'boiled', 'cooked', 'scrambled', 'fried', 'grilled', 'roasted']);

function rankFoods(text: string): FoodItem[] {
  const terms = words(text);
  if (terms.length === 0) return [];
  const options = terms.map((t) => SYNONYMS[t] ?? [t]);
  const scored: { item: FoodItem; score: number }[] = [];
  for (const item of allFoods()) {
    const nameWords = words(item.name);
    let score = 0;
    let ok = true;
    for (let i = 0; i < options.length; i++) {
      const hit = nameWords.findIndex((w) => options[i].some((o) => w.startsWith(o)));
      if (hit === -1) {
        ok = false;
        break;
      }
      // Earlier and whole-word matches rank higher.
      score += 20 - Math.min(hit, 10) + (options[i].includes(nameWords[hit]) ? 5 : 0);
    }
    if (!ok) continue;
    // "Banana, raw" for "banana": the part before the first comma is exactly what was typed.
    const head = words(item.name.split(',')[0]);
    if (head.length === terms.length && head.every((w, i) => options[i].includes(w))) {
      score += 30;
      if (nameWords.slice(head.length).some((w) => PLAIN.has(w))) score += 3;
    }
    if (item.recipeId) score += 8;
    // Shorter, plainer names first ("Apple, raw" before long mixed dishes).
    score -= nameWords.length * 1.5;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((s) => s.item);
}

// ---------- Branded products (Open Food Facts, online) ----------

const OFF_SEARCH = 'https://search.openfoodfacts.org/search';
const PREFERRED_COUNTRIES = ['en:ireland', 'en:united-kingdom'];

interface OffHit {
  code?: string;
  product_name?: string;
  brands?: string[] | string;
  countries_tags?: string[];
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function offItem(hit: OffHit): FoodItem | null {
  const n = hit.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n.energy_100g) !== undefined ? num(n.energy_100g)! / 4.184 : undefined);
  const name = hit.product_name?.trim();
  if (!name || kcal === undefined) return null;
  const g = (key: string, factor = 1) => {
    const v = num(n[`${key}_100g`]);
    return v === undefined ? undefined : v * factor;
  };
  const per100: Nutrition = {
    calories: kcal,
    proteinG: g('proteins') ?? 0,
    carbsG: g('carbohydrates') ?? 0,
    fatG: g('fat') ?? 0,
    micros: {
      fiberG: g('fiber'),
      sugarG: g('sugars'),
      satFatG: g('saturated-fat'),
      saltG: g('salt'),
      ironMg: g('iron', 1000),
      calciumMg: g('calcium', 1000),
      potassiumMg: g('potassium', 1000),
      vitaminCMg: g('vitamin-c', 1000),
      vitaminDMcg: g('vitamin-d', 1_000_000),
      vitaminB12Mcg: g('vitamin-b12', 1_000_000),
    },
  };
  const units: FoodUnit[] = [];
  const servingG = num(hit.serving_quantity);
  if (servingG && servingG > 0) units.push({ label: hit.serving_size?.trim() || `${Math.round(servingG)} g`, grams: servingG });
  units.push({ label: 'g', grams: 1 });
  const brand = Array.isArray(hit.brands) ? hit.brands[0] : hit.brands?.split(',')[0];
  return { key: `product-${hit.code ?? name}`, name, brand: brand?.trim() || undefined, source: 'product', per100, units };
}

/** Supermarket products; Irish and UK ones first. Returns [] when offline. */
export async function searchProducts(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: '30',
    fields: 'code,product_name,brands,countries_tags,serving_size,serving_quantity,nutriments',
  });
  const res = await fetch(`${OFF_SEARCH}?${params}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { hits?: OffHit[] };
  const hits = data.hits ?? [];
  const local = (h: OffHit) => (h.countries_tags ?? []).some((c) => PREFERRED_COUNTRIES.includes(c));
  return [...hits.filter(local), ...hits.filter((h) => !local(h))]
    .map(offItem)
    .filter((x): x is FoodItem => x !== null)
    .slice(0, 20);
}

// ---------- Foods you've logged before ----------

export function recentItem(e: FoodEntry): FoodItem {
  return {
    key: `recent-${e.id}`,
    name: e.foodName,
    source: 'recent',
    units: [
      {
        label: e.quantity,
        nutrition: { calories: e.calories, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, micros: e.micros },
      },
    ],
    recipeId: e.recipeId,
    imageUrl: e.imageUrl,
  };
}

export function matchesRecent(e: FoodEntry, query: string): boolean {
  const terms = words(query);
  const name = words(e.foodName);
  return terms.every((t) => name.some((w) => w.startsWith(t)));
}

// ---------- Amounts ----------

/** Nutrition for `count` of `unit` (for the "g" unit, count is the grams). */
export function nutritionFor(item: FoodItem, unit: FoodUnit, count: number): Nutrition {
  if (unit.grams !== undefined && item.per100) {
    const f = (unit.grams * count) / 100;
    return {
      calories: Math.round(item.per100.calories * f),
      proteinG: Math.round(item.per100.proteinG * f),
      carbsG: Math.round(item.per100.carbsG * f),
      fatG: Math.round(item.per100.fatG * f),
      micros: scaleMicros(item.per100.micros, f),
    };
  }
  const n = unit.nutrition ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  return {
    calories: Math.round(n.calories * count),
    proteinG: Math.round(n.proteinG * count),
    carbsG: Math.round(n.carbsG * count),
    fatG: Math.round(n.fatG * count),
    micros: scaleMicros(n.micros, count),
  };
}

/** e.g. "2 × 1 slice (28 g)", "150 g". */
export function quantityLabel(unit: FoodUnit, count: number): string {
  const c = Number.isInteger(count) ? String(count) : String(Math.round(count * 100) / 100);
  if (unit.label === 'g') return `${c} g`;
  const grams = unit.grams !== undefined ? ` (${Math.round(unit.grams * count)} g)` : '';
  return count === 1 ? `${unit.label}${grams}` : `${c} × ${unit.label}${grams}`;
}
