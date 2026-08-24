ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_key TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_provider VARCHAR(30);

UPDATE posts
SET media_provider = CASE
  WHEN media_url LIKE '%cloudflare%' OR media_url LIKE '%r2.dev%' THEN 'cloudflare-r2'
  WHEN media_url IS NOT NULL THEN 'cloudinary'
  ELSE NULL
END
WHERE media_provider IS NULL;
