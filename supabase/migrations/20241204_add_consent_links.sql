-- Consent Links Feature
-- Allows clients to remotely sign consent documents via a unique link

-- =============================================
-- CONSENT_LINKS TABLE
-- Unique links sent to clients for document signing
-- =============================================
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

-- Enable RLS
ALTER TABLE consent_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own consent links" ON consent_links;
DROP POLICY IF EXISTS "Users can insert own consent links" ON consent_links;
DROP POLICY IF EXISTS "Users can update own consent links" ON consent_links;
DROP POLICY IF EXISTS "Users can delete own consent links" ON consent_links;
DROP POLICY IF EXISTS "Public can view consent links by token" ON consent_links;
DROP POLICY IF EXISTS "Public can update consent links" ON consent_links;

-- Policies for practitioners
CREATE POLICY "Users can view own consent links" ON consent_links
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own consent links" ON consent_links
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own consent links" ON consent_links
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own consent links" ON consent_links
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Public access by token (for clients signing documents)
CREATE POLICY "Public can view consent links by token" ON consent_links
  FOR SELECT USING (true);  -- Token lookup handled in app logic

CREATE POLICY "Public can update consent links" ON consent_links
  FOR UPDATE USING (true);  -- Token validation in app logic

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consent_links_token ON consent_links(token);
CREATE INDEX IF NOT EXISTS idx_consent_links_owner ON consent_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_consent_links_patient ON consent_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_links_template ON consent_links(template_id);

-- Add public insert policy for client_documents (so clients can sign)
DROP POLICY IF EXISTS "Public can insert client documents" ON client_documents;
CREATE POLICY "Public can insert client documents" ON client_documents
  FOR INSERT WITH CHECK (true);  -- Token validation in app logic

DROP POLICY IF EXISTS "Public can update client documents" ON client_documents;
CREATE POLICY "Public can update client documents" ON client_documents
  FOR UPDATE USING (true);  -- Token validation in app logic

-- =============================================
-- HELPER FUNCTION: Generate short tokens for consent
-- =============================================
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
