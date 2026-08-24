// src/modules/post/post.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const { extractHashtags, extractMentions } = require('../../utils/contentModeration');

class PostModel {
  // Create a new post
  static async create(userId, postData, mediaData = null) {
    const { content } = postData;
    
    try {
      // Start transaction
      await pool.query('BEGIN');
      
      // Insert post
      const query = `
        INSERT INTO posts (
          user_id, content, media_url, media_type, media_public_id,
          media_width, media_height, media_duration, media_provider
        )
        VALUES ($1::UUID, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        userId,
        content || null,
        mediaData?.url || null,
        mediaData?.resourceType || null,
        mediaData?.publicId || null,
        mediaData?.width || null,
        mediaData?.height || null,
        mediaData?.duration || null,
        mediaData?.provider || (mediaData ? 'cloudinary' : null)
      ];
      
      const result = await pool.query(query, values);
      const post = result.rows[0];
      
      // Process hashtags if content exists
      if (content) {
        const hashtags = extractHashtags(content);
        if (hashtags.length > 0) {
          for (const tag of hashtags) {
            // Insert or update hashtag
            const hashtagResult = await pool.query(
              `INSERT INTO hashtags (name, posts_count, last_used_at)
               VALUES ($1, 1, CURRENT_TIMESTAMP)
               ON CONFLICT (name) 
               DO UPDATE SET 
                 posts_count = hashtags.posts_count + 1,
                 last_used_at = CURRENT_TIMESTAMP
               RETURNING id`,
              [tag.toLowerCase()]
            );
            
            const hashtagId = hashtagResult.rows[0].id;
            
            // Link post to hashtag
            await pool.query(
              `INSERT INTO post_hashtags (post_id, hashtag_id)
               VALUES ($1::UUID, $2::UUID)
               ON CONFLICT DO NOTHING`,
              [post.id, hashtagId]
            );
          }
        }
        
        // Process mentions
        const mentions = extractMentions(content);
        if (mentions.length > 0) {
          for (const username of mentions) {
            // Find user by username
            const userResult = await pool.query(
              'SELECT id FROM users WHERE username = $1 AND is_active = true',
              [username]
            );
            
            if (userResult.rows.length > 0) {
              const mentionedUserId = userResult.rows[0].id;
              
              // Create mention record
              await pool.query(
                `INSERT INTO mentions (post_id, user_id)
                 VALUES ($1::UUID, $2::UUID)
                 ON CONFLICT DO NOTHING`,
                [post.id, mentionedUserId]
              );
            }
          }
        }
      }
      
      await pool.query('COMMIT');
      
      // Get full post with user details
      return this.findById(post.id, userId);
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  // Get post by ID
  static async findById(postId, currentUserId = null) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.media_width,
        p.media_height, p.media_duration, p.media_public_id, p.media_provider, p.created_at, p.updated_at,
        p.likes_count, p.comments_count, p.shares_count, p.bookmarks_count,
        p.is_edited, p.is_pinned,
        
        -- User details
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        -- Interaction status
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes WHERE user_id = $2::UUID AND post_id = p.id)
          ELSE false
        END as is_liked,
        
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $2::UUID AND post_id = p.id)
          ELSE false
        END as is_bookmarked,
        
        -- Check if user is following the post author
        CASE 
          WHEN $2::UUID IS NOT NULL AND $2::UUID != u.id THEN
            EXISTS(
              SELECT 1 FROM follows 
              WHERE follower_id = $2::UUID AND following_id = u.id AND status = 'accepted'
            )
          ELSE false
        END as is_following_author
        
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1::UUID AND p.is_active = true
    `;
    
    const result = await pool.query(query, [postId, currentUserId]);
    return result.rows[0];
  }

  // Get posts by user
  static async findByUser(userId, currentUserId = null, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.likes_count, p.comments_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes WHERE user_id = $2::UUID AND post_id = p.id)
          ELSE false
        END as is_liked,
        
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $2::UUID AND post_id = p.id)
          ELSE false
        END as is_bookmarked
        
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1::UUID AND p.is_active = true
      ORDER BY 
        CASE WHEN p.is_pinned THEN 0 ELSE 1 END,
        p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [userId, currentUserId, limit, offset]);
    return result.rows;
  }

  // Update post
  static async update(postId, userId, updates) {
    const { content } = updates;
    
    // Check if post exists and user owns it
    const post = await this.findById(postId);
    if (!post) {
      throw new AppError('Post not found', 404);
    }
    
    if (post.user_id !== userId) {
      throw new AppError('You can only edit your own posts', 403);
    }
    
    const query = `
      UPDATE posts 
      SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2::UUID AND user_id = $3::UUID
      RETURNING *
    `;
    
    const result = await pool.query(query, [content, postId, userId]);
    
    return this.findById(postId, userId);
  }

  // Delete post (soft delete)
  static async delete(postId, userId) {
    const query = `
      UPDATE posts 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::UUID AND user_id = $2::UUID
      RETURNING id
    `;
    
    const result = await pool.query(query, [postId, userId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Post not found or you do not have permission to delete it', 404);
    }
    
    return result.rows[0];
  }

  // Get feed for user
  static async getFeed(userId, limit = 20, offset = 0) {
    const query = `
      WITH following_ids AS (
        SELECT following_id
        FROM follows
        WHERE follower_id = $1::UUID AND status = 'accepted'
      )
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.likes_count, p.comments_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
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
        AND (
          p.user_id IN (SELECT following_id FROM following_ids)
          OR p.user_id = $1::UUID
        )
        AND NOT EXISTS (
          SELECT 1 FROM follows 
          WHERE (follower_id = p.user_id AND following_id = $1::UUID AND status = 'blocked')
             OR (follower_id = $1::UUID AND following_id = p.user_id AND status = 'blocked')
        )
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Get posts by hashtag
  static async findByHashtag(hashtag, currentUserId = null, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.likes_count, p.comments_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
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
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [hashtag, currentUserId, limit, offset]);
    return result.rows;
  }

  // Get trending hashtags
  static async getTrendingHashtags(limit = 10) {
    const query = `
      SELECT 
        name,
        posts_count,
        EXTRACT(epoch FROM (NOW() - last_used_at)) / 3600 as hours_since_last_used
      FROM hashtags
      WHERE posts_count > 0
      ORDER BY posts_count DESC, last_used_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get popular posts (for explore page)
  static async getPopularPosts(limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.likes_count, p.comments_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        -- Calculate engagement score
        (p.likes_count * 2 + p.comments_count * 3 + p.shares_count * 4) as engagement_score
        
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

  // Pin/unpin post
  static async togglePin(postId, userId) {
    // First, unpin any existing pinned post
    await pool.query(
      'UPDATE posts SET is_pinned = false WHERE user_id = $1::UUID AND is_pinned = true',
      [userId]
    );
    
    // Pin the selected post
    const query = `
      UPDATE posts 
      SET is_pinned = true 
      WHERE id = $1::UUID AND user_id = $2::UUID
      RETURNING id
    `;
    
    const result = await pool.query(query, [postId, userId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Post not found', 404);
    }
    
    return result.rows[0];
  }
}

module.exports = PostModel;