import { ActivityLevel, DailyPlan, Goal, Sex } from '../types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_CALORIE_ADJUSTMENT: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 350,
  build_muscle: 300,
};

// grams of protein per kg of bodyweight
const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  lose: 2.0,
  maintain: 1.8,
  gain: 2.0,
  build_muscle: 2.2,
};

const FAT_PERCENT_OF_CALORIES = 0.25;

export function calculateBmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  // Mifflin-St Jeor equation
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateDailyPlan(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  goal: Goal
): DailyPlan {
  const bmr = calculateBmr(sex, weightKg, heightCm, age);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  const minCalories = sex === 'male' ? 1500 : 1200;
  const calorieTarget = Math.max(
    minCalories,
    Math.round(tdee + GOAL_CALORIE_ADJUSTMENT[goal])
  );

  const proteinG = Math.round(GOAL_PROTEIN_PER_KG[goal] * weightKg);
  const fatCalories = calorieTarget * FAT_PERCENT_OF_CALORIES;
  const fatG = Math.round(fatCalories / 9);
  const remainingCalories = calorieTarget - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingCalories / 4));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget,
    proteinG,
    carbsG,
    fatG,
  };
}
