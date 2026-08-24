-- Complete the operational schema used by finance, reporting, moderation and audit modules.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS username VARCHAR(100);

CREATE TABLE IF NOT EXISTS commission_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  transaction_type VARCHAR(60) NOT NULL,
  percentage NUMERIC(8,4) NOT NULL DEFAULT 0,
  fixed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(14,2),
  applies_to_creator BOOLEAN NOT NULL DEFAULT TRUE,
  applies_to_user BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES commission_configs(id),
  transaction_type VARCHAR(60) NOT NULL,
  user_id UUID REFERENCES users(id),
  creator_id UUID REFERENCES users(id),
  reference_id UUID,
  reference_type VARCHAR(60),
  original_amount NUMERIC(14,2) NOT NULL,
  commission_percentage NUMERIC(8,4) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'collected',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  tax_type VARCHAR(60) NOT NULL,
  country VARCHAR(8) NOT NULL DEFAULT 'KE',
  region VARCHAR(120),
  percentage NUMERIC(8,4) NOT NULL DEFAULT 0,
  applies_to VARCHAR(80),
  threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_compound BOOLEAN NOT NULL DEFAULT FALSE,
  statutory_reference TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_config_id UUID REFERENCES tax_configs(id),
  tax_type VARCHAR(60) NOT NULL,
  country VARCHAR(8) NOT NULL DEFAULT 'KE',
  transaction_type VARCHAR(60) NOT NULL,
  payer_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  reference_id UUID,
  reference_type VARCHAR(60),
  taxable_amount NUMERIC(14,2) NOT NULL,
  tax_percentage NUMERIC(8,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(60) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_tax NUMERIC(16,2) NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_filed BOOLEAN NOT NULL DEFAULT FALSE,
  filing_date DATE,
  filing_reference VARCHAR(160),
  filed_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  commission_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  tax_collected NUMERIC(16,2) NOT NULL DEFAULT 0,
  promotion_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  verification_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  token_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  gross_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE OR REPLACE FUNCTION generate_platform_revenue(start_date DATE, end_date DATE)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO platform_revenue (
    period_start, period_end, commission_revenue, tax_collected,
    promotion_revenue, verification_revenue, token_revenue, gross_revenue
  )
  SELECT
    start_date,
    end_date,
    COALESCE((SELECT SUM(commission_amount) FROM commission_transactions WHERE created_at::date BETWEEN start_date AND end_date AND status = 'collected'), 0),
    COALESCE((SELECT SUM(tax_amount) FROM tax_transactions WHERE created_at::date BETWEEN start_date AND end_date AND status IN ('paid', 'remitted')), 0),
    COALESCE((SELECT SUM(amount_paid) FROM promoted_content WHERE created_at::date BETWEEN start_date AND end_date), 0),
    COALESCE((SELECT SUM(amount_paid) FROM user_verifications WHERE created_at::date BETWEEN start_date AND end_date), 0),
    COALESCE((SELECT SUM(amount) FROM mpesa_transactions WHERE created_at::date BETWEEN start_date AND end_date AND status = 'completed'), 0),
    COALESCE((SELECT SUM(commission_amount) FROM commission_transactions WHERE created_at::date BETWEEN start_date AND end_date AND status = 'collected'), 0)
      + COALESCE((SELECT SUM(amount_paid) FROM promoted_content WHERE created_at::date BETWEEN start_date AND end_date), 0)
      + COALESCE((SELECT SUM(amount_paid) FROM user_verifications WHERE created_at::date BETWEEN start_date AND end_date), 0)
  ON CONFLICT (period_start, period_end) DO UPDATE SET
    commission_revenue = EXCLUDED.commission_revenue,
    tax_collected = EXCLUDED.tax_collected,
    promotion_revenue = EXCLUDED.promotion_revenue,
    verification_revenue = EXCLUDED.verification_revenue,
    token_revenue = EXCLUDED.token_revenue,
    gross_revenue = EXCLUDED.gross_revenue,
    updated_at = CURRENT_TIMESTAMP;
END;
$$;

CREATE TABLE IF NOT EXISTS banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  banned_by UUID NOT NULL REFERENCES staff(id),
  reason TEXT NOT NULL,
  duration VARCHAR(40) NOT NULL DEFAULT 'permanent',
  expires_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES staff(id),
  lifted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES staff(id);
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE moderation_queue ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE moderation_queue ALTER COLUMN priority TYPE VARCHAR(20)
  USING CASE priority::text WHEN '3' THEN 'urgent' WHEN '2' THEN 'high' WHEN '0' THEN 'low' ELSE 'normal' END;
ALTER TABLE moderation_queue ALTER COLUMN priority SET DEFAULT 'normal';
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES staff(id);
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

ALTER TABLE admin_activity_logs ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;
ALTER TABLE admin_activity_logs ADD COLUMN IF NOT EXISTS before_data JSONB;
ALTER TABLE admin_activity_logs ADD COLUMN IF NOT EXISTS after_data JSONB;
ALTER TABLE admin_activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(60),
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS gross_earnings NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS net_earnings NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'available';

CREATE INDEX IF NOT EXISTS commission_transactions_created_idx ON commission_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS commission_transactions_user_idx ON commission_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tax_transactions_created_idx ON tax_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS tax_transactions_recipient_idx ON tax_transactions(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS banned_users_active_idx ON banned_users(user_id) WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_activity_logs_created_idx ON admin_activity_logs(created_at DESC);

INSERT INTO commission_configs (name, transaction_type, percentage, applies_to_creator, applies_to_user)
VALUES
  ('Creator tips', 'tip', 10, TRUE, FALSE),
  ('Creator withdrawals', 'withdrawal', 5, TRUE, FALSE),
  ('Promotions', 'promotion', 0, FALSE, TRUE)
ON CONFLICT DO NOTHING;
