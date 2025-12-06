-- =============================================
-- SUPER ADMIN SYSTEM MIGRATION
-- Creates practitioners, admin_users, admin_events, impersonation_sessions tables
-- =============================================

-- =============================================
-- PRACTITIONERS TABLE (LMT accounts with billing/features)
-- =============================================
CREATE TABLE IF NOT EXISTS practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  workspace_id UUID UNIQUE DEFAULT gen_random_uuid(),
  workspace_name VARCHAR(255),

  -- Account status
  status VARCHAR(20) DEFAULT 'active',

  -- Plan and billing
  plan_type VARCHAR(20) DEFAULT 'trial',
  monthly_price DECIMAL(10,2),
  billing_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  billing_started_at TIMESTAMPTZ,
  billing_notes TEXT,

  -- Feature flags
  feature_claims_tracking BOOLEAN DEFAULT true,
  feature_year_end_summary BOOLEAN DEFAULT true,
  feature_insurance_calculator BOOLEAN DEFAULT false,
  feature_bulk_operations BOOLEAN DEFAULT false,

  -- Activity tracking
  last_login_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Add check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'practitioners_status_check'
  ) THEN
    ALTER TABLE practitioners
      ADD CONSTRAINT practitioners_status_check
      CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'practitioners_plan_type_check'
  ) THEN
    ALTER TABLE practitioners
      ADD CONSTRAINT practitioners_plan_type_check
      CHECK (plan_type IN ('trial', 'solo', 'professional', 'enterprise', 'founder', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'practitioners_billing_status_check'
  ) THEN
    ALTER TABLE practitioners
      ADD CONSTRAINT practitioners_billing_status_check
      CHECK (billing_status IN ('trial', 'paying', 'overdue', 'cancelled', 'comped'));
  END IF;
END $$;

-- Indexes for practitioners
CREATE INDEX IF NOT EXISTS idx_practitioners_user_id ON practitioners(user_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_email ON practitioners(email);
CREATE INDEX IF NOT EXISTS idx_practitioners_workspace_id ON practitioners(workspace_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_status ON practitioners(status);
CREATE INDEX IF NOT EXISTS idx_practitioners_billing_status ON practitioners(billing_status);
CREATE INDEX IF NOT EXISTS idx_practitioners_plan_type ON practitioners(plan_type);

-- =============================================
-- ADMIN USERS TABLE (Super admins like Paulo)
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraint for role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('admin', 'super_admin', 'support'));
  END IF;
END $$;

-- Indexes for admin_users
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);

-- =============================================
-- ADMIN EVENTS TABLE (Audit log)
-- =============================================
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraint for actor_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_events_actor_type_check'
  ) THEN
    ALTER TABLE admin_events
      ADD CONSTRAINT admin_events_actor_type_check
      CHECK (actor_type IN ('admin', 'practitioner', 'system'));
  END IF;
END $$;

-- Indexes for admin_events
CREATE INDEX IF NOT EXISTS idx_admin_events_practitioner_id ON admin_events(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_admin_events_event_type ON admin_events(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_events_event_category ON admin_events(event_category);
CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON admin_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_actor_id ON admin_events(actor_id);

-- =============================================
-- IMPERSONATION SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ip_address VARCHAR(50),
  user_agent TEXT
);

-- Indexes for impersonation_sessions
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin_id ON impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_practitioner_id ON impersonation_sessions(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_started_at ON impersonation_sessions(started_at DESC);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
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

-- Practitioners: Admin full access, practitioners can view own
DROP POLICY IF EXISTS "admin_manage_practitioners" ON practitioners;
CREATE POLICY "admin_manage_practitioners" ON practitioners
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "practitioner_view_own" ON practitioners;
CREATE POLICY "practitioner_view_own" ON practitioners
  FOR SELECT USING (user_id = auth.uid());

-- Admin Users: Only admins can view
DROP POLICY IF EXISTS "admin_view_admin_users" ON admin_users;
CREATE POLICY "admin_view_admin_users" ON admin_users
  FOR SELECT USING (is_admin());

-- Admin Events: Only admins can view
DROP POLICY IF EXISTS "admin_view_events" ON admin_events;
CREATE POLICY "admin_view_events" ON admin_events
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_events" ON admin_events;
CREATE POLICY "admin_insert_events" ON admin_events
  FOR INSERT WITH CHECK (is_admin());

-- Allow practitioners to log their own events (via service role or trigger)
DROP POLICY IF EXISTS "practitioner_insert_own_events" ON admin_events;
CREATE POLICY "practitioner_insert_own_events" ON admin_events
  FOR INSERT WITH CHECK (
    actor_type = 'practitioner' AND
    actor_id = auth.uid()
  );

-- Impersonation Sessions: Only admins can view/manage
DROP POLICY IF EXISTS "admin_manage_impersonation" ON impersonation_sessions;
CREATE POLICY "admin_manage_impersonation" ON impersonation_sessions
  FOR ALL USING (is_admin());

-- =============================================
-- PRACTITIONER STATS VIEW
-- =============================================
CREATE OR REPLACE VIEW practitioner_stats AS
SELECT
  p.id,
  p.name,
  p.email,
  p.workspace_id,
  p.workspace_name,
  p.status,
  p.plan_type,
  p.billing_status,
  p.trial_ends_at,
  p.billing_started_at,
  p.billing_notes,
  p.monthly_price,
  p.feature_claims_tracking,
  p.feature_year_end_summary,
  p.feature_insurance_calculator,
  p.feature_bulk_operations,
  p.last_login_at,
  p.last_activity_at,
  p.login_count,
  p.created_at,
  p.user_id,
  (SELECT COUNT(*) FROM patients_non_phi WHERE owner_user_id = p.user_id) as patient_count,
  (SELECT COUNT(*) FROM visits_non_phi WHERE owner_user_id = p.user_id) as visit_count,
  (SELECT COUNT(*) FROM visits_non_phi WHERE owner_user_id = p.user_id
    AND visit_date >= CURRENT_DATE - INTERVAL '7 days') as visits_this_week,
  (SELECT COUNT(*) FROM visits_non_phi WHERE owner_user_id = p.user_id
    AND visit_date >= DATE_TRUNC('month', CURRENT_DATE)) as visits_this_month,
  (SELECT COALESCE(SUM(amount), 0) FROM payments_non_phi WHERE owner_user_id = p.user_id) as total_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM payments_non_phi WHERE owner_user_id = p.user_id
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE)) as payments_this_month,
  (SELECT COUNT(*) FROM claims_non_phi WHERE owner_user_id = p.user_id
    AND status IN ('TO_SUBMIT', 'SUBMITTED', 'PENDING')) as pending_claims_count
FROM practitioners p
WHERE p.deleted_at IS NULL;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Verify admin password (for custom auth)
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

-- Update practitioner activity on login
CREATE OR REPLACE FUNCTION update_practitioner_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE practitioners
  SET
    last_login_at = NOW(),
    login_count = login_count + 1,
    updated_at = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_practitioners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_practitioners_updated_at ON practitioners;
CREATE TRIGGER trg_practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW
  EXECUTE FUNCTION update_practitioners_updated_at();

-- =============================================
-- MIGRATION: Link existing profiles to practitioners
-- This should be run manually after initial setup
-- =============================================
-- INSERT INTO practitioners (user_id, email, name, workspace_name, plan_type, billing_status)
-- SELECT id, email, COALESCE(full_name, email), 'My Practice', 'founder', 'paying'
-- FROM profiles
-- WHERE email IS NOT NULL
-- ON CONFLICT (email) DO NOTHING;
