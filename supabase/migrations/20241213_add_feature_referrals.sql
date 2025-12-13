-- Add feature_referrals column to practitioners table
-- This allows super admins to control referral feature visibility per practice

ALTER TABLE practitioners
ADD COLUMN IF NOT EXISTS feature_referrals BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN practitioners.feature_referrals IS 'Admin-controlled flag to show/hide referral management features';
