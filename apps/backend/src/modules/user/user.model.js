// src/modules/user/user.model.js
const pool = require('../../config/db');

class UserModel {
  static async findOrCreateFromGoogle(googleUser) {
    const { sub, email, name, emailVerified } = googleUser;
    const existingResult = await pool.query(
      'SELECT * FROM users WHERE google_sub = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
      [sub, email]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      if (existing.google_sub && existing.google_sub !== sub) {
        throw new Error('This email is already linked to a different Google account');
      }
      const updated = await pool.query(
        `UPDATE users
         SET google_sub = $1,
             full_name = COALESCE($2, full_name),
             avatar_url = CASE WHEN avatar_key LIKE 'users/google-avatars/%' THEN NULL ELSE avatar_url END,
             avatar_key = CASE WHEN avatar_key LIKE 'users/google-avatars/%' THEN NULL ELSE avatar_key END,
             is_verified = is_verified OR $3,
             last_login = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [sub, name, emailVerified, existing.id]
      );
      return updated.rows[0];
    }

    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
    let username = baseUsername;
    let counter = 1;
    while (await this.usernameExists(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const result = await pool.query(
      `INSERT INTO users (google_sub, email, username, full_name, is_verified, last_login)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [sub, email, username, name, emailVerified]
    );
    return result.rows[0];
  }

  // Check if username exists
  static async usernameExists(username) {
    const result = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    return result.rows.length > 0;
  }

  // Get user by ID
  static async findById(id) {
    const result = await pool.query(
      `SELECT id, email, username, full_name, bio, avatar_url,
              cover_url, phone, gender, date_of_birth, country, is_verified,
              is_private, is_active, token_balance, total_earned, total_tips_sent,
              followers_count, following_count, posts_count, last_login, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // Get user by email
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  // Update user profile
  static async updateProfile(id, updates) {
    const allowedFields = [
      'username', 'full_name', 'bio', 'avatar_url', 'cover_url', 'phone',
      'gender', 'date_of_birth', 'country', 'location', 'website', 'is_private', 'is_creator',
      'avatar_key', 'cover_key'
    ];

    const setClause = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setClause.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE users
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Update token balance
  static async updateTokenBalance(id, amount, type = 'add') {
    const operation = type === 'add' ? '+' : '-';
    const query = `
      UPDATE users
      SET token_balance = token_balance ${operation} $1,
          ${type === 'add' ? 'total_earned' : 'total_tips_sent'} =
          ${type === 'add' ? 'total_earned' : 'total_tips_sent'} + $1
      WHERE id = $2 AND token_balance ${type === 'subtract' ? '>=' : '>='} $1
      RETURNING token_balance
    `;

    const result = await pool.query(query, [amount, id]);
    return result.rows[0];
  }

  // Search users
  static async search(query, limit = 20, offset = 0) {
    const searchQuery = `
      SELECT id, username, full_name, avatar_url, is_verified, followers_count
      FROM users
      WHERE
        username ILIKE $1 OR
        full_name ILIKE $1 OR
        email ILIKE $1
      ORDER BY
        CASE
          WHEN username ILIKE $2 THEN 1
          WHEN username ILIKE $1 THEN 2
          WHEN full_name ILIKE $1 THEN 3
          ELSE 4
        END,
        followers_count DESC
      LIMIT $3 OFFSET $4
    `;

    const exactMatch = query;
    const partialMatch = `%${query}%`;

    const result = await pool.query(searchQuery, [partialMatch, exactMatch, limit, offset]);
    return result.rows;
  }
    // Get user profile with stats
  static async getProfile(userId, currentUserId = null) {
    const query = `
      SELECT
        u.id, u.username, u.full_name, u.bio, u.avatar_url, u.cover_url,
        u.phone, u.gender, u.date_of_birth, u.country, u.is_verified,
        u.is_private, u.is_active, u.token_balance,
        u.followers_count, u.following_count, u.posts_count,
        u.created_at,

        -- Check if current user follows this user
        CASE
          WHEN $2 IS NOT NULL THEN
            EXISTS(
              SELECT 1 FROM follows
              WHERE follower_id = $2 AND following_id = u.id AND status = 'accepted'
            )
          ELSE false
        END as is_following,

        -- Check if follow request is pending
        CASE
          WHEN $2 IS NOT NULL AND u.is_private THEN
            EXISTS(
              SELECT 1 FROM follows
              WHERE follower_id = $2 AND following_id = u.id AND status = 'pending'
            )
          ELSE false
        END as follow_request_pending,

        -- Check if this user follows current user
        CASE
          WHEN $2 IS NOT NULL THEN
            EXISTS(
              SELECT 1 FROM follows
              WHERE follower_id = u.id AND following_id = $2 AND status = 'accepted'
            )
          ELSE false
        END as is_followed_by,

        -- Check if blocked
        CASE
          WHEN $2 IS NOT NULL THEN
            EXISTS(
              SELECT 1 FROM follows
              WHERE (
                (follower_id = $2 AND following_id = u.id) OR
                (follower_id = u.id AND following_id = $2)
              ) AND status = 'blocked'
            )
          ELSE false
        END as is_blocked

      FROM users u
      WHERE u.id = $1 AND u.is_active = true
    `;

    const result = await pool.query(query, [userId, currentUserId]);
    return result.rows[0];
  }

  // Get multiple user profiles (for feed, suggestions)
  static async getProfiles(userIds, currentUserId = null) {
    if (userIds.length === 0) return [];

    const query = `
      SELECT
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
        u.followers_count, u.following_count, u.posts_count,

        CASE
          WHEN $2 IS NOT NULL THEN
            EXISTS(
              SELECT 1 FROM follows
              WHERE follower_id = $2 AND following_id = u.id AND status = 'accepted'
            )
          ELSE false
        END as is_following

      FROM users u
      WHERE u.id = ANY($1::uuid[]) AND u.is_active = true
    `;

    const result = await pool.query(query, [userIds, currentUserId]);
    return result.rows;
  }

  // Get user suggestions
  static async getSuggestions(currentUserId, limit = 20) {
    const query = `
      WITH suggested_users AS (
        SELECT
          u.id, u.username, u.full_name, u.bio, u.avatar_url, u.cover_url, u.is_verified, u.is_creator,
          u.followers_count,

          -- Score based on followers and mutual follows
          (
            u.followers_count * 0.7 +
            COALESCE((
              SELECT COUNT(*) * 0.3
              FROM follows f1
              WHERE f1.following_id = u.id
              AND f1.follower_id IN (
                SELECT following_id
                FROM follows
                WHERE follower_id = $1 AND status = 'accepted'
              )
            ), 0)
          ) as relevance_score

        FROM users u
        WHERE u.id != $1
          AND u.is_active = true
          AND u.is_private = false
          AND NOT EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = $1 AND following_id = u.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = u.id AND following_id = $1 AND status = 'blocked'
          )
        ORDER BY relevance_score DESC, u.followers_count DESC
        LIMIT $2
      )
      SELECT
        su.*,
        EXISTS(
          SELECT 1 FROM follows f
          WHERE f.follower_id = su.id
          AND f.following_id = $1
          AND f.status = 'accepted'
        ) as follows_you
      FROM suggested_users su
    `;

    const result = await pool.query(query, [currentUserId, limit]);
    return result.rows;
  }

  // Search users with filters
  static async search(filters, limit = 20, offset = 0) {
    const { query, isVerified, country } = filters;

    let sqlQuery = `
      SELECT
        id, username, full_name, avatar_url, is_verified,
        followers_count, bio, country
      FROM users
      WHERE is_active = true
    `;

    const values = [];
    let paramIndex = 1;

    if (query) {
      sqlQuery += ` AND (
        username ILIKE $${paramIndex} OR
        full_name ILIKE $${paramIndex} OR
        bio ILIKE $${paramIndex}
      )`;
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (isVerified !== undefined) {
      sqlQuery += ` AND is_verified = $${paramIndex}`;
      values.push(isVerified);
      paramIndex++;
    }

    if (country) {
      sqlQuery += ` AND country ILIKE $${paramIndex}`;
      values.push(`%${country}%`);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY followers_count DESC, username ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await pool.query(sqlQuery, values);
    return result.rows;
  }

  // Update privacy settings
  static async updatePrivacy(userId, isPrivate) {
    const query = `
      UPDATE users
      SET is_private = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING is_private
    `;

    const result = await pool.query(query, [isPrivate, userId]);
    return result.rows[0];
  }

  // Get mutual followers
  static async getMutualFollowers(userId1, userId2, limit = 50) {
    const query = `
      SELECT
        u.id, u.username, u.full_name, u.avatar_url, u.is_verified
      FROM users u
      WHERE u.id IN (
        SELECT f1.follower_id
        FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.follower_id
        WHERE f1.following_id = $1
          AND f2.following_id = $2
          AND f1.status = 'accepted'
          AND f2.status = 'accepted'
      )
      LIMIT $3
    `;

    const result = await pool.query(query, [userId1, userId2, limit]);
    return result.rows;
  }

  // Get follow statistics
  static async getFollowStats(userId) {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND status = 'accepted') as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND status = 'accepted') as following_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND status = 'pending') as pending_requests,
        (SELECT json_agg(json_build_object(
          'date', date,
          'count', count
        )) FROM (
          SELECT
            DATE(created_at) as date,
            COUNT(*) as count
          FROM follows
          WHERE following_id = $1 AND status = 'accepted'
          AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        ) as daily_stats) as follower_growth
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }
}

module.exports = UserModel;