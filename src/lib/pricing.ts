import { SubscriptionPlan } from '../types';

export const PRICING: Record<SubscriptionPlan, { amount: number; currency: string; label: string }> = {
  monthly: { amount: 5.99, currency: '€', label: 'Monthly' },
  yearly: { amount: 40.0, currency: '€', label: 'Yearly' },
};

export function formatPrice(plan: SubscriptionPlan): string {
  const { amount, currency } = PRICING[plan];
  return `${currency}${amount.toFixed(2)}`;
}

/** Percentage saved by paying yearly instead of 12x the monthly price. */
export function yearlySavingsPercent(): number {
  const monthlyCostPerYear = PRICING.monthly.amount * 12;
  const savings = (monthlyCostPerYear - PRICING.yearly.amount) / monthlyCostPerYear;
  return Math.round(savings * 100);
}
