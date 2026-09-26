import { DayLog, FoodEntry, DailyPlan } from '../types';

export interface WeekDayScore {
  date: string;
  /** 0-100, or null when nothing was logged that day. */
  score: number | null;
  isToday: boolean;
  isFuture: boolean;
}

/** A day counts as "hit" on the weekly chart at this score or above. */
export const HIT_SCORE = 80;

/** Monday to Sunday of the current week, as ISO dates in the same form as `todayIso()`. */
export function currentWeekDates(now = new Date()): string[] {
  const mondayOffset = (now.getDay() + 6) % 7;
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - mondayOffset + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * How close a day got to the plan: the average of calories, protein, carbs
 * and fat as a % of their targets, each capped at 100.
 */
export function dayScore(entries: FoodEntry[], plan: DailyPlan | null): number | null {
  if (entries.length === 0 || !plan) return null;
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
  const parts = [
    [totals.calories, plan.calorieTarget],
    [totals.proteinG, plan.proteinG],
    [totals.carbsG, plan.carbsG],
    [totals.fatG, plan.fatG],
  ].filter(([, target]) => target > 0);
  if (parts.length === 0) return null;
  const sum = parts.reduce((acc, [value, target]) => acc + Math.min(100, (value / target) * 100), 0);
  return Math.round(sum / parts.length);
}

/** Scores for each day this week and the week's average over the days logged so far. */
export function weekSummary(logs: DayLog[], plan: DailyPlan | null, todayIsoDate: string) {
  const days: WeekDayScore[] = logs.map((log) => ({
    date: log.date,
    score: log.date > todayIsoDate ? null : dayScore(log.entries, plan),
    isToday: log.date === todayIsoDate,
    isFuture: log.date > todayIsoDate,
  }));
  const scored = days.filter((d) => d.score !== null).map((d) => d.score as number);
  const average = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  return { days, average };
}
