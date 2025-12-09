-- =============================================
-- ONBOARDING TRACKING INFRASTRUCTURE
-- Manual onboarding workflow for new practitioners
-- =============================================

-- Create onboarding_questionnaires table
CREATE TABLE IF NOT EXISTS onboarding_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Responses (nullable until submitted)
  practice_name TEXT,
  practice_type TEXT, -- 'cash_only' | 'insurance'
  specialties TEXT[],
  services JSONB, -- Array of {name, duration_minutes, price_cents}
  insurance_portals TEXT[],
  insurance_payers TEXT[],
  intake_preferences JSONB, -- {focus_areas: [], custom_questions: []}
  address JSONB, -- {street, city, state, zip}
  timezone TEXT,
  additional_notes TEXT,

  -- Client list upload (optional)
  client_list_file_url TEXT, -- Supabase Storage URL
  client_list_file_name TEXT, -- Original filename
  client_list_confirmed BOOLEAN DEFAULT false, -- Consent checkbox

  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_questionnaires_token
  ON onboarding_questionnaires(token);

-- Index for practitioner lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_questionnaires_practitioner
  ON onboarding_questionnaires(practitioner_id);

-- =============================================
-- ADD ONBOARDING COLUMNS TO PRACTITIONERS TABLE
-- =============================================

-- Add onboarding_status column with constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practitioners' AND column_name = 'onboarding_status'
  ) THEN
    ALTER TABLE practitioners
      ADD COLUMN onboarding_status TEXT DEFAULT 'not_started';

    -- Add check constraint for valid status values
    ALTER TABLE practitioners
      ADD CONSTRAINT chk_onboarding_status
      CHECK (onboarding_status IN (
        'not_started',
        'questionnaire_sent',
        'questionnaire_received',
        'in_progress',
        'completed',
        'skipped'
      ));
  END IF;
END $$;

-- Add onboarding_notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practitioners' AND column_name = 'onboarding_notes'
  ) THEN
    ALTER TABLE practitioners ADD COLUMN onboarding_notes TEXT;
  END IF;
END $$;

-- Add onboarding_started_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practitioners' AND column_name = 'onboarding_started_at'
  ) THEN
    ALTER TABLE practitioners ADD COLUMN onboarding_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add onboarding_completed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practitioners' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE practitioners ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add onboarding_checklist column with default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practitioners' AND column_name = 'onboarding_checklist'
  ) THEN
    ALTER TABLE practitioners ADD COLUMN onboarding_checklist JSONB DEFAULT '{
      "questionnaire_sent": false,
      "questionnaire_received": false,
      "practice_configured": false,
      "services_added": false,
      "intake_form_created": false,
      "client_list_imported": false,
      "welcome_email_sent": false
    }'::jsonb;
  END IF;
END $$;

-- =============================================
-- RLS POLICIES FOR ONBOARDING_QUESTIONNAIRES
-- =============================================

-- Enable RLS
ALTER TABLE onboarding_questionnaires ENABLE ROW LEVEL SECURITY;

-- Public can read questionnaires by token (for the form)
CREATE POLICY "Public can read questionnaires by token"
  ON onboarding_questionnaires
  FOR SELECT
  USING (true);

-- Public can update questionnaires by token (for form submission)
CREATE POLICY "Public can update questionnaires by token"
  ON onboarding_questionnaires
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Service role has full access (for admin operations)
-- Note: Service role bypasses RLS anyway

-- =============================================
-- TRIGGER: AUTO-CREATE QUESTIONNAIRE ON PRACTITIONER INSERT
-- =============================================

-- Function to create questionnaire when practitioner is created
CREATE OR REPLACE FUNCTION create_onboarding_questionnaire()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_questionnaires (practitioner_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_create_onboarding_questionnaire ON practitioners;

-- Create trigger
CREATE TRIGGER trigger_create_onboarding_questionnaire
  AFTER INSERT ON practitioners
  FOR EACH ROW
  EXECUTE FUNCTION create_onboarding_questionnaire();

-- =============================================
-- FUNCTION: UPDATE QUESTIONNAIRE TIMESTAMP
-- =============================================

CREATE OR REPLACE FUNCTION update_questionnaire_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_questionnaire_timestamp ON onboarding_questionnaires;

-- Create trigger
CREATE TRIGGER trigger_update_questionnaire_timestamp
  BEFORE UPDATE ON onboarding_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION update_questionnaire_updated_at();

-- =============================================
-- BACKFILL: CREATE QUESTIONNAIRES FOR EXISTING PRACTITIONERS
-- =============================================

INSERT INTO onboarding_questionnaires (practitioner_id)
SELECT id FROM practitioners
WHERE id NOT IN (SELECT practitioner_id FROM onboarding_questionnaires WHERE practitioner_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- UPDATE PRACTITIONER_STATS VIEW (if exists)
-- =============================================

-- Drop and recreate the view to include onboarding fields
DROP VIEW IF EXISTS practitioner_stats;

CREATE OR REPLACE VIEW practitioner_stats AS
SELECT
  p.*,
  COALESCE(patient_counts.patient_count, 0) as patient_count,
  COALESCE(visit_counts.visit_count, 0) as visit_count,
  COALESCE(visit_counts.visits_this_week, 0) as visits_this_week,
  COALESCE(visit_counts.visits_this_month, 0) as visits_this_month,
  COALESCE(payment_sums.total_payments, 0) as total_payments,
  COALESCE(payment_sums.payments_this_month, 0) as payments_this_month,
  COALESCE(claim_counts.pending_claims_count, 0) as pending_claims_count
FROM practitioners p
LEFT JOIN (
  SELECT
    pr.id as practitioner_id,
    COUNT(DISTINCT pat.id) as patient_count
  FROM practitioners pr
  LEFT JOIN profiles prof ON prof.id = pr.user_id
  LEFT JOIN patients_non_phi pat ON pat.owner_user_id = pr.user_id
  GROUP BY pr.id
) patient_counts ON patient_counts.practitioner_id = p.id
LEFT JOIN (
  SELECT
    pr.id as practitioner_id,
    COUNT(v.id) as visit_count,
    COUNT(CASE WHEN v.visit_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as visits_this_week,
    COUNT(CASE WHEN v.visit_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as visits_this_month
  FROM practitioners pr
  LEFT JOIN visits_non_phi v ON v.owner_user_id = pr.user_id
  GROUP BY pr.id
) visit_counts ON visit_counts.practitioner_id = p.id
LEFT JOIN (
  SELECT
    pr.id as practitioner_id,
    COALESCE(SUM(pay.amount), 0) as total_payments,
    COALESCE(SUM(CASE WHEN pay.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN pay.amount ELSE 0 END), 0) as payments_this_month
  FROM practitioners pr
  LEFT JOIN payments_non_phi pay ON pay.owner_user_id = pr.user_id
  GROUP BY pr.id
) payment_sums ON payment_sums.practitioner_id = p.id
LEFT JOIN (
  SELECT
    pr.id as practitioner_id,
    COUNT(CASE WHEN c.status IN ('TO_SUBMIT', 'SUBMITTED', 'PENDING') THEN 1 END) as pending_claims_count
  FROM practitioners pr
  LEFT JOIN claims_non_phi c ON c.owner_user_id = pr.user_id
  GROUP BY pr.id
) claim_counts ON claim_counts.practitioner_id = p.id
WHERE p.deleted_at IS NULL;
