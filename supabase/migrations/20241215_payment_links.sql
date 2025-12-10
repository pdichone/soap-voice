-- Payment links table for admin-generated checkout links
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT,
  stripe_customer_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'founder',
  checkout_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for lookups
CREATE INDEX idx_payment_links_practitioner ON payment_links(practitioner_id);
CREATE INDEX idx_payment_links_session ON payment_links(stripe_checkout_session_id);

-- RLS
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- Admin access only (service role bypasses RLS)
CREATE POLICY "admin_full_access" ON payment_links
  FOR ALL USING (true);

-- Add comment for documentation
COMMENT ON TABLE payment_links IS 'Stores admin-generated Stripe checkout session links for practitioner onboarding';
