-- Add paid_amount field to claims_non_phi table
-- This tracks the actual amount insurance paid (often different from billed amount)

ALTER TABLE claims_non_phi
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN claims_non_phi.paid_amount IS 'Actual amount paid by insurance (may differ from billed_amount due to contracted rates, adjustments, etc.)';
