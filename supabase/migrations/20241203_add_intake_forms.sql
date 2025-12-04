-- Digital Intake Forms Feature
-- Sendable forms for clients to fill out before appointments

-- =============================================
-- INTAKE_FORMS TABLE
-- Form templates that practitioners create
-- =============================================
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

-- Enable RLS
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own intake forms" ON intake_forms;
DROP POLICY IF EXISTS "Users can insert own intake forms" ON intake_forms;
DROP POLICY IF EXISTS "Users can update own intake forms" ON intake_forms;
DROP POLICY IF EXISTS "Users can delete own intake forms" ON intake_forms;

-- Policies
CREATE POLICY "Users can view own intake forms" ON intake_forms
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own intake forms" ON intake_forms
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own intake forms" ON intake_forms
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own intake forms" ON intake_forms
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intake_forms_owner ON intake_forms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_active ON intake_forms(owner_user_id, is_active);

-- =============================================
-- INTAKE_LINKS TABLE
-- Unique links sent to clients
-- =============================================
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

-- Enable RLS
ALTER TABLE intake_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own intake links" ON intake_links;
DROP POLICY IF EXISTS "Users can insert own intake links" ON intake_links;
DROP POLICY IF EXISTS "Users can update own intake links" ON intake_links;
DROP POLICY IF EXISTS "Users can delete own intake links" ON intake_links;
DROP POLICY IF EXISTS "Public can view intake links by token" ON intake_links;

-- Policies for practitioners
CREATE POLICY "Users can view own intake links" ON intake_links
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own intake links" ON intake_links
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own intake links" ON intake_links
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own intake links" ON intake_links
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Public access by token (for clients filling out forms)
CREATE POLICY "Public can view intake links by token" ON intake_links
  FOR SELECT USING (true);  -- Token lookup handled in app logic

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intake_links_token ON intake_links(token);
CREATE INDEX IF NOT EXISTS idx_intake_links_owner ON intake_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_links_patient ON intake_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_links_form ON intake_links(form_id);

-- =============================================
-- INTAKE_RESPONSES TABLE
-- Client submissions
-- =============================================
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

-- Enable RLS
ALTER TABLE intake_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own intake responses" ON intake_responses;
DROP POLICY IF EXISTS "Users can insert intake responses" ON intake_responses;
DROP POLICY IF EXISTS "Public can insert intake responses" ON intake_responses;

-- Policies for practitioners
CREATE POLICY "Users can view own intake responses" ON intake_responses
  FOR SELECT USING (auth.uid() = owner_user_id);

-- Public can submit responses (validated by link token in app)
CREATE POLICY "Public can insert intake responses" ON intake_responses
  FOR INSERT WITH CHECK (true);  -- Token validation in app logic

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intake_responses_owner ON intake_responses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_patient ON intake_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_link ON intake_responses(link_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_form ON intake_responses(form_id);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_intake_forms_updated_at ON intake_forms;
CREATE TRIGGER update_intake_forms_updated_at
  BEFORE UPDATE ON intake_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTION: Generate short tokens
-- =============================================
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
