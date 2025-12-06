-- Add feature flags for intake forms and documents to practitioners table
-- These features are enabled by default (true) since they're core functionality

ALTER TABLE practitioners
ADD COLUMN IF NOT EXISTS feature_intake_forms BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_documents BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN practitioners.feature_intake_forms IS 'Feature flag: Allow creating and sending intake forms to clients';
COMMENT ON COLUMN practitioners.feature_documents IS 'Feature flag: Allow document templates and consent forms';
