import Stripe from 'stripe';

// Lazy-initialize Stripe to avoid build-time errors when env vars aren't set
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const stripeInstance = getStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (stripeInstance as any)[prop];
  },
});

// Price IDs for subscription tiers (set in Vercel environment variables)
export const PRICES = {
  founder: process.env.STRIPE_FOUNDER_PRICE_ID!,
  solo: process.env.STRIPE_SOLO_PRICE_ID!,
} as const;

// Plan configuration
export const PLANS = {
  founder: {
    name: 'Founder',
    price: 29,
    priceId: PRICES.founder,
    description: 'Early adopter rate - locked in forever',
    features: [
      'Unlimited SOAP notes',
      'Voice transcription',
      'Client management',
      'Referral tracking',
      'Insurance claims tracking',
      'PDF exports',
    ],
  },
  solo: {
    name: 'Solo',
    price: 39,
    priceId: PRICES.solo,
    description: 'Full access for solo practitioners',
    features: [
      'Unlimited SOAP notes',
      'Voice transcription',
      'Client management',
      'Referral tracking',
      'Insurance claims tracking',
      'PDF exports',
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

// Trial duration in days
export const TRIAL_DAYS = 7;

// Subscription status types from Stripe
export type StripeSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

// Helper to check if subscription is active
export function isSubscriptionActive(status: string | null): boolean {
  return status === 'active' || status === 'trialing';
}

// Helper to check if trial is expired
export function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
}

// Get days remaining in trial
export function getTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
