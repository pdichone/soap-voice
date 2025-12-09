-- =============================================
-- SOAP VOICE / ZENLEEF COMPLETE PRODUCTION SCHEMA
-- Run this SQL in Supabase SQL Editor for a fresh production database
-- Generated: December 2024
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- SECTION 1: HELPER FUNCTIONS
-- =============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate short token for intake/consent links
CREATE OR REPLACE FUNCTION generate_intake_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijkmnopqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_consent_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijkmnopqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SECTION 2: CORE TABLES (Clinical/Legacy)
-- =============================================

-- Therapists table (legacy clinical mode)
CREATE TABLE IF NOT EXISTS therapists (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referring Providers table
CREATE TABLE IF NOT EXISTS referring_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  practice_name TEXT,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  fax TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table (legacy)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  referring_provider_id UUID REFERENCES referring_providers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (legacy)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  audio_url TEXT,
  transcript TEXT,
  soap_note JSONB,
  raw_soap_text TEXT,
  session_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals table (legacy)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE NOT NULL,
  referring_provider_id UUID REFERENCES referring_providers(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL,
  referral_date DATE NOT NULL,
  diagnosis TEXT,
  icd_code TEXT,
  visits_authorized INTEGER,
  expiration_date DATE,
  document_url TEXT,
  document_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SECTION 3: PRACTICES & PROFILES (Multi-tenant)
-- =============================================

-- Practices table
CREATE TABLE IF NOT EXISTS practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  practice_type TEXT NOT NULL DEFAULT 'insurance'
    CHECK (practice_type IN ('cash_only', 'insurance', 'school')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'PRACTITIONER' CHECK (role IN ('PRACTITIONER', 'ADMIN')),
  timezone TEXT DEFAULT 'America/Los_Angeles',
  claim_pending_threshold_days INT DEFAULT 21,
  referral_warning_days INT DEFAULT 30,
  practice_id UUID REFERENCES practices(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice Users table (for multi-user practices)
CREATE TABLE IF NOT EXISTS practice_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'practitioner'
    CHECK (role IN ('admin', 'supervisor', 'practitioner')),
  is_active BOOLEAN DEFAULT TRUE,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(practice_id, user_id)
);

-- =============================================
-- SECTION 4: OPS TABLES (Non-PHI)
-- =============================================

-- Patients (Non-PHI)
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

-- Referrals (Non-PHI)
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
  -- Enhanced referral fields
  physician_name VARCHAR(255),
  physician_npi VARCHAR(10),
  physician_specialty VARCHAR(100),
  physician_phone VARCHAR(50),
  physician_fax VARCHAR(50),
  physician_clinic VARCHAR(255),
  authorization_number VARCHAR(100),
  payer VARCHAR(255),
  icd10_codes TEXT[],
  cpt_codes TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT referrals_non_phi_status_check CHECK (status IN ('active', 'expired', 'exhausted', 'renewed'))
);

-- Visits (Non-PHI)
CREATE TABLE IF NOT EXISTS visits_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referral_id UUID REFERENCES referrals_non_phi(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  is_billable_to_insurance BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (Non-PHI)
CREATE TABLE IF NOT EXISTS payments_non_phi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  visit_id UUID REFERENCES visits_non_phi(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('CASH', 'CHECK', 'CARD', 'HSA', 'VENMO', 'CASHAPP', 'APPLEPAY', 'ZELLE', 'OTHER')),
  is_copay BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims (Non-PHI)
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
  paid_amount DECIMAL(10,2) DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN claims_non_phi.paid_amount IS 'Actual amount paid by insurance (may differ from billed_amount)';

-- Patient Benefits
CREATE TABLE IF NOT EXISTS patient_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_year_type TEXT DEFAULT 'calendar' CHECK (plan_year_type IN ('calendar', 'custom')),
  plan_year_start DATE,
  deductible_amount NUMERIC(10,2) DEFAULT 0,
  deductible_paid NUMERIC(10,2) DEFAULT 0,
  coinsurance_percent INTEGER DEFAULT 0 CHECK (coinsurance_percent >= 0 AND coinsurance_percent <= 100),
  oop_max NUMERIC(10,2) DEFAULT 0,
  oop_paid NUMERIC(10,2) DEFAULT 0,
  allowed_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id)
);

-- Physicians (for auto-complete)
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

-- Portals (insurance portals)
CREATE TABLE IF NOT EXISTS portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(practice_id, name)
);

-- =============================================
-- SECTION 5: DOCUMENTS & FORMS
-- =============================================

-- Document Templates
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('INTAKE', 'CONSENT', 'HIPAA', 'POLICY', 'OTHER')),
  content TEXT NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Documents
CREATE TABLE IF NOT EXISTS client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'DECLINED', 'EXPIRED')),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  signature_data TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT client_documents_owner_patient_template_key UNIQUE(owner_user_id, patient_id, template_id)
);

-- Consent Links
CREATE TABLE IF NOT EXISTS consent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  template_id UUID REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake Forms
CREATE TABLE IF NOT EXISTS intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake Links
CREATE TABLE IF NOT EXISTS intake_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  form_id UUID REFERENCES intake_forms(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake Responses
CREATE TABLE IF NOT EXISTS intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES intake_links(id) ON DELETE CASCADE NOT NULL,
  form_id UUID REFERENCES intake_forms(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  responses JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- =============================================
-- SECTION 6: ADMIN & PRACTITIONERS
-- =============================================

-- Practitioners (LMT accounts)
CREATE TABLE IF NOT EXISTS practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  workspace_id UUID UNIQUE DEFAULT gen_random_uuid(),
  workspace_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  plan_type VARCHAR(20) DEFAULT 'trial',
  monthly_price DECIMAL(10,2),
  billing_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  billing_started_at TIMESTAMPTZ,
  billing_notes TEXT,
  practice_type TEXT DEFAULT 'insurance' CHECK (practice_type IN ('cash_only', 'insurance', 'school')),
  -- Feature flags
  feature_claims_tracking BOOLEAN DEFAULT TRUE,
  feature_year_end_summary BOOLEAN DEFAULT TRUE,
  feature_insurance_calculator BOOLEAN DEFAULT FALSE,
  feature_bulk_operations BOOLEAN DEFAULT FALSE,
  feature_intake_forms BOOLEAN DEFAULT TRUE,
  feature_documents BOOLEAN DEFAULT TRUE,
  -- Activity tracking
  last_login_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  -- Onboarding
  onboarding_status TEXT DEFAULT 'not_started',
  onboarding_notes TEXT,
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_checklist JSONB DEFAULT '{
    "questionnaire_sent": false,
    "questionnaire_received": false,
    "practice_configured": false,
    "services_added": false,
    "intake_form_created": false,
    "client_list_imported": false,
    "welcome_email_sent": false
  }'::jsonb,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT practitioners_status_check CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  CONSTRAINT practitioners_plan_type_check CHECK (plan_type IN ('trial', 'solo', 'professional', 'enterprise', 'founder', 'custom')),
  CONSTRAINT practitioners_billing_status_check CHECK (billing_status IN ('trial', 'paying', 'overdue', 'cancelled', 'comped')),
  CONSTRAINT chk_onboarding_status CHECK (onboarding_status IN ('not_started', 'questionnaire_sent', 'questionnaire_received', 'in_progress', 'completed', 'skipped'))
);

COMMENT ON COLUMN practitioners.practice_type IS 'The type of practice: cash_only, insurance, or school';
COMMENT ON COLUMN practitioners.feature_intake_forms IS 'Feature flag: Allow creating and sending intake forms';
COMMENT ON COLUMN practitioners.feature_documents IS 'Feature flag: Allow document templates and consent forms';

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'super_admin', 'support'))
);

-- Admin Events (Audit log)
CREATE TABLE IF NOT EXISTS admin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20) NOT NULL,
  actor_id UUID,
  actor_email VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(30),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE SET NULL,
  workspace_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT admin_events_actor_type_check CHECK (actor_type IN ('admin', 'practitioner', 'system'))
);

-- Impersonation Sessions
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ip_address VARCHAR(50),
  user_agent TEXT
);

-- Onboarding Questionnaires
CREATE TABLE IF NOT EXISTS onboarding_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  practice_name TEXT,
  practice_type TEXT,
  specialties TEXT[],
  services JSONB,
  insurance_portals TEXT[],
  insurance_payers TEXT[],
  intake_preferences JSONB,
  address JSONB,
  timezone TEXT,
  additional_notes TEXT,
  client_list_file_url TEXT,
  client_list_file_name TEXT,
  client_list_confirmed BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SECTION 7: INDEXES
-- =============================================

-- Core tables
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients_non_phi(owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_owner ON referrals_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_expiration ON referrals_non_phi(owner_user_id, referral_expiration_date);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals_non_phi(status);
CREATE INDEX IF NOT EXISTS idx_referrals_physician ON referrals_non_phi(owner_user_id, physician_name);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_owner ON visits_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits_non_phi(owner_user_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_referral ON visits_non_phi(referral_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_owner ON payments_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments_non_phi(owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims_non_phi(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims_non_phi(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims_non_phi(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_date ON claims_non_phi(owner_user_id, date_of_service);
CREATE INDEX IF NOT EXISTS idx_patient_benefits_patient ON patient_benefits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_benefits_owner ON patient_benefits(owner_user_id);

-- Practices & Profiles
CREATE INDEX IF NOT EXISTS idx_practices_type ON practices(practice_type);
CREATE INDEX IF NOT EXISTS idx_profiles_practice ON profiles(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_users_practice ON practice_users(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_users_user ON practice_users(user_id);

-- Documents & Forms
CREATE INDEX IF NOT EXISTS idx_doc_templates_owner ON document_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_active ON document_templates(owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON document_templates(owner_user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_client_docs_owner ON client_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_patient ON client_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_template ON client_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_status ON client_documents(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_consent_links_token ON consent_links(token);
CREATE INDEX IF NOT EXISTS idx_consent_links_owner ON consent_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_consent_links_patient ON consent_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_links_template ON consent_links(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_links_active_unsigned ON consent_links(patient_id, template_id) WHERE signed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_intake_forms_owner ON intake_forms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_active ON intake_forms(owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_intake_links_token ON intake_links(token);
CREATE INDEX IF NOT EXISTS idx_intake_links_owner ON intake_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_links_patient ON intake_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_links_form ON intake_links(form_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_owner ON intake_responses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_patient ON intake_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_link ON intake_responses(link_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_form ON intake_responses(form_id);

-- Admin & Practitioners
CREATE INDEX IF NOT EXISTS idx_practitioners_user_id ON practitioners(user_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_email ON practitioners(email);
CREATE INDEX IF NOT EXISTS idx_practitioners_workspace_id ON practitioners(workspace_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_status ON practitioners(status);
CREATE INDEX IF NOT EXISTS idx_practitioners_billing_status ON practitioners(billing_status);
CREATE INDEX IF NOT EXISTS idx_practitioners_plan_type ON practitioners(plan_type);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_events_practitioner_id ON admin_events(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_admin_events_event_type ON admin_events(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_events_event_category ON admin_events(event_category);
CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON admin_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_actor_id ON admin_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin_id ON impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_practitioner_id ON impersonation_sessions(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_started_at ON impersonation_sessions(started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_questionnaires_token ON onboarding_questionnaires(token);
CREATE INDEX IF NOT EXISTS idx_onboarding_questionnaires_practitioner ON onboarding_questionnaires(practitioner_id);

-- Physicians & Portals
CREATE UNIQUE INDEX IF NOT EXISTS idx_physicians_practice_npi ON physicians(practice_id, npi) WHERE npi IS NOT NULL AND npi != '';
CREATE INDEX IF NOT EXISTS idx_physicians_owner ON physicians(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_physicians_practice ON physicians(practice_id);
CREATE INDEX IF NOT EXISTS idx_physicians_name ON physicians(owner_user_id, name);
CREATE INDEX IF NOT EXISTS idx_portals_practice ON portals(practice_id);
CREATE INDEX IF NOT EXISTS idx_portals_active ON portals(practice_id, is_active);

-- =============================================
-- SECTION 8: ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE referring_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients_non_phi ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals_non_phi ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits_non_phi ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_non_phi ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims_non_phi ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE physicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_questionnaires ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECTION 9: RLS POLICIES
-- =============================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Therapists (legacy)
CREATE POLICY "Users can view own therapist profile" ON therapists FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own therapist profile" ON therapists FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own therapist profile" ON therapists FOR INSERT WITH CHECK (auth.uid() = id);

-- Referring Providers, Clients, Sessions, Referrals (legacy)
CREATE POLICY "Therapists can manage own referring providers" ON referring_providers FOR ALL USING (auth.uid() = therapist_id);
CREATE POLICY "Therapists can manage own clients" ON clients FOR ALL USING (auth.uid() = therapist_id);
CREATE POLICY "Therapists can manage own sessions" ON sessions FOR ALL USING (auth.uid() = therapist_id);
CREATE POLICY "Therapists can manage own referrals" ON referrals FOR ALL USING (auth.uid() = therapist_id);

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Practices
CREATE POLICY "Users can view their practice" ON practices FOR SELECT USING (
  id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
  OR id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert practices" ON practices FOR INSERT WITH CHECK (true);
CREATE POLICY "Practice members can update practice" ON practices FOR UPDATE USING (
  id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
  OR id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid() AND role = 'admin')
);

-- Practice Users
CREATE POLICY "Users can view practice members" ON practice_users FOR SELECT USING (
  practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
  OR practice_id IN (SELECT practice_id FROM practice_users pu WHERE pu.user_id = auth.uid())
);
CREATE POLICY "Practice admins can insert members" ON practice_users FOR INSERT WITH CHECK (
  practice_id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid() AND role = 'admin')
  OR practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Practice admins can update members" ON practice_users FOR UPDATE USING (
  practice_id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid() AND role = 'admin')
);

-- Patients (Non-PHI)
CREATE POLICY "Users can view own patients" ON patients_non_phi FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own patients" ON patients_non_phi FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own patients" ON patients_non_phi FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own patients" ON patients_non_phi FOR DELETE USING (auth.uid() = owner_user_id);

-- Referrals (Non-PHI)
CREATE POLICY "Users can view own referrals" ON referrals_non_phi FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own referrals" ON referrals_non_phi FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own referrals" ON referrals_non_phi FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own referrals" ON referrals_non_phi FOR DELETE USING (auth.uid() = owner_user_id);

-- Visits (Non-PHI)
CREATE POLICY "Users can view own visits" ON visits_non_phi FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own visits" ON visits_non_phi FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own visits" ON visits_non_phi FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own visits" ON visits_non_phi FOR DELETE USING (auth.uid() = owner_user_id);

-- Payments (Non-PHI)
CREATE POLICY "Users can view own payments" ON payments_non_phi FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own payments" ON payments_non_phi FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own payments" ON payments_non_phi FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own payments" ON payments_non_phi FOR DELETE USING (auth.uid() = owner_user_id);

-- Claims (Non-PHI)
CREATE POLICY "Users can view own claims" ON claims_non_phi FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own claims" ON claims_non_phi FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own claims" ON claims_non_phi FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own claims" ON claims_non_phi FOR DELETE USING (auth.uid() = owner_user_id);

-- Patient Benefits
CREATE POLICY "Users can view own patient benefits" ON patient_benefits FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own patient benefits" ON patient_benefits FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own patient benefits" ON patient_benefits FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own patient benefits" ON patient_benefits FOR DELETE USING (auth.uid() = owner_user_id);

-- Physicians
CREATE POLICY "Users can view own physicians" ON physicians FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own physicians" ON physicians FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own physicians" ON physicians FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own physicians" ON physicians FOR DELETE USING (auth.uid() = owner_user_id);

-- Portals
CREATE POLICY "Users can view portals for their practice" ON portals FOR SELECT USING (
  practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert portals for their practice" ON portals FOR INSERT WITH CHECK (
  practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update portals for their practice" ON portals FOR UPDATE USING (
  practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete portals for their practice" ON portals FOR DELETE USING (
  practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
);

-- Document Templates
CREATE POLICY "Users can view own document templates" ON document_templates FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own document templates" ON document_templates FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own document templates" ON document_templates FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own document templates" ON document_templates FOR DELETE USING (auth.uid() = owner_user_id);

-- Client Documents
CREATE POLICY "Users can view own client documents" ON client_documents FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own client documents" ON client_documents FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own client documents" ON client_documents FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own client documents" ON client_documents FOR DELETE USING (auth.uid() = owner_user_id);
CREATE POLICY "Public can insert client documents" ON client_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update client documents" ON client_documents FOR UPDATE USING (true);

-- Consent Links
CREATE POLICY "Users can view own consent links" ON consent_links FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own consent links" ON consent_links FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own consent links" ON consent_links FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own consent links" ON consent_links FOR DELETE USING (auth.uid() = owner_user_id);
CREATE POLICY "Public can view consent links by token" ON consent_links FOR SELECT USING (true);
CREATE POLICY "Public can update consent links" ON consent_links FOR UPDATE USING (true);

-- Intake Forms
CREATE POLICY "Users can view own intake forms" ON intake_forms FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own intake forms" ON intake_forms FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own intake forms" ON intake_forms FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own intake forms" ON intake_forms FOR DELETE USING (auth.uid() = owner_user_id);

-- Intake Links
CREATE POLICY "Users can view own intake links" ON intake_links FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own intake links" ON intake_links FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own intake links" ON intake_links FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own intake links" ON intake_links FOR DELETE USING (auth.uid() = owner_user_id);
CREATE POLICY "Public can view intake links by token" ON intake_links FOR SELECT USING (true);

-- Intake Responses
CREATE POLICY "Users can view own intake responses" ON intake_responses FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Public can insert intake responses" ON intake_responses FOR INSERT WITH CHECK (true);

-- Practitioners
CREATE POLICY "admin_manage_practitioners" ON practitioners FOR ALL USING (is_admin());
CREATE POLICY "practitioner_view_own" ON practitioners FOR SELECT USING (user_id = auth.uid());

-- Admin Users
CREATE POLICY "admin_view_admin_users" ON admin_users FOR SELECT USING (is_admin());

-- Admin Events
CREATE POLICY "admin_view_events" ON admin_events FOR SELECT USING (is_admin());
CREATE POLICY "admin_insert_events" ON admin_events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "practitioner_insert_own_events" ON admin_events FOR INSERT WITH CHECK (
  actor_type = 'practitioner' AND actor_id = auth.uid()
);

-- Impersonation Sessions
CREATE POLICY "admin_manage_impersonation" ON impersonation_sessions FOR ALL USING (is_admin());

-- Onboarding Questionnaires
CREATE POLICY "Public can read questionnaires by token" ON onboarding_questionnaires FOR SELECT USING (true);
CREATE POLICY "Public can update questionnaires by token" ON onboarding_questionnaires FOR UPDATE USING (true) WITH CHECK (true);

-- =============================================
-- SECTION 10: TRIGGERS
-- =============================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients_non_phi;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients_non_phi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals_non_phi;
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals_non_phi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claims_updated_at ON claims_non_phi;
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims_non_phi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_practices_updated_at ON practices;
CREATE TRIGGER update_practices_updated_at BEFORE UPDATE ON practices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_templates_updated_at ON document_templates;
CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_documents_updated_at ON client_documents;
CREATE TRIGGER update_client_documents_updated_at BEFORE UPDATE ON client_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intake_forms_updated_at ON intake_forms;
CREATE TRIGGER update_intake_forms_updated_at BEFORE UPDATE ON intake_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_patient_benefits_updated_at ON patient_benefits;
CREATE TRIGGER trigger_patient_benefits_updated_at BEFORE UPDATE ON patient_benefits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_practitioners_updated_at ON practitioners;
CREATE TRIGGER trg_practitioners_updated_at BEFORE UPDATE ON practitioners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_questionnaire_timestamp ON onboarding_questionnaires;
CREATE TRIGGER trigger_update_questionnaire_timestamp BEFORE UPDATE ON onboarding_questionnaires FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SECTION 11: BUSINESS LOGIC FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile and practice on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_practice_id UUID;
BEGIN
  -- Create a new practice for the user
  INSERT INTO practices (name, practice_type)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Practice'), 'insurance')
  RETURNING id INTO new_practice_id;

  -- Insert the profile with the practice_id
  INSERT INTO public.profiles (id, full_name, practice_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', new_practice_id);

  -- Add user to practice_users as admin
  INSERT INTO public.practice_users (practice_id, user_id, role)
  VALUES (new_practice_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-save physician from referral
CREATE OR REPLACE FUNCTION save_physician_from_referral()
RETURNS TRIGGER AS $$
DECLARE
  v_practice_id UUID;
BEGIN
  IF NEW.physician_name IS NULL OR NEW.physician_name = '' THEN
    RETURN NEW;
  END IF;

  SELECT practice_id INTO v_practice_id FROM profiles WHERE id = NEW.owner_user_id;

  INSERT INTO physicians (practice_id, owner_user_id, name, npi, specialty, clinic_name, phone, fax, referral_count)
  VALUES (v_practice_id, NEW.owner_user_id, NEW.physician_name, NULLIF(NEW.physician_npi, ''), NEW.physician_specialty, NEW.physician_clinic, NEW.physician_phone, NEW.physician_fax, 1)
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

DROP TRIGGER IF EXISTS trg_save_physician_from_referral ON referrals_non_phi;
CREATE TRIGGER trg_save_physician_from_referral
  AFTER INSERT ON referrals_non_phi
  FOR EACH ROW EXECUTE FUNCTION save_physician_from_referral();

-- Auto-update referral status
CREATE OR REPLACE FUNCTION update_referral_status()
RETURNS TRIGGER AS $$
DECLARE
  v_visits_used INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_visits_used FROM visits_non_phi WHERE referral_id = NEW.id;

  IF NEW.visit_limit_count IS NOT NULL AND v_visits_used >= NEW.visit_limit_count THEN
    NEW.status := 'exhausted';
  ELSIF NEW.referral_expiration_date IS NOT NULL AND NEW.referral_expiration_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSE
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_referral_status ON referrals_non_phi;
CREATE TRIGGER trg_update_referral_status
  BEFORE UPDATE ON referrals_non_phi
  FOR EACH ROW EXECUTE FUNCTION update_referral_status();

-- Increment referral visits on visit creation
CREATE OR REPLACE FUNCTION increment_referral_visits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_id IS NOT NULL THEN
    UPDATE referrals_non_phi SET updated_at = NOW() WHERE id = NEW.referral_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_referral_visits ON visits_non_phi;
CREATE TRIGGER trg_increment_referral_visits
  AFTER INSERT ON visits_non_phi
  FOR EACH ROW EXECUTE FUNCTION increment_referral_visits();

-- Seed default portals for new practice
CREATE OR REPLACE FUNCTION seed_default_portals(p_practice_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO portals (practice_id, name, url, sort_order) VALUES
    (p_practice_id, 'Office Ally', 'https://www.officeally.com', 1),
    (p_practice_id, 'Availity', 'https://www.availity.com', 2),
    (p_practice_id, 'One Health Port', 'https://www.onehealthport.com', 3),
    (p_practice_id, 'Premera', 'https://www.premera.com/provider', 4),
    (p_practice_id, 'Regence', 'https://www.regence.com/provider', 5),
    (p_practice_id, 'Aetna', 'https://www.aetna.com/providers', 6),
    (p_practice_id, 'UnitedHealthcare', 'https://www.uhcprovider.com', 7),
    (p_practice_id, 'Cigna', 'https://www.cigna.com/providers', 8),
    (p_practice_id, 'Molina', 'https://www.molinahealthcare.com/providers', 9),
    (p_practice_id, 'Blue Cross', 'https://www.bluecross.com', 10)
  ON CONFLICT (practice_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_seed_default_portals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_portals(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_default_portals ON practices;
CREATE TRIGGER trg_seed_default_portals
  AFTER INSERT ON practices
  FOR EACH ROW EXECUTE FUNCTION trigger_seed_default_portals();

-- Create onboarding questionnaire when practitioner is created
CREATE OR REPLACE FUNCTION create_onboarding_questionnaire()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_questionnaires (practitioner_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_onboarding_questionnaire ON practitioners;
CREATE TRIGGER trigger_create_onboarding_questionnaire
  AFTER INSERT ON practitioners
  FOR EACH ROW EXECUTE FUNCTION create_onboarding_questionnaire();

-- Verify admin password
CREATE OR REPLACE FUNCTION verify_admin_password(admin_email TEXT, admin_password TEXT)
RETURNS SETOF admin_users AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM admin_users
  WHERE email = admin_email
    AND is_active = true
    AND password_hash = crypt(admin_password, password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SECTION 12: VIEWS
-- =============================================

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
  SELECT pr.id as practitioner_id, COUNT(DISTINCT pat.id) as patient_count
  FROM practitioners pr
  LEFT JOIN patients_non_phi pat ON pat.owner_user_id = pr.user_id
  GROUP BY pr.id
) patient_counts ON patient_counts.practitioner_id = p.id
LEFT JOIN (
  SELECT pr.id as practitioner_id,
    COUNT(v.id) as visit_count,
    COUNT(CASE WHEN v.visit_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as visits_this_week,
    COUNT(CASE WHEN v.visit_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as visits_this_month
  FROM practitioners pr
  LEFT JOIN visits_non_phi v ON v.owner_user_id = pr.user_id
  GROUP BY pr.id
) visit_counts ON visit_counts.practitioner_id = p.id
LEFT JOIN (
  SELECT pr.id as practitioner_id,
    COALESCE(SUM(pay.amount), 0) as total_payments,
    COALESCE(SUM(CASE WHEN pay.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN pay.amount ELSE 0 END), 0) as payments_this_month
  FROM practitioners pr
  LEFT JOIN payments_non_phi pay ON pay.owner_user_id = pr.user_id
  GROUP BY pr.id
) payment_sums ON payment_sums.practitioner_id = p.id
LEFT JOIN (
  SELECT pr.id as practitioner_id,
    COUNT(CASE WHEN c.status IN ('TO_SUBMIT', 'SUBMITTED', 'PENDING') THEN 1 END) as pending_claims_count
  FROM practitioners pr
  LEFT JOIN claims_non_phi c ON c.owner_user_id = pr.user_id
  GROUP BY pr.id
) claim_counts ON claim_counts.practitioner_id = p.id
WHERE p.deleted_at IS NULL;

GRANT SELECT ON practitioner_stats TO authenticated;
GRANT SELECT ON practitioner_stats TO service_role;

-- =============================================
-- SECTION 13: STORAGE BUCKETS
-- =============================================

-- Note: Run these separately if buckets already exist
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('referral-documents', 'referral-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('onboarding', 'onboarding', false) ON CONFLICT DO NOTHING;

-- Storage policies for recordings
DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recordings' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read own recordings" ON storage.objects;
CREATE POLICY "Authenticated users can read own recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for referral documents
DROP POLICY IF EXISTS "Authenticated users can upload referral documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload referral documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'referral-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read own referral documents" ON storage.objects;
CREATE POLICY "Authenticated users can read own referral documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'referral-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated users can delete own referral documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete own referral documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'referral-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for onboarding bucket
DROP POLICY IF EXISTS "Anyone can upload to onboarding bucket" ON storage.objects;
CREATE POLICY "Anyone can upload to onboarding bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'onboarding');

DROP POLICY IF EXISTS "Anyone can read from onboarding bucket" ON storage.objects;
CREATE POLICY "Anyone can read from onboarding bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'onboarding');

-- =============================================
-- COMPLETE!
-- =============================================
-- Run this SQL in your production Supabase SQL Editor
-- After running, create an admin user manually:
--
-- INSERT INTO admin_users (email, password_hash, name, role)
-- VALUES ('your@email.com', crypt('your-password', gen_salt('bf')), 'Your Name', 'super_admin');
--
-- Then link to the auth.users table after signing up via Supabase Auth
