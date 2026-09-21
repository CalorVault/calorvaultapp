import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE, isLanguageCode, LanguageCode } from '../i18n/languages';
import {
  DailyPlan,
  DayLog,
  FoodEntry,
  ReminderSettings,
  Recipe,
  Subscription,
  UserProfile,
  WeightEntry,
} from '../types';

const KEYS = {
  profile: 'kailo:profile',
  plan: 'kailo:plan',
  apiKey: 'kailo:apiKey',
  recipeApiKey: 'kailo:recipeApiKey',
  subscription: 'kailo:subscription',
  dayLogPrefix: 'kailo:day:',
  savedRecipes: 'kailo:savedRecipes',
  language: 'kailo:language',
  weightLog: 'kailo:weightLog',
  waterPrefix: 'kailo:water:',
  waterTargetMl: 'kailo:waterTargetMl',
  reminderSettings: 'kailo:reminderSettings',
  supabaseUrl: 'kailo:supabaseUrl',
  supabaseAnonKey: 'kailo:supabaseAnonKey',
};

export const DEFAULT_WATER_TARGET_ML = 2000;
export const WATER_CUP_ML = 250;

/**
 * Some sandboxed browser contexts (e.g. iOS Safari with storage access
 * restricted) can make IndexedDB-backed AsyncStorage calls hang instead of
 * rejecting. Race every call against a timeout so the app always renders
 * something instead of getting stuck on a promise that never settles.
 */
function withFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      }
    );
  });
}

async function safeGetItem(key: string): Promise<string | null> {
  return withFallback(AsyncStorage.getItem(key), null);
}

async function safeSetItem(key: string, value: string): Promise<void> {
  await withFallback(AsyncStorage.setItem(key, value), undefined);
}

export async function getProfile(): Promise<UserProfile | null> {
  const raw = await safeGetItem(KEYS.profile);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await safeSetItem(KEYS.profile, JSON.stringify(profile));
}

export async function getPlan(): Promise<DailyPlan | null> {
  const raw = await safeGetItem(KEYS.plan);
  return raw ? (JSON.parse(raw) as DailyPlan) : null;
}

export async function savePlan(plan: DailyPlan): Promise<void> {
  await safeSetItem(KEYS.plan, JSON.stringify(plan));
}

export async function getApiKey(): Promise<string | null> {
  return safeGetItem(KEYS.apiKey);
}

export async function saveApiKey(key: string): Promise<void> {
  await safeSetItem(KEYS.apiKey, key);
}

export async function getRecipeApiKey(): Promise<string | null> {
  return safeGetItem(KEYS.recipeApiKey);
}

export async function saveRecipeApiKey(key: string): Promise<void> {
  await safeSetItem(KEYS.recipeApiKey, key);
}

export async function getSubscription(): Promise<Subscription | null> {
  const raw = await safeGetItem(KEYS.subscription);
  return raw ? (JSON.parse(raw) as Subscription) : null;
}

export async function saveSubscription(sub: Subscription | null): Promise<void> {
  if (sub) {
    await safeSetItem(KEYS.subscription, JSON.stringify(sub));
  } else {
    await withFallback(AsyncStorage.removeItem(KEYS.subscription), undefined);
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDayLog(date: string): Promise<DayLog> {
  const raw = await safeGetItem(KEYS.dayLogPrefix + date);
  if (raw) return JSON.parse(raw) as DayLog;
  return { date, entries: [] };
}

export async function saveDayLog(dayLog: DayLog): Promise<void> {
  await safeSetItem(KEYS.dayLogPrefix + dayLog.date, JSON.stringify(dayLog));
}

export async function addFoodEntry(entry: FoodEntry): Promise<DayLog> {
  const dayLog = await getDayLog(entry.date);
  dayLog.entries.push(entry);
  await saveDayLog(dayLog);
  return dayLog;
}

export async function removeFoodEntry(
  date: string,
  entryId: string
): Promise<DayLog> {
  const dayLog = await getDayLog(date);
  dayLog.entries = dayLog.entries.filter((e) => e.id !== entryId);
  await saveDayLog(dayLog);
  return dayLog;
}

/** Returns ISO dates for the last `days` days, most recent last, including today. */
export function lastNDates(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function getDayLogs(dates: string[]): Promise<DayLog[]> {
  return Promise.all(dates.map(getDayLog));
}

/**
 * Distinct meals logged in the last `withinDays` days, most-recently-logged
 * first, deduped by food name (case-insensitive) keeping each name's most
 * recent occurrence -- capped at `limit`. Used to power a "log this again"
 * quick action from history without needing a separate food database.
 */
export async function getRecentUniqueFoodEntries(
  limit = 20,
  withinDays = 30
): Promise<FoodEntry[]> {
  const logs = await getDayLogs(lastNDates(withinDays));
  const allEntries = logs.flatMap((log) => log.entries);
  allEntries.sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));

  const seen = new Set<string>();
  const unique: FoodEntry[] = [];
  for (const entry of allEntries) {
    const key = entry.foodName.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
    if (unique.length >= limit) break;
  }
  return unique;
}

// Saved recipes are stored as full snapshots (not just ids) so a bookmarked
// recipe from the live API still shows correctly later even if the search
// results that produced it are long gone, or the API key is removed.
export async function getSavedRecipes(): Promise<Recipe[]> {
  const raw = await safeGetItem(KEYS.savedRecipes);
  return raw ? (JSON.parse(raw) as Recipe[]) : [];
}

export async function saveSavedRecipes(recipes: Recipe[]): Promise<void> {
  await safeSetItem(KEYS.savedRecipes, JSON.stringify(recipes));
}

export async function getLanguage(): Promise<LanguageCode> {
  const raw = await safeGetItem(KEYS.language);
  return raw && isLanguageCode(raw) ? raw : DEFAULT_LANGUAGE;
}

export async function saveLanguage(language: LanguageCode): Promise<void> {
  await safeSetItem(KEYS.language, language);
}

// One entry per day, sorted ascending by date. Logging again on the same
// day overwrites that day's entry rather than appending a duplicate.
export async function getWeightLog(): Promise<WeightEntry[]> {
  const raw = await safeGetItem(KEYS.weightLog);
  const entries = raw ? (JSON.parse(raw) as WeightEntry[]) : [];
  return entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function addWeightEntry(entry: WeightEntry): Promise<WeightEntry[]> {
  const existing = await getWeightLog();
  const next = existing.filter((e) => e.date !== entry.date);
  next.push(entry);
  next.sort((a, b) => (a.date < b.date ? -1 : 1));
  await safeSetItem(KEYS.weightLog, JSON.stringify(next));
  return next;
}

export async function getWaterIntake(date: string): Promise<number> {
  const raw = await safeGetItem(KEYS.waterPrefix + date);
  return raw ? Number(raw) || 0 : 0;
}

export async function saveWaterIntake(date: string, ml: number): Promise<void> {
  await safeSetItem(KEYS.waterPrefix + date, String(Math.max(0, ml)));
}

export async function getWaterTarget(): Promise<number> {
  const raw = await safeGetItem(KEYS.waterTargetMl);
  return raw ? Number(raw) || DEFAULT_WATER_TARGET_ML : DEFAULT_WATER_TARGET_ML;
}

export async function saveWaterTarget(ml: number): Promise<void> {
  await safeSetItem(KEYS.waterTargetMl, String(ml));
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await safeGetItem(KEYS.reminderSettings);
  return raw ? (JSON.parse(raw) as ReminderSettings) : { enabled: false, time: '18:00' };
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await safeSetItem(KEYS.reminderSettings, JSON.stringify(settings));
}

export async function getSupabaseUrl(): Promise<string | null> {
  return safeGetItem(KEYS.supabaseUrl);
}

export async function saveSupabaseUrl(url: string): Promise<void> {
  await safeSetItem(KEYS.supabaseUrl, url);
}

export async function getSupabaseAnonKey(): Promise<string | null> {
  return safeGetItem(KEYS.supabaseAnonKey);
}

export async function saveSupabaseAnonKey(key: string): Promise<void> {
  await safeSetItem(KEYS.supabaseAnonKey, key);
}

export async function clearAllData(): Promise<void> {
  const allKeys = await withFallback(AsyncStorage.getAllKeys(), [] as string[]);
  const kailoKeys = allKeys.filter((k) => k.startsWith('kailo:'));
  await withFallback(AsyncStorage.removeMany(kailoKeys), undefined);
}
