-- Migration: Add Stripe billing columns to practitioners table
-- Run this in Supabase SQL Editor

-- Add Stripe-specific columns to practitioners table
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255);
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trialing';
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Add index for faster Stripe lookups
CREATE INDEX IF NOT EXISTS idx_practitioners_stripe_customer_id ON practitioners(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_stripe_subscription_id ON practitioners(stripe_subscription_id);

-- Comment for documentation
COMMENT ON COLUMN practitioners.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN practitioners.stripe_subscription_id IS 'Stripe Subscription ID (sub_xxx)';
COMMENT ON COLUMN practitioners.stripe_price_id IS 'Stripe Price ID (price_xxx) for current subscription';
COMMENT ON COLUMN practitioners.subscription_status IS 'Stripe subscription status: trialing, active, past_due, canceled, unpaid';
COMMENT ON COLUMN practitioners.current_period_end IS 'End of current billing period';
