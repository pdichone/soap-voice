-- =============================================
-- ENHANCED REFERRALS MIGRATION
-- Adds physician info, authorization, ICD-10/CPT codes
-- =============================================

-- Add new columns to referrals_non_phi table
ALTER TABLE referrals_non_phi
  ADD COLUMN IF NOT EXISTS physician_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS physician_npi VARCHAR(10),
  ADD COLUMN IF NOT EXISTS physician_specialty VARCHAR(100),
  ADD COLUMN IF NOT EXISTS physician_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS physician_fax VARCHAR(50),
  ADD COLUMN IF NOT EXISTS physician_clinic VARCHAR(255),
  ADD COLUMN IF NOT EXISTS authorization_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS icd10_codes TEXT[],
  ADD COLUMN IF NOT EXISTS cpt_codes TEXT[],
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add check constraint for status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_non_phi_status_check'
  ) THEN
    ALTER TABLE referrals_non_phi
      ADD CONSTRAINT referrals_non_phi_status_check
      CHECK (status IN ('active', 'expired', 'exhausted', 'renewed'));
  END IF;
END $$;

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals_non_phi(status);
CREATE INDEX IF NOT EXISTS idx_referrals_physician ON referrals_non_phi(owner_user_id, physician_name);

-- =============================================
-- PHYSICIANS TABLE (for auto-complete)
-- =============================================
CREATE TABLE IF NOT EXISTS physicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  npi VARCHAR(10),
  specialty VARCHAR(100),
  clinic_name VARCHAR(255),
  phone VARCHAR(50),
  fax VARCHAR(50),

  referral_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint for NPI per practice (only if NPI is provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_physicians_practice_npi
  ON physicians(practice_id, npi)
  WHERE npi IS NOT NULL AND npi != '';

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_physicians_owner ON physicians(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_physicians_practice ON physicians(practice_id);
CREATE INDEX IF NOT EXISTS idx_physicians_name ON physicians(owner_user_id, name);

-- Enable RLS
ALTER TABLE physicians ENABLE ROW LEVEL SECURITY;

-- RLS Policies for physicians
CREATE POLICY "Users can view own physicians" ON physicians
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own physicians" ON physicians
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own physicians" ON physicians
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own physicians" ON physicians
  FOR DELETE USING (auth.uid() = owner_user_id);

-- =============================================
-- FUNCTION: Auto-save physician from referral
-- =============================================
CREATE OR REPLACE FUNCTION save_physician_from_referral()
RETURNS TRIGGER AS $$
DECLARE
  v_practice_id UUID;
BEGIN
  -- Only save if we have a physician name
  IF NEW.physician_name IS NULL OR NEW.physician_name = '' THEN
    RETURN NEW;
  END IF;

  -- Get practice_id from the user's profile
  SELECT practice_id INTO v_practice_id
  FROM profiles
  WHERE id = NEW.owner_user_id;

  -- Insert or update the physician
  INSERT INTO physicians (
    practice_id,
    owner_user_id,
    name,
    npi,
    specialty,
    clinic_name,
    phone,
    fax,
    referral_count
  )
  VALUES (
    v_practice_id,
    NEW.owner_user_id,
    NEW.physician_name,
    NULLIF(NEW.physician_npi, ''),
    NEW.physician_specialty,
    NEW.physician_clinic,
    NEW.physician_phone,
    NEW.physician_fax,
    1
  )
  ON CONFLICT (practice_id, npi) WHERE npi IS NOT NULL AND npi != ''
  DO UPDATE SET
    name = EXCLUDED.name,
    specialty = COALESCE(EXCLUDED.specialty, physicians.specialty),
    clinic_name = COALESCE(EXCLUDED.clinic_name, physicians.clinic_name),
    phone = COALESCE(EXCLUDED.phone, physicians.phone),
    fax = COALESCE(EXCLUDED.fax, physicians.fax),
    referral_count = physicians.referral_count + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-save physicians
DROP TRIGGER IF EXISTS trg_save_physician_from_referral ON referrals_non_phi;
CREATE TRIGGER trg_save_physician_from_referral
  AFTER INSERT ON referrals_non_phi
  FOR EACH ROW
  EXECUTE FUNCTION save_physician_from_referral();

-- =============================================
-- FUNCTION: Auto-update referral status
-- =============================================
CREATE OR REPLACE FUNCTION update_referral_status()
RETURNS TRIGGER AS $$
DECLARE
  v_visits_used INTEGER;
BEGIN
  -- Count visits for this referral
  SELECT COUNT(*) INTO v_visits_used
  FROM visits_non_phi
  WHERE referral_id = NEW.id;

  -- Check if exhausted (visits used >= limit)
  IF NEW.visit_limit_count IS NOT NULL AND v_visits_used >= NEW.visit_limit_count THEN
    NEW.status := 'exhausted';
  -- Check if expired
  ELSIF NEW.referral_expiration_date IS NOT NULL AND NEW.referral_expiration_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  -- Otherwise active
  ELSE
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update status on referral update
DROP TRIGGER IF EXISTS trg_update_referral_status ON referrals_non_phi;
CREATE TRIGGER trg_update_referral_status
  BEFORE UPDATE ON referrals_non_phi
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_status();

-- =============================================
-- FUNCTION: Increment referral visits on visit creation
-- =============================================
CREATE OR REPLACE FUNCTION increment_referral_visits()
RETURNS TRIGGER AS $$
BEGIN
  -- If visit is linked to a referral, we just need to recalculate status
  -- The status trigger will handle it on next update
  IF NEW.referral_id IS NOT NULL THEN
    -- Touch the referral to trigger status update
    UPDATE referrals_non_phi
    SET updated_at = NOW()
    WHERE id = NEW.referral_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update referral when visit is created
DROP TRIGGER IF EXISTS trg_increment_referral_visits ON visits_non_phi;
CREATE TRIGGER trg_increment_referral_visits
  AFTER INSERT ON visits_non_phi
  FOR EACH ROW
  EXECUTE FUNCTION increment_referral_visits();
