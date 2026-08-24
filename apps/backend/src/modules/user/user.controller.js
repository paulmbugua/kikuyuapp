// src/modules/user/user.controller.js
const UserModel = require('./user.model');
const FollowModel = require('../follow/follow.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { uploadImage, deleteImage } = require('../../config/r2');
const pool = require('../../config/db');

// Get current authenticated user - FIXED with proper UUID casting
const getCurrentUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const result = await pool.query(
    `SELECT 
      u.id, u.username, u.email, u.full_name, u.bio, 
      u.avatar_url, 
      COALESCE(u.cover_url, '') as cover_url,
      COALESCE(u.is_verified, false) as is_verified,
      COALESCE(u.is_private, false) as is_private,
      COALESCE(u.is_creator, false) as is_creator,
      u.is_active,
      COALESCE(u.token_balance, 0) as token_balance,
      u.created_at, u.updated_at,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id AND status = 'accepted') as followers_count,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id AND status = 'accepted') as following_count,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND is_active = true) as posts_count
     FROM users u
     WHERE u.id = $1::UUID AND u.is_active = true`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }
  
  const user = result.rows[0];
  
  if (user.is_creator) {
    try {
      const earningsResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM earnings
         WHERE user_id = $1::UUID 
         AND earned_at >= date_trunc('month', CURRENT_DATE)
         AND earned_at < date_trunc('month', CURRENT_DATE + interval '1 month')`,
        [userId]
      );
      user.monthly_earnings = parseFloat(earningsResult.rows[0].total);
    } catch (err) {
      user.monthly_earnings = 0;
    }
  }
  
  ResponseHandler.success(res, { user });
});

// Get user profile - FIXED with proper UUID casting in subqueries
const getUserProfile = catchAsync(async (req, res) => {
  const { username } = req.params;
  const currentUserId = req.user?.id;

  const userResult = await pool.query(
    `SELECT 
      u.id, u.username, u.email, u.full_name, u.bio, 
      u.avatar_url, 
      COALESCE(u.cover_url, '') as cover_url,
      COALESCE(u.is_verified, false) as is_verified,
      COALESCE(u.is_private, false) as is_private,
      COALESCE(u.is_creator, false) as is_creator,
      u.is_active,
      COALESCE(u.token_balance, 0) as token_balance,
      u.created_at, u.updated_at,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id AND status = 'accepted') as followers_count,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id AND status = 'accepted') as following_count,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND is_active = true) as posts_count
     FROM users u
     WHERE u.username = $1 AND u.is_active = true`,
    [username]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = userResult.rows[0];

  if (currentUserId && currentUserId !== user.id) {
    const followResult = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'accepted'
      ) as is_following`,
      [currentUserId, user.id]
    );
    user.is_following = followResult.rows[0].is_following;
  } else {
    user.is_following = false;
  }

  if (currentUserId && currentUserId !== user.id) {
    const followedByResult = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'accepted'
      ) as is_followed_by`,
      [user.id, currentUserId]
    );
    user.is_followed_by = followedByResult.rows[0].is_followed_by;
  } else {
    user.is_followed_by = false;
  }

  if (currentUserId && currentUserId !== user.id && user.is_private) {
    const pendingResult = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'pending'
      ) as request_pending`,
      [currentUserId, user.id]
    );
    user.follow_request_pending = pendingResult.rows[0].request_pending;
  }

  if (user.is_creator) {
    try {
      const earningsResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM earnings
         WHERE user_id = $1::UUID 
         AND earned_at >= date_trunc('month', CURRENT_DATE)
         AND earned_at < date_trunc('month', CURRENT_DATE + interval '1 month')`,
        [user.id]
      );
      user.monthly_earnings = parseFloat(earningsResult.rows[0].total);
    } catch (err) {
      user.monthly_earnings = 0;
    }
  }

  if (user.is_private && !user.is_following && !user.is_followed_by && currentUserId !== user.id) {
    const limitedProfile = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_private: true,
      is_following: user.is_following,
      follow_request_pending: user.follow_request_pending,
      bio: null,
      posts_count: 0,
      followers_count: user.followers_count,
      following_count: user.following_count
    };
    
    return ResponseHandler.success(res, { profile: limitedProfile });
  }

  ResponseHandler.success(res, { profile: user });
});

// Update user profile
const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updates = req.body;

  delete updates.id;
  delete updates.email;
  delete updates.token_balance;
  delete updates.followers_count;
  delete updates.following_count;
  delete updates.posts_count;
  delete updates.is_verified;
  delete updates.is_active;

  const updatedUser = await UserModel.updateProfile(userId, updates);

  if (!updatedUser) {
    throw new AppError('No valid fields to update', 400);
  }

  ResponseHandler.success(res, { user: updatedUser }, 'Profile updated successfully');
});

// Upload avatar
const uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image', 400);

  const userId = req.user.id;
  const previous = await pool.query('SELECT avatar_key FROM users WHERE id = $1', [userId]);
  const result = await uploadImage(req.file, 'users/avatars');
  const updatedUser = await UserModel.updateProfile(userId, {
    avatar_url: result.url,
    avatar_key: result.publicId
  });

  if (previous.rows[0]?.avatar_key) deleteImage(previous.rows[0].avatar_key).catch(console.error);
  ResponseHandler.success(res, { avatar_url: result.url, user: updatedUser }, 'Avatar uploaded successfully');
});

// Upload cover photo
const uploadCover = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image', 400);

  const userId = req.user.id;
  const previous = await pool.query('SELECT cover_key FROM users WHERE id = $1', [userId]);
  const result = await uploadImage(req.file, 'users/covers');
  const updatedUser = await UserModel.updateProfile(userId, {
    cover_url: result.url,
    cover_key: result.publicId
  });

  if (previous.rows[0]?.cover_key) deleteImage(previous.rows[0].cover_key).catch(console.error);
  ResponseHandler.success(res, { cover_url: result.url, user: updatedUser }, 'Cover photo uploaded successfully');
});

// Get user suggestions
const getUserSuggestions = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit = 20 } = req.query;

  const suggestions = await UserModel.getSuggestions(userId, parseInt(limit));

  ResponseHandler.success(res, { suggestions });
});

// Search users
const searchUsers = catchAsync(async (req, res) => {
  const { q, verified, country, limit = 20, page = 1 } = req.query;
  
  if (!q) {
    throw new AppError('Search query is required', 400);
  }

  const offset = (page - 1) * limit;

  const filters = {
    query: q,
    isVerified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    country
  };

  const users = await UserModel.search(filters, parseInt(limit), parseInt(offset));

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM users 
     WHERE is_active = true 
     AND (username ILIKE $1 OR full_name ILIKE $1)`,
    [`%${q}%`]
  );
  const total = parseInt(countResult.rows[0].count);

  ResponseHandler.paginated(res, users, page, limit, total);
});

// Update privacy settings
const updatePrivacy = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { is_private } = req.body;

  if (typeof is_private !== 'boolean') {
    throw new AppError('is_private must be a boolean', 400);
  }

  const result = await UserModel.updatePrivacy(userId, is_private);

  ResponseHandler.success(res, { is_private: result.is_private }, 'Privacy settings updated');
});

// Get mutual followers with another user
const getMutualFollowers = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetUserId } = req.params;
  const { limit = 50 } = req.query;

  const mutual = await UserModel.getMutualFollowers(userId, targetUserId, parseInt(limit));

  ResponseHandler.success(res, { mutual });
});

// Get follow statistics
const getFollowStats = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user.id;

  const userExists = await pool.query('SELECT id FROM users WHERE id = $1::UUID', [userId]);
  if (userExists.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const stats = await UserModel.getFollowStats(userId);

  ResponseHandler.success(res, { stats });
});

// Get user activity (for feed)
const getUserActivity = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user.id;
  const { limit = 20, offset = 0 } = req.query;

  const query = `
    (SELECT 'post' as type, id, content, created_at
     FROM posts WHERE user_id = $1::UUID AND is_active = true)
    UNION ALL
    (SELECT 'like' as type, p.id, p.content, l.created_at
     FROM likes l
     JOIN posts p ON l.post_id = p.id
     WHERE l.user_id = $1::UUID)
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [userId, limit, offset]);
  
  ResponseHandler.success(res, { activity: result.rows });
});

// Export all functions
module.exports = {
  getCurrentUser,
  getUserProfile,
  updateProfile,
  uploadAvatar,
  uploadCover,
  getUserSuggestions,
  searchUsers,
  updatePrivacy,
  getMutualFollowers,
  getFollowStats,
  getUserActivity
};