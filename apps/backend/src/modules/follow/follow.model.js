// src/modules/follow/follow.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class FollowModel {
  // Follow a user
  static async follow(followerId, followingId) {
    // Check if trying to follow self
    if (followerId === followingId) {
      throw new AppError('You cannot follow yourself', 400);
    }

    // Check if user exists and get privacy setting
    const userResult = await pool.query(
      'SELECT is_private, is_active FROM users WHERE id = $1',
      [followingId]
    );
    
    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const targetUser = userResult.rows[0];
    
    if (!targetUser.is_active) {
      throw new AppError('User account is inactive', 400);
    }

    // Check existing follow relationship
    const existingResult = await pool.query(
      'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      
      if (existing.status === 'blocked') {
        throw new AppError('Cannot follow this user', 403);
      }
      
      if (existing.status === 'pending') {
        throw new AppError('Follow request already pending', 400);
      }
      
      if (existing.status === 'accepted') {
        throw new AppError('Already following this user', 400);
      }
    }

    // Determine follow status based on privacy
    const status = targetUser.is_private ? 'pending' : 'accepted';

    // Create or update follow relationship
    const query = `
      INSERT INTO follows (follower_id, following_id, status)
      VALUES ($1::UUID, $2::UUID, $3)
      ON CONFLICT (follower_id, following_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, [followerId, followingId, status]);
    
    // If accepted, create notification
    if (status === 'accepted') {
      await this.createFollowNotification(followerId, followingId);
    }

    return {
      follow: result.rows[0],
      requiresApproval: status === 'pending'
    };
  }

  // Unfollow a user
  static async unfollow(followerId, followingId) {
    const query = `
      DELETE FROM follows 
      WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'accepted'
      RETURNING *
    `;
    
    const result = await pool.query(query, [followerId, followingId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Not following this user', 400);
    }
    
    return result.rows[0];
  }

  // Accept follow request (for private accounts)
  static async acceptRequest(followerId, followingId) {
    const query = `
      UPDATE follows 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'pending'
      RETURNING *
    `;
    
    const result = await pool.query(query, [followerId, followingId]);
    
    if (result.rows.length === 0) {
      throw new AppError('No pending follow request found', 404);
    }

    // Create notification
    await this.createFollowNotification(followerId, followingId);
    
    return result.rows[0];
  }

  // Reject follow request
  static async rejectRequest(followerId, followingId) {
    const query = `
      DELETE FROM follows 
      WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'pending'
      RETURNING *
    `;
    
    const result = await pool.query(query, [followerId, followingId]);
    
    if (result.rows.length === 0) {
      throw new AppError('No pending follow request found', 404);
    }
    
    return result.rows[0];
  }

  // Block user
  static async blockUser(blockerId, blockedId) {
    // Remove any existing follow relationship
    await pool.query(
      `DELETE FROM follows 
       WHERE (follower_id = $1::UUID AND following_id = $2::UUID) 
          OR (follower_id = $2::UUID AND following_id = $1::UUID)`,
      [blockerId, blockedId]
    );

    // Create block record
    const query = `
      INSERT INTO follows (follower_id, following_id, status)
      VALUES ($1::UUID, $2::UUID, 'blocked')
      RETURNING *
    `;
    
    const result = await pool.query(query, [blockerId, blockedId]);
    return result.rows[0];
  }

  // Unblock user
  static async unblockUser(blockerId, blockedId) {
    const query = `
      DELETE FROM follows 
      WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'blocked'
      RETURNING *
    `;
    
    const result = await pool.query(query, [blockerId, blockedId]);
    
    if (result.rows.length === 0) {
      throw new AppError('User not blocked', 400);
    }
    
    return result.rows[0];
  }

  // Get followers list - FIXED with UUID casting and proper NULL handling
  static async getFollowers(userId, currentUserId = null, limit = 50, offset = 0) {
    const query = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        f.created_at as followed_at,
        
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(
              SELECT 1 FROM follows 
              WHERE follower_id = $2::UUID AND following_id = u.id AND status = 'accepted'
            )
          ELSE false
        END as is_following,
        
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(
              SELECT 1 FROM follows 
              WHERE follower_id = u.id AND following_id = $2::UUID AND status = 'accepted'
            )
          ELSE false
        END as follows_you
        
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1::UUID AND f.status = 'accepted'
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [userId, currentUserId, limit, offset]);
    return result.rows;
  }

  // Get following list - FIXED with UUID casting and proper NULL handling
  static async getFollowing(userId, currentUserId = null, limit = 50, offset = 0) {
    const query = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        f.created_at as followed_at,
        
        CASE 
          WHEN $2::UUID IS NOT NULL THEN 
            EXISTS(
              SELECT 1 FROM follows 
              WHERE follower_id = $2::UUID AND following_id = u.id AND status = 'accepted'
            )
          ELSE false
        END as is_following
        
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1::UUID AND f.status = 'accepted'
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [userId, currentUserId, limit, offset]);
    return result.rows;
  }

  // Get pending follow requests (for private accounts)
  static async getPendingRequests(userId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        f.created_at as requested_at
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1::UUID AND f.status = 'pending'
      ORDER BY f.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Check if following
  static async isFollowing(followerId, followingId) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'accepted'
      ) as is_following
    `;
    
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows[0].is_following;
  }

  // Get follow suggestions based on mutual follows
  static async getSuggestions(userId, limit = 20) {
    const query = `
      WITH mutual_follows AS (
        SELECT DISTINCT f2.following_id
        FROM follows f1
        JOIN follows f2 ON f1.following_id = f2.follower_id
        WHERE f1.follower_id = $1::UUID
          AND f1.status = 'accepted'
          AND f2.status = 'accepted'
          AND f2.following_id != $1::UUID
          AND NOT EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = $1::UUID AND following_id = f2.following_id
          )
      )
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        u.followers_count,
        COUNT(mf.following_id) as mutual_count
      FROM mutual_follows mf
      JOIN users u ON mf.following_id = u.id
      WHERE u.is_active = true AND u.is_private = false
      GROUP BY u.id
      ORDER BY mutual_count DESC, u.followers_count DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Create follow notification (placeholder)
  static async createFollowNotification(followerId, followingId) {
    // Will be implemented when we add notifications module
    return true;
  }

  // Get followers count
  static async getFollowersCount(userId) {
    const result = await pool.query(
      "SELECT COUNT(*) FROM follows WHERE following_id = $1::UUID AND status = 'accepted'",
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  // Get following count
  static async getFollowingCount(userId) {
    const result = await pool.query(
      "SELECT COUNT(*) FROM follows WHERE follower_id = $1::UUID AND status = 'accepted'",
      [userId]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = FollowModel;