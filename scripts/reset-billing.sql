-- Reset all practitioner billing fields
UPDATE practitioners
SET 
  stripe_subscription_id = NULL,
  subscription_status = NULL,
  billing_status = 'none',
  trial_ends_at = NULL,
  current_period_end = NULL,
  billing_started_at = NULL
WHERE stripe_subscription_id IS NOT NULL OR subscription_status IS NOT NULL;

-- Clear payment links table
DELETE FROM payment_links;

-- Show what's left
SELECT id, email, stripe_customer_id, stripe_subscription_id, subscription_status, billing_status
FROM practitioners
WHERE deleted_at IS NULL;
