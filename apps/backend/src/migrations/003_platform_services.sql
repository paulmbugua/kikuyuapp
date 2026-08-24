ALTER TABLE users ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_residency VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_id VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_registration VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE uhoro_comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  password_hash TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  token_amount INTEGER NOT NULL CHECK (token_amount > 0),
  price_kes NUMERIC(14,2) NOT NULL CHECK (price_kes >= 0),
  bonus_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  balance_before NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(60),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES token_packages(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  phone_number VARCHAR(30) NOT NULL,
  account_reference VARCHAR(120) NOT NULL,
  transaction_desc TEXT,
  checkout_request_id VARCHAR(160) UNIQUE,
  merchant_request_id VARCHAR(160),
  mpesa_receipt_number VARCHAR(120),
  result_code INTEGER,
  result_description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  transaction_id UUID REFERENCES token_transactions(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id),
  receiver_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  message TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  video_id UUID REFERENCES uhoro_videos(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (sender_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  token_amount NUMERIC(14,2) NOT NULL CHECK (token_amount > 0),
  method VARCHAR(40) NOT NULL,
  account_details JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  transaction_id UUID REFERENCES token_transactions(id),
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  transaction_reference VARCHAR(160),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  price_kes NUMERIC(14,2) NOT NULL,
  token_price NUMERIC(14,2) NOT NULL,
  duration_months INTEGER,
  discount_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID NOT NULL REFERENCES verification_plans(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  is_lifetime BOOLEAN NOT NULL DEFAULT FALSE,
  amount_paid NUMERIC(14,2),
  token_amount_used NUMERIC(14,2),
  payment_method VARCHAR(30) NOT NULL,
  mpesa_transaction_id UUID REFERENCES mpesa_transactions(id),
  transaction_id UUID REFERENCES token_transactions(id),
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID REFERENCES verification_plans(id),
  action VARCHAR(60) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  price_kes NUMERIC(14,2) NOT NULL,
  token_price NUMERIC(14,2) NOT NULL,
  duration_hours INTEGER NOT NULL,
  target_impressions INTEGER NOT NULL,
  discount_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promoted_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID NOT NULL REFERENCES promotion_plans(id),
  content_type VARCHAR(30) NOT NULL,
  content_id UUID NOT NULL,
  content_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  target_impressions INTEGER NOT NULL,
  current_impressions INTEGER NOT NULL DEFAULT 0,
  current_clicks INTEGER NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2),
  token_amount_used NUMERIC(14,2),
  payment_method VARCHAR(30) NOT NULL,
  audience_targeting JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mpesa_transaction_id UUID REFERENCES mpesa_transactions(id),
  transaction_id UUID REFERENCES token_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promoted_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promoted_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  destination_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_daily_stats (
  promotion_id UUID NOT NULL REFERENCES promoted_content(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY(promotion_id, date)
);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  content_type VARCHAR(30) NOT NULL,
  content_id UUID NOT NULL,
  reason VARCHAR(120) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES staff(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(30) NOT NULL,
  content_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),
  content_snapshot JSONB,
  report_count INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES staff(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type, content_id)
);

CREATE TABLE IF NOT EXISTS earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  source VARCHAR(50) NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(60),
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS token_transactions_user_created_idx ON token_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_user_created_idx ON withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS promoted_content_active_idx ON promoted_content(ends_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON content_reports(status, created_at);

INSERT INTO token_packages (name, description, token_amount, price_kes, bonus_percentage, is_popular, sort_order) VALUES
  ('Starter', 'For occasional community support', 100, 100, 0, FALSE, 1),
  ('Community', 'For regular support and creator tips', 550, 500, 10, TRUE, 2),
  ('Patron', 'For committed community patrons', 1200, 1000, 20, FALSE, 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO verification_plans (name, description, price_kes, token_price, duration_months, features, is_popular, sort_order) VALUES
  ('Annual', 'Annual identity and creator verification', 1200, 1200, 12, '["Verified badge", "Priority support"]', TRUE, 1),
  ('Lifetime', 'Permanent identity and creator verification', 4500, 4500, NULL, '["Lifetime badge", "Priority support"]', FALSE, 2)
ON CONFLICT (name) DO NOTHING;

INSERT INTO promotion_plans (name, description, price_kes, token_price, duration_hours, target_impressions, features, is_popular, sort_order) VALUES
  ('Starter', 'Introduce your story to the community', 500, 500, 24, 2500, '["Feed placement", "Basic analytics"]', FALSE, 1),
  ('Momentum', 'Grow engagement across the community', 1500, 1500, 72, 10000, '["Priority placement", "Audience targeting", "Analytics"]', TRUE, 2),
  ('Movement', 'Sustain a high-visibility community campaign', 4500, 4500, 168, 40000, '["Premium placement", "Audience targeting", "Advanced analytics"]', FALSE, 3)
ON CONFLICT (name) DO NOTHING;
