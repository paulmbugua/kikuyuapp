// src/modules/feed/feed.model.js
const pool = require('../../config/db');

class FeedModel {
  // Get feed for user - shows own posts, followed users, and other public posts
  static async getFeed(userId, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified, u.is_private,
        
        -- Check if user liked this post
        EXISTS(
          SELECT 1 FROM likes 
          WHERE user_id = $1::UUID AND post_id = p.id
        ) as is_liked,
        
        -- Check if user bookmarked this post
        EXISTS(
          SELECT 1 FROM bookmarks 
          WHERE user_id = $1::UUID AND post_id = p.id
        ) as is_bookmarked,
        
        -- Check if the user follows this post's author
        EXISTS(
          SELECT 1 FROM follows 
          WHERE follower_id = $1::UUID AND following_id = p.user_id AND status = 'accepted'
        ) as is_following_author,
        
        -- Priority: 1 = Following, 2 = Own posts, 3 = Others
        CASE 
          WHEN EXISTS(
            SELECT 1 FROM follows 
            WHERE follower_id = $1::UUID AND following_id = p.user_id AND status = 'accepted'
          ) THEN 1
          WHEN p.user_id = $1::UUID THEN 2
          ELSE 3
        END as priority
        
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.is_active = true 
        AND u.is_active = true
        -- Show public posts from users who are not private
        AND (
          p.user_id = $1::UUID  -- Your own posts
          OR EXISTS(
            SELECT 1 FROM follows 
            WHERE follower_id = $1::UUID AND following_id = p.user_id AND status = 'accepted'
          )  -- Posts from users you follow
          OR (u.is_private = false)  -- Posts from public users you don't follow
        )
        -- Exclude blocked users
        AND NOT EXISTS (
          SELECT 1 FROM follows 
          WHERE (follower_id = p.user_id AND following_id = $1::UUID AND status = 'blocked')
             OR (follower_id = $1::UUID AND following_id = p.user_id AND status = 'blocked')
        )
      ORDER BY priority ASC, p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Get feed for anonymous user (no login)
  static async getPublicFeed(limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified,
        false as is_liked,
        false as is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.is_active = true 
        AND u.is_active = true
        AND u.is_private = false
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Get recommended posts (based on interests)
  static async getRecommendedPosts(userId, limit = 20) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified,
        EXISTS(
          SELECT 1 FROM likes WHERE user_id = $1::UUID AND post_id = p.id
        ) as is_liked,
        -- Engagement score for recommendation
        (p.likes_count * 2 + p.comments_count * 3) as engagement_score
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.is_active = true 
        AND u.is_active = true
        AND u.is_private = false
        AND p.user_id != $1::UUID
        AND NOT EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = $1::UUID AND following_id = p.user_id
        )
        AND p.created_at > NOW() - INTERVAL '30 days'
      ORDER BY engagement_score DESC, p.created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Get feed from followed users only
  static async getFollowingFeed(userId, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified,
        EXISTS(
          SELECT 1 FROM likes WHERE user_id = $1::UUID AND post_id = p.id
        ) as is_liked,
        EXISTS(
          SELECT 1 FROM bookmarks WHERE user_id = $1::UUID AND post_id = p.id
        ) as is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.is_active = true 
        AND u.is_active = true
        AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = $1::UUID AND following_id = p.user_id AND status = 'accepted'
        )
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Get trending posts (most engaged from last 7 days)
  static async getTrendingPosts(limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified,
        false as is_liked,
        false as is_bookmarked,
        (p.likes_count * 2 + p.comments_count * 3) as engagement_score
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.is_active = true 
        AND u.is_active = true
        AND u.is_private = false
        AND p.created_at > NOW() - INTERVAL '7 days'
      ORDER BY engagement_score DESC, p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Get latest posts
  static async getLatestPosts(limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified,
        false as is_liked,
        false as is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.is_active = true 
        AND u.is_active = true
        AND u.is_private = false
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Get posts by hashtag
  static async getPostsByHashtag(hashtag, userId = null, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.user_id, p.likes_count, p.comments_count,
        u.username, u.full_name, u.avatar_url, u.is_verified,
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes WHERE user_id = $2::UUID AND post_id = p.id)
          ELSE false
        END as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN post_hashtags ph ON p.id = ph.post_id
      JOIN hashtags h ON ph.hashtag_id = h.id
      WHERE 
        h.name = LOWER($1)
        AND p.is_active = true
        AND u.is_active = true
        AND u.is_private = false
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [hashtag, userId, limit, offset]);
    return result.rows;
  }
}

module.exports = FeedModel;