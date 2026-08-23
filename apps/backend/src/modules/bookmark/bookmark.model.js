// src/modules/bookmark/bookmark.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class BookmarkModel {
  // Bookmark a post
  static async create(userId, postId, collectionName = 'Saved') {
    // Check if post exists and is active
    const postCheck = await pool.query(
      'SELECT id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );
    
    if (postCheck.rows.length === 0) {
      throw new AppError('Post not found', 404);
    }
    
    // Check if already bookmarked
    const existing = await pool.query(
      'SELECT id FROM bookmarks WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    
    if (existing.rows.length > 0) {
      throw new AppError('Post already bookmarked', 400);
    }
    
    // Create bookmark
    const query = `
      INSERT INTO bookmarks (user_id, post_id, collection_name)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, postId, collectionName]);
    
    // Update post bookmarks count
    await pool.query(
      'UPDATE posts SET bookmarks_count = bookmarks_count + 1 WHERE id = $1',
      [postId]
    );
    
    return {
      bookmarked: true,
      bookmarkId: result.rows[0].id
    };
  }

  // Remove bookmark
  static async delete(userId, postId) {
    const query = `
      DELETE FROM bookmarks 
      WHERE user_id = $1 AND post_id = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, postId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Bookmark not found', 404);
    }
    
    // Update post bookmarks count
    await pool.query(
      'UPDATE posts SET bookmarks_count = bookmarks_count - 1 WHERE id = $1',
      [postId]
    );
    
    return { unbookmarked: true };
  }

  // Get user's bookmarks
  static async getUserBookmarks(userId, collectionName = null, limit = 20, offset = 0) {
    let query = `
      SELECT 
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        p.likes_count, p.comments_count,
        
        u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
        
        b.collection_name, b.created_at as bookmarked_at,
        
        EXISTS(
          SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id
        ) as is_liked
        
      FROM bookmarks b
      JOIN posts p ON b.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE b.user_id = $1
    `;
    
    const values = [userId];
    let paramIndex = 2;
    
    if (collectionName) {
      query += ` AND b.collection_name = $${paramIndex}`;
      values.push(collectionName);
      paramIndex++;
    }
    
    query += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  // Get bookmark collections
  static async getCollections(userId) {
    const query = `
      SELECT 
        collection_name,
        COUNT(*) as post_count,
        MAX(created_at) as last_saved_at
      FROM bookmarks
      WHERE user_id = $1
      GROUP BY collection_name
      ORDER BY last_saved_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Move bookmark to different collection
  static async moveToCollection(userId, postId, newCollectionName) {
    const query = `
      UPDATE bookmarks 
      SET collection_name = $1
      WHERE user_id = $2 AND post_id = $3
      RETURNING id
    `;
    
    const result = await pool.query(query, [newCollectionName, userId, postId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Bookmark not found', 404);
    }
    
    return { moved: true };
  }

  // Check if post is bookmarked by user
  static async isBookmarked(userId, postId) {
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $1 AND post_id = $2) as bookmarked',
      [userId, postId]
    );
    
    return result.rows[0].bookmarked;
  }
}

module.exports = BookmarkModel;