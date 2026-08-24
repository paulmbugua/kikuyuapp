-- Runtime support for presence, analytics and scheduled maintenance.

ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS device_info JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE promotion_impressions ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_verifications ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_verifications ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS period_end DATE;

CREATE TABLE IF NOT EXISTS daily_stats (
  date DATE PRIMARY KEY,
  new_users INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  posts_created INTEGER NOT NULL DEFAULT 0,
  comments_created INTEGER NOT NULL DEFAULT 0,
  videos_created INTEGER NOT NULL DEFAULT 0,
  video_views INTEGER NOT NULL DEFAULT 0,
  tips_count INTEGER NOT NULL DEFAULT 0,
  tips_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  token_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  promotion_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  verification_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION expire_verifications()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE affected INTEGER;
BEGIN
  WITH expired AS (
    UPDATE user_verifications
    SET is_active = FALSE, status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE is_active = TRUE AND is_lifetime = FALSE AND expires_at <= NOW()
    RETURNING user_id
  )
  UPDATE users
  SET is_verified = FALSE, updated_at = CURRENT_TIMESTAMP
  WHERE id IN (SELECT user_id FROM expired)
    AND NOT EXISTS (
      SELECT 1 FROM user_verifications uv
      WHERE uv.user_id = users.id AND uv.is_active = TRUE
        AND (uv.is_lifetime = TRUE OR uv.expires_at > NOW())
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION generate_daily_stats(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO daily_stats (
    date, new_users, active_users, posts_created, comments_created,
    videos_created, video_views, tips_count, tips_amount,
    token_revenue, promotion_revenue, verification_revenue
  )
  SELECT
    target_date,
    (SELECT COUNT(*) FROM users WHERE created_at::date = target_date),
    (SELECT COUNT(*) FROM users WHERE last_login::date = target_date),
    (SELECT COUNT(*) FROM posts WHERE created_at::date = target_date),
    (SELECT COUNT(*) FROM comments WHERE created_at::date = target_date),
    (SELECT COUNT(*) FROM uhoro_videos WHERE created_at::date = target_date),
    (SELECT COUNT(*) FROM uhoro_views WHERE created_at::date = target_date),
    (SELECT COUNT(*) FROM tips WHERE created_at::date = target_date),
    COALESCE((SELECT SUM(amount) FROM tips WHERE created_at::date = target_date), 0),
    COALESCE((SELECT SUM(amount) FROM mpesa_transactions WHERE created_at::date = target_date AND status = 'completed'), 0),
    COALESCE((SELECT SUM(amount_paid) FROM promoted_content WHERE created_at::date = target_date), 0),
    COALESCE((SELECT SUM(amount_paid) FROM user_verifications WHERE created_at::date = target_date), 0)
  ON CONFLICT (date) DO UPDATE SET
    new_users = EXCLUDED.new_users,
    active_users = EXCLUDED.active_users,
    posts_created = EXCLUDED.posts_created,
    comments_created = EXCLUDED.comments_created,
    videos_created = EXCLUDED.videos_created,
    video_views = EXCLUDED.video_views,
    tips_count = EXCLUDED.tips_count,
    tips_amount = EXCLUDED.tips_amount,
    token_revenue = EXCLUDED.token_revenue,
    promotion_revenue = EXCLUDED.promotion_revenue,
    verification_revenue = EXCLUDED.verification_revenue,
    updated_at = CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_creator_earnings(start_date DATE, end_date DATE)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM creator_earnings
  WHERE source = 'period_summary' AND period_start = start_date AND period_end = end_date;

  INSERT INTO creator_earnings (
    user_id, amount, source, gross_earnings, commission_amount,
    tax_amount, net_earnings, status, period_start, period_end
  )
  SELECT
    receiver_id,
    SUM(amount),
    'period_summary',
    SUM(amount),
    SUM(amount) * 0.10,
    0,
    SUM(amount) * 0.90,
    'available',
    start_date,
    end_date
  FROM tips
  WHERE status = 'completed' AND created_at::date BETWEEN start_date AND end_date
  GROUP BY receiver_id;
END;
$$;

CREATE OR REPLACE FUNCTION generate_tax_report(report_kind VARCHAR, start_date DATE, end_date DATE)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE report_id UUID;
BEGIN
  INSERT INTO tax_reports (
    report_type, period_start, period_end, total_transactions,
    total_amount, total_tax, report_data
  )
  SELECT
    report_kind,
    start_date,
    end_date,
    COUNT(*),
    COALESCE(SUM(taxable_amount), 0),
    COALESCE(SUM(tax_amount), 0),
    jsonb_build_object('generated_at', CURRENT_TIMESTAMP, 'country', 'KE')
  FROM tax_transactions
  WHERE tax_type = report_kind AND created_at::date BETWEEN start_date AND end_date
  RETURNING id INTO report_id;
  RETURN report_id;
END;
$$;

CREATE INDEX IF NOT EXISTS user_presence_status_seen_idx ON user_presence(status, last_seen_at);
CREATE INDEX IF NOT EXISTS daily_stats_date_idx ON daily_stats(date DESC);
