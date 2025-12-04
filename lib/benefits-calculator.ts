/**
 * Benefits Calculator for Insurance Collection
 *
 * Calculates what to collect from a patient based on their insurance benefits:
 * - Deductible status (not met, partially met, fully met)
 * - Coinsurance percentage
 * - Out-of-pocket maximum
 * - Allowed amount per visit
 */

import type { PatientBenefits, CollectionResult, PatientNonPhi } from './types-ops';

interface BenefitsInput {
  deductible_amount: number;
  deductible_paid: number;
  coinsurance_percent: number;
  oop_max: number;
  oop_paid: number;
  allowed_amount: number;
}

/**
 * Calculate what to collect from a patient based on their insurance benefits
 *
 * Cases:
 * 1. OOP max met -> Collect $0
 * 2. Deductible NOT met -> Collect full allowed amount (up to remaining deductible)
 * 3. Deductible met -> Collect coinsurance percentage
 */
export function calculateCollection(benefits: BenefitsInput): CollectionResult {
  const {
    deductible_amount,
    deductible_paid,
    coinsurance_percent,
    oop_max,
    oop_paid,
    allowed_amount
  } = benefits;

  // Calculate remaining amounts
  const deductible_remaining = Math.max(0, deductible_amount - deductible_paid);
  const oop_remaining = Math.max(0, oop_max - oop_paid);

  const deductible_met = deductible_remaining <= 0;
  const oop_met = oop_remaining <= 0;

  // CASE 1: Out-of-pocket maximum is met -> Collect $0
  if (oop_met) {
    return {
      collect_amount: 0,
      reason: 'OOP Met',
      explanation: 'Out-of-pocket maximum has been met. Patient owes nothing.',
      deductible_met: true,
      oop_met: true,
      deductible_remaining: 0,
      oop_remaining: 0
    };
  }

  // CASE 2: Deductible NOT met -> Collect full allowed amount (up to remaining)
  if (!deductible_met) {
    // Collect the lesser of: allowed amount, remaining deductible, or remaining OOP
    const collect = Math.min(allowed_amount, deductible_remaining, oop_remaining);
    const collect_rounded = Math.round(collect * 100) / 100;

    return {
      collect_amount: collect_rounded,
      reason: 'Deductible',
      explanation: `Deductible not met. $${deductible_remaining.toFixed(2)} remaining.`,
      deductible_met: false,
      oop_met: false,
      deductible_remaining: Math.round((deductible_remaining - collect_rounded) * 100) / 100,
      oop_remaining: Math.round((oop_remaining - collect_rounded) * 100) / 100
    };
  }

  // CASE 3: Deductible MET -> Collect coinsurance percentage
  const coinsurance_amount = allowed_amount * (coinsurance_percent / 100);

  // Don't exceed remaining OOP
  const collect = Math.min(coinsurance_amount, oop_remaining);
  const collect_rounded = Math.round(collect * 100) / 100;

  return {
    collect_amount: collect_rounded,
    reason: `${coinsurance_percent}% Coinsurance`,
    explanation: `Deductible met. Patient pays ${coinsurance_percent}% of $${allowed_amount.toFixed(2)}.`,
    deductible_met: true,
    oop_met: false,
    deductible_remaining: 0,
    oop_remaining: Math.round((oop_remaining - collect_rounded) * 100) / 100
  };
}

/**
 * Get the collection amount for a patient, handling different patient types
 *
 * @param patient - The patient record
 * @param benefits - The patient's insurance benefits (null if not configured)
 * @returns CollectionResult with amount and explanation
 */
export function getCollectAmount(
  patient: Pick<PatientNonPhi, 'insurer_name' | 'default_copay_amount'>,
  benefits: PatientBenefits | null
): CollectionResult {
  // Self-pay/cash patients - use default amount
  const insurance = patient.insurer_name?.toLowerCase() || '';
  if (!insurance || insurance === 'self pay' || insurance === 'cash' || insurance === 'none') {
    return {
      collect_amount: patient.default_copay_amount || 90,
      reason: 'FFS',
      explanation: 'Fee for Service / Self Pay',
      deductible_met: true,
      oop_met: true,
      deductible_remaining: 0,
      oop_remaining: 0
    };
  }

  // No benefits configured yet - use default collect amount
  if (!benefits || !benefits.allowed_amount) {
    return {
      collect_amount: patient.default_copay_amount || 0,
      reason: 'Default',
      explanation: 'No benefits configured. Using default collect amount.',
      deductible_met: false,
      oop_met: false,
      deductible_remaining: 0,
      oop_remaining: 0
    };
  }

  // Calculate based on configured benefits
  return calculateCollection(benefits);
}

/**
 * Check if benefits should be reset based on plan year
 *
 * @param benefits - The patient's insurance benefits
 * @returns true if benefits should be reset
 */
export function shouldResetBenefits(benefits: PatientBenefits): boolean {
  const now = new Date();
  const lastUpdate = new Date(benefits.updated_at);

  if (benefits.plan_year_type === 'calendar') {
    // Reset if we're in a new calendar year
    return now.getFullYear() > lastUpdate.getFullYear();
  } else if (benefits.plan_year_start) {
    // Custom plan year - reset if we've passed the anniversary date
    const planStart = new Date(benefits.plan_year_start);

    // Set plan start to current year
    const thisYearStart = new Date(planStart);
    thisYearStart.setFullYear(now.getFullYear());

    // If plan start already passed this year and last update was before it
    if (now >= thisYearStart && lastUpdate < thisYearStart) {
      return true;
    }

    // Also check if we crossed into a new plan year (for plans that span calendar years)
    const lastYearStart = new Date(planStart);
    lastYearStart.setFullYear(now.getFullYear() - 1);

    if (now >= thisYearStart && lastUpdate < lastYearStart) {
      return true;
    }
  }

  return false;
}

/**
 * Format a collection result for display
 *
 * @param result - The collection calculation result
 * @returns Formatted string like "$88.00 (Deductible)"
 */
export function formatCollectionAmount(result: CollectionResult): string {
  return `$${result.collect_amount.toFixed(2)} (${result.reason})`;
}

/**
 * Get a color class for the collection reason
 *
 * @param result - The collection calculation result
 * @returns Tailwind color class
 */
export function getCollectionColorClass(result: CollectionResult): string {
  if (result.oop_met) return 'text-green-600 bg-green-50';
  if (result.deductible_met) return 'text-blue-600 bg-blue-50';
  return 'text-amber-600 bg-amber-50';
}

/**
 * Calculate progress percentage for a progress bar
 *
 * @param paid - Amount paid so far
 * @param total - Total amount
 * @returns Percentage (0-100)
 */
export function calculateProgress(paid: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}
