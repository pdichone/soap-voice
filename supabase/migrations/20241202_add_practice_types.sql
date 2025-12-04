-- Multi-Practice Type Expansion Migration
-- Run this migration in Supabase SQL Editor AFTER 20241201_create_ops_tables.sql

-- =============================================
-- 1. CREATE PRACTICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  practice_type TEXT NOT NULL DEFAULT 'insurance'
    CHECK (practice_type IN ('cash_only', 'insurance', 'school')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. ADD PRACTICE_ID TO PROFILES
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);

-- =============================================
-- 3. CREATE PRACTICE_USERS TABLE (for multi-user support)
-- =============================================
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

-- Enable RLS
ALTER TABLE practice_users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. EXPAND PAYMENT METHODS
-- =============================================
-- Drop existing constraint and add expanded one
ALTER TABLE payments_non_phi DROP CONSTRAINT IF EXISTS payments_non_phi_method_check;
ALTER TABLE payments_non_phi ADD CONSTRAINT payments_non_phi_method_check
  CHECK (method IN ('CASH', 'CHECK', 'CARD', 'HSA', 'VENMO', 'CASHAPP', 'APPLEPAY', 'ZELLE', 'OTHER'));

-- =============================================
-- 5. RLS POLICIES FOR PRACTICES
-- =============================================
CREATE POLICY "Users can view their practice" ON practices
  FOR SELECT USING (
    id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
    OR id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert practices" ON practices
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Practice members can update practice" ON practices
  FOR UPDATE USING (
    id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
    OR id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 6. RLS POLICIES FOR PRACTICE_USERS
-- =============================================
CREATE POLICY "Users can view practice members" ON practice_users
  FOR SELECT USING (
    practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
    OR practice_id IN (SELECT practice_id FROM practice_users pu WHERE pu.user_id = auth.uid())
  );

CREATE POLICY "Practice admins can insert members" ON practice_users
  FOR INSERT WITH CHECK (
    practice_id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid() AND role = 'admin')
    OR practice_id IN (SELECT practice_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Practice admins can update members" ON practice_users
  FOR UPDATE USING (
    practice_id IN (SELECT practice_id FROM practice_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 7. INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_practices_type ON practices(practice_type);
CREATE INDEX IF NOT EXISTS idx_profiles_practice ON profiles(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_users_practice ON practice_users(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_users_user ON practice_users(user_id);

-- =============================================
-- 8. UPDATED_AT TRIGGER FOR PRACTICES
-- =============================================
DROP TRIGGER IF EXISTS update_practices_updated_at ON practices;
CREATE TRIGGER update_practices_updated_at
  BEFORE UPDATE ON practices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 9. MIGRATE EXISTING USERS TO HAVE PRACTICES
-- =============================================
-- Create a practice for each existing user who doesn't have one
DO $$
DECLARE
  profile_record RECORD;
  new_practice_id UUID;
BEGIN
  FOR profile_record IN
    SELECT id, full_name FROM profiles WHERE practice_id IS NULL
  LOOP
    -- Create a new practice for this user
    INSERT INTO practices (name, practice_type)
    VALUES (COALESCE(profile_record.full_name, 'My Practice'), 'insurance')
    RETURNING id INTO new_practice_id;

    -- Update the profile with the practice_id
    UPDATE profiles SET practice_id = new_practice_id WHERE id = profile_record.id;

    -- Add the user to practice_users as admin
    INSERT INTO practice_users (practice_id, user_id, role)
    VALUES (new_practice_id, profile_record.id, 'admin');
  END LOOP;
END $$;

-- =============================================
-- 10. UPDATE NEW USER TRIGGER TO CREATE PRACTICE
-- =============================================
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
