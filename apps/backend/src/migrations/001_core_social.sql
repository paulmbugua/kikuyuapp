CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_creator BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(160);

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(30),
  media_public_id TEXT,
  media_width INTEGER,
  media_height INTEGER,
  media_duration NUMERIC(12,3),
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  shares_count INTEGER NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  bookmarks_count INTEGER NOT NULL DEFAULT 0 CHECK (bookmarks_count >= 0),
  views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  posts_count INTEGER NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE TABLE IF NOT EXISTS mentions (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  replies_count INTEGER NOT NULL DEFAULT 0 CHECK (replies_count >= 0),
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (num_nonnulls(post_id, comment_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_post_unique ON likes(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_comment_unique ON likes(user_id, comment_id) WHERE comment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  collection_name VARCHAR(120) NOT NULL DEFAULT 'Saved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(160),
  actor_avatar_url TEXT,
  content TEXT NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  topic VARCHAR(160),
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  max_participants INTEGER NOT NULL DEFAULT 500 CHECK (max_participants BETWEEN 2 AND 5000),
  listener_count INTEGER NOT NULL DEFAULT 0 CHECK (listener_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_space_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES voice_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'speaker', 'listener')),
  is_muted BOOLEAN NOT NULL DEFAULT TRUE,
  has_hand_raised BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS voice_space_active_participant_unique ON voice_space_participants(space_id, user_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS voice_space_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES voice_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uhoro_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  video_public_id TEXT,
  thumbnail_url TEXT,
  thumbnail_public_id TEXT,
  title VARCHAR(240),
  description TEXT,
  duration NUMERIC(12,3),
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  format VARCHAR(30),
  allows_comments BOOLEAN NOT NULL DEFAULT TRUE,
  allows_duets BOOLEAN NOT NULL DEFAULT TRUE,
  allows_stitches BOOLEAN NOT NULL DEFAULT TRUE,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  moderated_by UUID,
  moderated_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uhoro_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES uhoro_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES uhoro_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uhoro_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES uhoro_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, user_id)
);

CREATE TABLE IF NOT EXISTS uhoro_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES uhoro_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS uhoro_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES uhoro_videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  watch_duration NUMERIC(12,3) NOT NULL DEFAULT 0,
  watched_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uhoro_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  videos_count INTEGER NOT NULL DEFAULT 0,
  views_count BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uhoro_video_hashtags (
  video_id UUID NOT NULL REFERENCES uhoro_videos(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES uhoro_hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY(video_id, hashtag_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name VARCHAR(160),
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(80),
  media_public_id TEXT,
  media_size BIGINT,
  media_duration NUMERIC(12,3),
  thumbnail_url TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_delivery (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(message_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  socket_id TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('audio', 'video')),
  status VARCHAR(20) NOT NULL DEFAULT 'initiated',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  end_reason VARCHAR(80),
  quality_score NUMERIC(5,2),
  avg_bitrate NUMERIC(12,2),
  packet_loss NUMERIC(8,4),
  latency NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_participants (
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ,
  is_video_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_audio_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY(call_id, user_id)
);

CREATE INDEX IF NOT EXISTS posts_active_created_idx ON posts(created_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS posts_user_active_idx ON posts(user_id, created_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS follows_following_status_idx ON follows(following_id, status);
CREATE INDEX IF NOT EXISTS follows_follower_status_idx ON follows(follower_id, status);
CREATE INDEX IF NOT EXISTS comments_post_created_idx ON comments(post_id, created_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS voice_spaces_live_idx ON voice_spaces(started_at DESC) WHERE is_live;
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS uhoro_videos_feed_idx ON uhoro_videos(created_at DESC) WHERE is_active AND moderation_status = 'approved' AND NOT is_private;

CREATE OR REPLACE FUNCTION sync_social_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    UPDATE users SET posts_count = GREATEST(0, posts_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END) WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'follows' THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
      UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
      UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
      UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
      UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'likes' THEN
    IF COALESCE(NEW.post_id, OLD.post_id) IS NOT NULL THEN
      UPDATE posts SET likes_count = GREATEST(0, likes_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END) WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    ELSE
      UPDATE comments SET likes_count = GREATEST(0, likes_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END) WHERE id = COALESCE(NEW.comment_id, OLD.comment_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    UPDATE posts SET comments_count = GREATEST(0, comments_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END) WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    IF COALESCE(NEW.parent_id, OLD.parent_id) IS NOT NULL THEN
      UPDATE comments SET replies_count = GREATEST(0, replies_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END) WHERE id = COALESCE(NEW.parent_id, OLD.parent_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_sync_counts ON posts;
CREATE TRIGGER posts_sync_counts AFTER INSERT OR DELETE ON posts FOR EACH ROW EXECUTE FUNCTION sync_social_counts();
DROP TRIGGER IF EXISTS follows_sync_counts ON follows;
CREATE TRIGGER follows_sync_counts AFTER INSERT OR DELETE ON follows FOR EACH ROW EXECUTE FUNCTION sync_social_counts();
DROP TRIGGER IF EXISTS likes_sync_counts ON likes;
CREATE TRIGGER likes_sync_counts AFTER INSERT OR DELETE ON likes FOR EACH ROW EXECUTE FUNCTION sync_social_counts();
DROP TRIGGER IF EXISTS comments_sync_counts ON comments;
CREATE TRIGGER comments_sync_counts AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION sync_social_counts();
