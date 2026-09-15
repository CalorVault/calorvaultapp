export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain' | 'build_muscle';

export interface UserProfile {
  name: string;
  sex: Sex;
  age: number;
  /** Always stored in centimeters internally */
  heightCm: number;
  /** Always stored in kilograms internally */
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  createdAt: string;
}

export interface DailyPlan {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type LogMethod = 'camera' | 'voice' | 'manual' | 'suggested' | 'repeat' | 'recipe' | 'barcode';

export interface NutrientEstimate {
  foodName: string;
  quantity: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence?: 'low' | 'medium' | 'high';
}

export interface FoodEntry extends NutrientEstimate {
  id: string;
  /** ISO date, e.g. 2026-08-24 */
  date: string;
  /** ISO timestamp */
  loggedAt: string;
  method: LogMethod;
  photoUri?: string;
}

export interface DayLog {
  date: string;
  entries: FoodEntry[];
}

export type SubscriptionPlan = 'monthly' | 'yearly';

export interface Subscription {
  plan: SubscriptionPlan;
  /** ISO timestamp */
  startedAt: string;
}

export interface WeightEntry {
  /** ISO date, e.g. 2026-08-24 -- one entry per day; logging again same-day overwrites it. */
  date: string;
  weightKg: number;
  /** ISO timestamp */
  loggedAt: string;
}

export interface ReminderSettings {
  enabled: boolean;
  /** 24h "HH:mm" local time, e.g. "18:00" */
  time: string;
}

export type RecipeCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Recipe {
  id: string;
  name: string;
  category?: RecipeCategory;
  timeMinutes: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Real photo, from the recipe API. Local built-in recipes use `emoji`/`tint` instead. */
  imageUrl?: string;
  /** Single emoji used as the recipe's thumbnail when there's no photo. */
  emoji?: string;
  /** Thumbnail background tint when there's no photo. */
  tint?: string;
}
