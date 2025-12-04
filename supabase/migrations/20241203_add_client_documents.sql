-- Client Documents Feature
-- Intake forms, consent forms, and policy acknowledgments

-- =============================================
-- DOCUMENT_TEMPLATES TABLE
-- Templates that practitioners create
-- =============================================
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

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own document templates" ON document_templates;
DROP POLICY IF EXISTS "Users can insert own document templates" ON document_templates;
DROP POLICY IF EXISTS "Users can update own document templates" ON document_templates;
DROP POLICY IF EXISTS "Users can delete own document templates" ON document_templates;

-- Policies
CREATE POLICY "Users can view own document templates" ON document_templates
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own document templates" ON document_templates
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own document templates" ON document_templates
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own document templates" ON document_templates
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_templates_owner ON document_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_active ON document_templates(owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON document_templates(owner_user_id, document_type);

-- =============================================
-- CLIENT_DOCUMENTS TABLE
-- Records of client acknowledgments/signatures
-- =============================================
CREATE TABLE IF NOT EXISTS client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients_non_phi(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'DECLINED', 'EXPIRED')),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  signature_data TEXT, -- Could store signature image as base64 or just text "Acknowledged"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each client can only have one record per template
  UNIQUE(patient_id, template_id)
);

-- Enable RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own client documents" ON client_documents;
DROP POLICY IF EXISTS "Users can insert own client documents" ON client_documents;
DROP POLICY IF EXISTS "Users can update own client documents" ON client_documents;
DROP POLICY IF EXISTS "Users can delete own client documents" ON client_documents;

-- Policies
CREATE POLICY "Users can view own client documents" ON client_documents
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own client documents" ON client_documents
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own client documents" ON client_documents
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own client documents" ON client_documents
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_docs_owner ON client_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_patient ON client_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_template ON client_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_status ON client_documents(patient_id, status);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_document_templates_updated_at ON document_templates;
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_documents_updated_at ON client_documents;
CREATE TRIGGER update_client_documents_updated_at
  BEFORE UPDATE ON client_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
