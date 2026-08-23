// src/modules/like/like.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class LikeModel {
  // Like a post
  static async likePost(userId, postId) {
    // Check if post exists and is active
    const postCheck = await pool.query(
      'SELECT id, user_id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );
    
    if (postCheck.rows.length === 0) {
      throw new AppError('Post not found', 404);
    }
    
    const post = postCheck.rows[0];
    
    // Check if already liked
    const existingLike = await pool.query(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    
    if (existingLike.rows.length > 0) {
      throw new AppError('Post already liked', 400);
    }
    
    // Create like
    const query = `
      INSERT INTO likes (user_id, post_id)
      VALUES ($1, $2)
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, postId]);
    
    // Will create notification later (Step 7)
    if (post.user_id !== userId) {
      // await NotificationModel.create(...)
    }
    
    return {
      liked: true,
      likeId: result.rows[0].id
    };
  }

  // Like a comment
  static async likeComment(userId, commentId) {
    // Check if comment exists and is active
    const commentCheck = await pool.query(
      'SELECT id, user_id FROM comments WHERE id = $1 AND is_active = true',
      [commentId]
    );
    
    if (commentCheck.rows.length === 0) {
      throw new AppError('Comment not found', 404);
    }
    
    const comment = commentCheck.rows[0];
    
    // Check if already liked
    const existingLike = await pool.query(
      'SELECT id FROM likes WHERE user_id = $1 AND comment_id = $2',
      [userId, commentId]
    );
    
    if (existingLike.rows.length > 0) {
      throw new AppError('Comment already liked', 400);
    }
    
    // Create like
    const query = `
      INSERT INTO likes (user_id, comment_id)
      VALUES ($1, $2)
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, commentId]);
    
    // Will create notification later (Step 7)
    if (comment.user_id !== userId) {
      // await NotificationModel.create(...)
    }
    
    return {
      liked: true,
      likeId: result.rows[0].id
    };
  }

  // Unlike a post
  static async unlikePost(userId, postId) {
    const query = `
      DELETE FROM likes 
      WHERE user_id = $1 AND post_id = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, postId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Like not found', 404);
    }
    
    return { unliked: true };
  }

  // Unlike a comment
  static async unlikeComment(userId, commentId) {
    const query = `
      DELETE FROM likes 
      WHERE user_id = $1 AND comment_id = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, commentId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Like not found', 404);
    }
    
    return { unliked: true };
  }

  // Get users who liked a post
  static async getPostLikers(postId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        l.created_at as liked_at
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.post_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [postId, limit, offset]);
    return result.rows;
  }

  // Get users who liked a comment
  static async getCommentLikers(commentId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        l.created_at as liked_at
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.comment_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [commentId, limit, offset]);
    return result.rows;
  }

  // Check if user liked a post
  static async hasUserLikedPost(userId, postId) {
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2) as liked',
      [userId, postId]
    );
    
    return result.rows[0].liked;
  }

  // Check if user liked a comment
  static async hasUserLikedComment(userId, commentId) {
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND comment_id = $2) as liked',
      [userId, commentId]
    );
    
    return result.rows[0].liked;
  }

  // Get user's liked posts
  static async getUserLikedPosts(userId, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.likes_count, p.comments_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        true as is_liked
        
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE l.user_id = $1 AND p.is_active = true
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }
}

module.exports = LikeModel;