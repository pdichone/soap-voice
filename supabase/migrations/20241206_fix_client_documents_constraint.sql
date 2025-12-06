-- Fix client_documents unique constraint to include owner_user_id for better isolation
-- This ensures documents are properly scoped to each practitioner's patients

-- Drop the existing unique constraint
ALTER TABLE client_documents
DROP CONSTRAINT IF EXISTS client_documents_patient_id_template_id_key;

-- Add new unique constraint that includes owner_user_id
ALTER TABLE client_documents
ADD CONSTRAINT client_documents_owner_patient_template_key
  UNIQUE(owner_user_id, patient_id, template_id);

-- Also add a unique constraint on consent_links to prevent same patient/template combo
-- having multiple unsigned links (expiration checked at application level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_links_active_unsigned
  ON consent_links(patient_id, template_id)
  WHERE signed_at IS NULL;
