-- =============================================
-- Patient Benefits Table for Insurance Tracking
-- =============================================
-- Stores insurance benefit details per patient for Jess (insurance LMT)
-- Enables automatic calculation of what to collect based on:
-- - Deductible status
-- - Coinsurance percentage
-- - Out-of-pocket maximum
-- =============================================

CREATE TABLE IF NOT EXISTS patient_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Plan timing
  plan_year_type TEXT DEFAULT 'calendar' CHECK (plan_year_type IN ('calendar', 'custom')),
  plan_year_start DATE,

  -- Deductible
  deductible_amount NUMERIC(10,2) DEFAULT 0,
  deductible_paid NUMERIC(10,2) DEFAULT 0,

  -- Coinsurance (percentage patient pays after deductible)
  coinsurance_percent INTEGER DEFAULT 0 CHECK (coinsurance_percent >= 0 AND coinsurance_percent <= 100),

  -- Out-of-pocket maximum
  oop_max NUMERIC(10,2) DEFAULT 0,
  oop_paid NUMERIC(10,2) DEFAULT 0,

  -- Allowed amount per visit (what insurance approves for massage therapy)
  allowed_amount NUMERIC(10,2) DEFAULT 0,

  -- Notes field for Jess's shorthand and reminders
  -- e.g., "Ded $625 // Coins. 10% // $1,500 OOP PCY"
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One benefits record per patient
  UNIQUE(patient_id)
);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE patient_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patient benefits" ON patient_benefits
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own patient benefits" ON patient_benefits
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own patient benefits" ON patient_benefits
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own patient benefits" ON patient_benefits
  FOR DELETE USING (auth.uid() = owner_user_id);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_patient_benefits_patient ON patient_benefits(patient_id);
CREATE INDEX idx_patient_benefits_owner ON patient_benefits(owner_user_id);

-- =============================================
-- Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_patient_benefits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_patient_benefits_updated_at
  BEFORE UPDATE ON patient_benefits
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_benefits_updated_at();
