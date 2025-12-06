-- Create portals table for customizable claim submission portals
CREATE TABLE IF NOT EXISTS portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),                      -- Optional: login URL
  notes TEXT,                            -- Optional: login hints, username, etc.

  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(practice_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_portals_practice ON portals(practice_id);
CREATE INDEX IF NOT EXISTS idx_portals_active ON portals(practice_id, is_active);

-- Enable RLS
ALTER TABLE portals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portals
-- Users can view portals for their practice
CREATE POLICY "Users can view portals for their practice" ON portals
  FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert portals for their practice
CREATE POLICY "Users can insert portals for their practice" ON portals
  FOR INSERT
  WITH CHECK (
    practice_id IN (
      SELECT practice_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update portals for their practice
CREATE POLICY "Users can update portals for their practice" ON portals
  FOR UPDATE
  USING (
    practice_id IN (
      SELECT practice_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can delete portals for their practice
CREATE POLICY "Users can delete portals for their practice" ON portals
  FOR DELETE
  USING (
    practice_id IN (
      SELECT practice_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Function to seed default portals for a new practice
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

-- Trigger function to auto-seed portals when a new practice is created
CREATE OR REPLACE FUNCTION trigger_seed_default_portals()
RETURNS TRIGGER AS $$
BEGIN
  -- Seed default portals for ALL new practices
  PERFORM seed_default_portals(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-seed portals on practice creation
DROP TRIGGER IF EXISTS trg_seed_default_portals ON practices;
CREATE TRIGGER trg_seed_default_portals
  AFTER INSERT ON practices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_default_portals();

-- Seed portals for ALL existing practices that don't have any
DO $$
DECLARE
  practice_record RECORD;
BEGIN
  FOR practice_record IN SELECT id FROM practices LOOP
    -- Only seed if practice has no portals
    IF NOT EXISTS (SELECT 1 FROM portals WHERE practice_id = practice_record.id) THEN
      PERFORM seed_default_portals(practice_record.id);
    END IF;
  END LOOP;
END;
$$;
