-- Add practice_type to practitioners table for admin control
-- This allows admins to set the practice type for each practitioner

-- Add the practice_type column with a default of 'insurance'
ALTER TABLE practitioners
ADD COLUMN IF NOT EXISTS practice_type text DEFAULT 'insurance'
CHECK (practice_type IN ('cash_only', 'insurance', 'school'));

-- Add a comment to explain the column
COMMENT ON COLUMN practitioners.practice_type IS 'The type of practice: cash_only (Client/Session terminology, no claims), insurance (Patient/Visit terminology, with claims), or school (Client/Session with supervisor features)';

-- Update the practitioner_stats view to include practice_type
DROP VIEW IF EXISTS practitioner_stats;

CREATE OR REPLACE VIEW practitioner_stats AS
SELECT
  p.id,
  p.user_id,
  p.email,
  p.name,
  p.workspace_id,
  p.workspace_name,
  p.status,
  p.plan_type,
  p.monthly_price,
  p.billing_status,
  p.trial_ends_at,
  p.billing_started_at,
  p.billing_notes,
  p.feature_claims_tracking,
  p.feature_year_end_summary,
  p.feature_insurance_calculator,
  p.feature_bulk_operations,
  p.practice_type,
  p.last_login_at,
  p.last_activity_at,
  p.login_count,
  p.created_at,
  p.updated_at,
  p.created_by,
  p.deleted_at,
  -- Patient count (only count non-deleted patients owned by the practitioner's user)
  COALESCE(
    (SELECT COUNT(*) FROM patients_non_phi pnp WHERE pnp.owner_user_id = p.user_id),
    0
  ) as patient_count,
  -- Visit count
  COALESCE(
    (SELECT COUNT(*) FROM visits_non_phi vnp WHERE vnp.owner_user_id = p.user_id),
    0
  ) as visit_count,
  -- Visits this week
  COALESCE(
    (SELECT COUNT(*) FROM visits_non_phi vnp
     WHERE vnp.owner_user_id = p.user_id
     AND vnp.visit_date >= CURRENT_DATE - INTERVAL '7 days'),
    0
  ) as visits_this_week,
  -- Visits this month
  COALESCE(
    (SELECT COUNT(*) FROM visits_non_phi vnp
     WHERE vnp.owner_user_id = p.user_id
     AND vnp.visit_date >= DATE_TRUNC('month', CURRENT_DATE)),
    0
  ) as visits_this_month,
  -- Total payments
  COALESCE(
    (SELECT SUM(amount) FROM payments_non_phi pmt WHERE pmt.owner_user_id = p.user_id),
    0
  ) as total_payments,
  -- Payments this month
  COALESCE(
    (SELECT SUM(amount) FROM payments_non_phi pmt
     WHERE pmt.owner_user_id = p.user_id
     AND pmt.created_at >= DATE_TRUNC('month', CURRENT_DATE)),
    0
  ) as payments_this_month,
  -- Pending claims count
  COALESCE(
    (SELECT COUNT(*) FROM claims_non_phi cnp
     WHERE cnp.owner_user_id = p.user_id
     AND cnp.status IN ('TO_SUBMIT', 'SUBMITTED', 'PENDING')),
    0
  ) as pending_claims_count
FROM practitioners p
WHERE p.deleted_at IS NULL;

-- Grant access to the view
GRANT SELECT ON practitioner_stats TO authenticated;
GRANT SELECT ON practitioner_stats TO service_role;
