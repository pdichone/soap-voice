-- Migrate existing auth.users to practitioners table
-- This ensures users who signed up before the admin system are visible in the admin dashboard

INSERT INTO practitioners (user_id, email, name, workspace_name, plan_type, billing_status, status)
SELECT
  p.id as user_id,
  u.email,
  COALESCE(p.full_name, t.name, split_part(u.email, '@', 1)) as name,
  COALESCE(t.business_name, 'My Practice') as workspace_name,
  'founder' as plan_type,
  'paying' as billing_status,
  'active' as status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN therapists t ON t.id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM practitioners pr WHERE pr.email = u.email
)
AND u.email IS NOT NULL;

-- Log how many were migrated
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM practitioners WHERE created_at > NOW() - INTERVAL '1 minute';
  RAISE NOTICE 'Migrated % existing users to practitioners table', migrated_count;
END $$;
