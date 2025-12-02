-- Operations Mode (Non-PHI) Database Schema
-- Run this migration in Supabase SQL Editor

-- =============================================
-- PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'PRACTITIONER' CHECK (role IN ('PRACTITIONER', 'ADMIN')),
  timezone TEXT DEFAULT 'America/Los_Angeles',
  claim_pending_threshold_days INT DEFAULT 21,
  referral_warning_days INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup (only create if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- PATIENTS_NON_PHI TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS patients_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  insurer_name TEXT,
  default_copay_amount NUMERIC(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE patients_non_phi ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own patients" ON patients_non_phi
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own patients" ON patients_non_phi
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own patients" ON patients_non_phi
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own patients" ON patients_non_phi
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients_non_phi(owner_user_id, is_active);

-- =============================================
-- REFERRALS_NON_PHI TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS referrals_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referral_label TEXT,
  visit_limit_type TEXT DEFAULT 'PER_REFERRAL' CHECK (visit_limit_type IN ('PER_REFERRAL', 'PER_YEAR', 'UNLIMITED')),
  visit_limit_count INT,
  referral_start_date DATE,
  referral_expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE referrals_non_phi ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own referrals" ON referrals_non_phi
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own referrals" ON referrals_non_phi
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own referrals" ON referrals_non_phi
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own referrals" ON referrals_non_phi
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_owner ON referrals_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_expiration ON referrals_non_phi(owner_user_id, referral_expiration_date);

-- =============================================
-- VISITS_NON_PHI TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS visits_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referral_id UUID REFERENCES referrals_non_phi(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  is_billable_to_insurance BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE visits_non_phi ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own visits" ON visits_non_phi
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own visits" ON visits_non_phi
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own visits" ON visits_non_phi
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own visits" ON visits_non_phi
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_owner ON visits_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits_non_phi(owner_user_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_referral ON visits_non_phi(referral_id);

-- =============================================
-- PAYMENTS_NON_PHI TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payments_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  visit_id UUID REFERENCES visits_non_phi(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('CASH', 'CHECK', 'CARD', 'HSA', 'OTHER')),
  is_copay BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payments_non_phi ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own payments" ON payments_non_phi
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own payments" ON payments_non_phi
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own payments" ON payments_non_phi
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own payments" ON payments_non_phi
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_owner ON payments_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments_non_phi(owner_user_id, created_at);

-- =============================================
-- CLAIMS_NON_PHI TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS claims_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  visit_id UUID REFERENCES visits_non_phi(id) ON DELETE SET NULL,
  insurer_name TEXT,
  portal_name TEXT,
  status TEXT DEFAULT 'TO_SUBMIT' CHECK (status IN ('TO_SUBMIT', 'SUBMITTED', 'PENDING', 'PAID', 'DENIED', 'APPEAL')),
  date_of_service DATE,
  date_submitted DATE,
  date_paid DATE,
  billed_amount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE claims_non_phi ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own claims" ON claims_non_phi
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own claims" ON claims_non_phi
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own claims" ON claims_non_phi
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own claims" ON claims_non_phi
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims_non_phi(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_date ON claims_non_phi(owner_user_id, date_of_service);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients_non_phi;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients_non_phi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals_non_phi;
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals_non_phi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claims_updated_at ON claims_non_phi;
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims_non_phi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
