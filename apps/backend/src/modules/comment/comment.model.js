// src/modules/comment/comment.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class CommentModel {
  // Create a comment
  static async create(postId, userId, content, parentId = null) {
    // Check if post exists and is active
    const postCheck = await pool.query(
      'SELECT id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );
    
    if (postCheck.rows.length === 0) {
      throw new AppError('Post not found', 404);
    }
    
    // If parentId is provided, check if it exists and belongs to the same post
    if (parentId) {
      const parentCheck = await pool.query(
        'SELECT id FROM comments WHERE id = $1 AND post_id = $2 AND is_active = true',
        [parentId, postId]
      );
      
      if (parentCheck.rows.length === 0) {
        throw new AppError('Parent comment not found', 404);
      }
    }
    
    const query = `
      INSERT INTO comments (post_id, user_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [postId, userId, content, parentId]);
    const comment = result.rows[0];
    
    // Get full comment with user details
    return this.findById(comment.id, userId);
  }

  // Get comment by ID
  static async findById(commentId, currentUserId = null) {
    const query = `
      SELECT 
        c.id, c.content, c.created_at, c.updated_at,
        c.likes_count, c.replies_count, c.is_edited,
        c.parent_id, c.post_id,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        CASE 
          WHEN $2 IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes WHERE user_id = $2 AND comment_id = c.id)
          ELSE false
        END as is_liked
        
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1 AND c.is_active = true
    `;
    
    const result = await pool.query(query, [commentId, currentUserId]);
    return result.rows[0];
  }

  // Get comments for a post (top-level comments only)
// Get comments for a post (top-level comments only)
static async getPostComments(postId, currentUserId = null, limit = 50, offset = 0) {
  // Fix: Cast currentUserId to UUID or NULL properly
  const userIdParam = currentUserId || null;
  
  const query = `
    SELECT 
      c.id, c.content, c.created_at,
      c.likes_count, c.replies_count,
      
      u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
      
      CASE 
        WHEN $2::UUID IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM likes WHERE user_id = $2::UUID AND comment_id = c.id)
        ELSE false
      END as is_liked
      
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE 
      c.post_id = $1 
      AND c.parent_id IS NULL
      AND c.is_active = true
    ORDER BY c.likes_count DESC, c.created_at DESC
    LIMIT $3 OFFSET $4
  `;
  
  const result = await pool.query(query, [postId, userIdParam, limit, offset]);
  return result.rows;
}

// Get replies to a comment
static async getReplies(commentId, currentUserId = null, limit = 50, offset = 0) {
  const userIdParam = currentUserId || null;
  
  const query = `
    SELECT 
      c.id, c.content, c.created_at,
      c.likes_count,
      
      u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
      
      CASE 
        WHEN $2::UUID IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM likes WHERE user_id = $2::UUID AND comment_id = c.id)
        ELSE false
      END as is_liked
      
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE 
      c.parent_id = $1 
      AND c.is_active = true
    ORDER BY c.created_at ASC
    LIMIT $3 OFFSET $4
  `;
  
  const result = await pool.query(query, [commentId, userIdParam, limit, offset]);
  return result.rows;
}

// Get comment by ID
static async findById(commentId, currentUserId = null) {
  const userIdParam = currentUserId || null;
  
  const query = `
    SELECT 
      c.id, c.content, c.created_at, c.updated_at,
      c.likes_count, c.replies_count, c.is_edited,
      c.parent_id, c.post_id,
      
      u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
      
      CASE 
        WHEN $2::UUID IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM likes WHERE user_id = $2::UUID AND comment_id = c.id)
        ELSE false
      END as is_liked
      
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = $1 AND c.is_active = true
  `;
  
  const result = await pool.query(query, [commentId, userIdParam]);
  return result.rows[0];
}

  // Get replies to a comment
  static async getReplies(commentId, currentUserId = null, limit = 50, offset = 0) {
    const query = `
      SELECT 
        c.id, c.content, c.created_at,
        c.likes_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        CASE 
          WHEN $2 IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes WHERE user_id = $2 AND comment_id = c.id)
          ELSE false
        END as is_liked
        
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE 
        c.parent_id = $1 
        AND c.is_active = true
      ORDER BY c.created_at ASC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [commentId, currentUserId, limit, offset]);
    return result.rows;
  }

  // Update comment
  static async update(commentId, userId, content) {
    // Check if comment exists and user owns it
    const comment = await this.findById(commentId);
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }
    
    if (comment.user_id !== userId) {
      throw new AppError('You can only edit your own comments', 403);
    }
    
    const query = `
      UPDATE comments 
      SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `;
    
    await pool.query(query, [content, commentId, userId]);
    
    return this.findById(commentId, userId);
  }

  // Delete comment (soft delete)
  static async delete(commentId, userId) {
    const query = `
      UPDATE comments 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [commentId, userId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Comment not found or you do not have permission to delete it', 404);
    }
    
    return result.rows[0];
  }

  // Get comment thread (comment + its replies)
  static async getThread(commentId, currentUserId = null) {
    const comment = await this.findById(commentId, currentUserId);
    
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }
    
    const replies = await this.getReplies(commentId, currentUserId, 100);
    
    return {
      ...comment,
      replies
    };
  }
}

module.exports = CommentModel;