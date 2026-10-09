import { FoodEntry, Micros, Sex } from '../types';

export type MicroKey = keyof Micros;

export interface MicroInfo {
  key: MicroKey;
  unit: 'g' | 'mg' | 'µg';
  /** Something to keep under (sugar, saturated fat, salt) rather than reach. */
  limit?: boolean;
}

// Shown in this order. Fibre to salt are "watch these" values, the rest are
// vitamins and minerals.
export const MICROS: MicroInfo[] = [
  { key: 'fiberG', unit: 'g' },
  { key: 'sugarG', unit: 'g', limit: true },
  { key: 'satFatG', unit: 'g', limit: true },
  { key: 'saltG', unit: 'g', limit: true },
  { key: 'ironMg', unit: 'mg' },
  { key: 'calciumMg', unit: 'mg' },
  { key: 'potassiumMg', unit: 'mg' },
  { key: 'vitaminCMg', unit: 'mg' },
  { key: 'vitaminDMcg', unit: 'µg' },
  { key: 'vitaminB12Mcg', unit: 'µg' },
];

// Daily amounts for adults, from the EU reference intakes and EFSA's dietary
// reference values. Sugar, saturated fat and salt are maximums.
export function microTargets(sex: Sex | undefined): Required<Micros> {
  const female = sex === 'female';
  return {
    fiberG: 30,
    sugarG: 90,
    satFatG: 20,
    saltG: 6,
    ironMg: female ? 16 : 11,
    calciumMg: 950,
    potassiumMg: 3500,
    vitaminCMg: female ? 95 : 110,
    vitaminDMcg: 15,
    vitaminB12Mcg: 4,
  };
}

export function hasMicros(m: Micros | undefined): m is Micros {
  return !!m && MICROS.some(({ key }) => typeof m[key] === 'number');
}

export function scaleMicros(m: Micros | undefined, factor: number): Micros | undefined {
  if (!m) return undefined;
  const out: Micros = {};
  for (const { key } of MICROS) {
    const v = m[key];
    if (typeof v === 'number') out[key] = round(v * factor, key);
  }
  return out;
}

export function addMicros(a: Micros | undefined, b: Micros | undefined): Micros | undefined {
  if (!a && !b) return undefined;
  const out: Micros = {};
  for (const { key } of MICROS) {
    const x = a?.[key];
    const y = b?.[key];
    if (typeof x === 'number' || typeof y === 'number') out[key] = round((x ?? 0) + (y ?? 0), key);
  }
  return out;
}

export function sumMicros(entries: FoodEntry[]): Micros {
  return entries.reduce<Micros>((acc, e) => addMicros(acc, e.micros) ?? acc, {});
}

/** How many of the day's foods have nutrient info, so totals can say "from 3 of 4 foods". */
export function countWithMicros(entries: FoodEntry[]): number {
  return entries.filter((e) => hasMicros(e.micros)).length;
}

// Small amounts keep one decimal (salt, iron, vitamin D, B12); the rest are whole numbers.
function round(v: number, key: MicroKey): number {
  return key === 'saltG' || key === 'ironMg' || key === 'vitaminDMcg' || key === 'vitaminB12Mcg'
    ? Math.round(v * 10) / 10
    : Math.round(v);
}

export function formatMicro(v: number | undefined, unit: string): string {
  if (typeof v !== 'number') return '–';
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
}

/** Reads the optional nutrient fields from an AI or label answer. */
export function parseMicros(raw: unknown): Micros | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: Micros = {};
  for (const { key } of MICROS) {
    const n = Number(src[key]);
    if (src[key] !== undefined && src[key] !== null && Number.isFinite(n) && n >= 0) out[key] = round(n, key);
  }
  return hasMicros(out) ? out : undefined;
}
