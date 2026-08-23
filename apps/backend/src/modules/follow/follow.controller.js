// src/modules/follow/follow.controller.js
const FollowModel = require('./follow.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');

// Helper function to create notification
async function createNotification({ userId, type, actorId, referenceId, referenceType, content }) {
  try {
    const actorResult = await pool.query(
      'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
      [actorId]
    );
    
    const actor = actorResult.rows[0];
    
    const query = `
      INSERT INTO notifications (user_id, type, actor_id, actor_name, actor_avatar_url, reference_id, reference_type, content, is_read)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
      RETURNING *
    `;
    
    const values = [
      userId, type, actorId,
      actor?.full_name || actor?.username,
      actor?.avatar_url,
      referenceId, referenceType,
      content || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// Follow a user
const followUser = catchAsync(async (req, res) => {
  const followerId = req.user.id;
  const { userId } = req.params;

  console.log('📌 Follow User - Follower:', followerId, 'Following:', userId);

  const result = await FollowModel.follow(followerId, userId);

  // Create notification for the user being followed (if follow was accepted immediately)
  if (!result.requiresApproval) {
    await createNotification({
      userId: userId, // The user being followed
      type: 'follow',
      actorId: followerId,
      referenceId: followerId,
      referenceType: 'user',
      content: `${req.user.username} started following you`
    });
  }

  const message = result.requiresApproval 
    ? 'Follow request sent successfully' 
    : 'Now following user';

  ResponseHandler.success(res, result, message);
});

// Unfollow a user
const unfollowUser = catchAsync(async (req, res) => {
  const followerId = req.user.id;
  const { userId } = req.params;

  console.log('📌 Unfollow User - Follower:', followerId, 'Following:', userId);

  await FollowModel.unfollow(followerId, userId);

  ResponseHandler.success(res, null, 'Unfollowed successfully');
});

// Accept follow request
const acceptFollowRequest = catchAsync(async (req, res) => {
  const followingId = req.user.id;
  const { followerId } = req.params;

  const follow = await FollowModel.acceptRequest(followerId, followingId);

  // Create notification for the follower that their request was accepted
  await createNotification({
    userId: followerId, // The person who requested to follow
    type: 'follow_approved',
    actorId: followingId,
    referenceId: followingId,
    referenceType: 'user',
    content: `${req.user.username} accepted your follow request`
  });

  ResponseHandler.success(res, { follow }, 'Follow request accepted');
});

// Reject follow request
const rejectFollowRequest = catchAsync(async (req, res) => {
  const followingId = req.user.id;
  const { followerId } = req.params;

  await FollowModel.rejectRequest(followerId, followingId);

  ResponseHandler.success(res, null, 'Follow request rejected');
});

// Block user
const blockUser = catchAsync(async (req, res) => {
  const blockerId = req.user.id;
  const { userId } = req.params;

  if (blockerId === userId) {
    throw new AppError('You cannot block yourself', 400);
  }

  const block = await FollowModel.blockUser(blockerId, userId);

  ResponseHandler.success(res, { blocked_user_id: userId }, 'User blocked successfully');
});

// Unblock user
const unblockUser = catchAsync(async (req, res) => {
  const blockerId = req.user.id;
  const { userId } = req.params;

  await FollowModel.unblockUser(blockerId, userId);

  ResponseHandler.success(res, null, 'User unblocked successfully');
});

// Get followers list
const getFollowers = catchAsync(async (req, res) => {
  const { username } = req.params;
  const currentUserId = req.user?.id || null;
  const { limit = 50, page = 1 } = req.query;

  console.log('📌 Get Followers - Username:', username);

  const userResult = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const userId = userResult.rows[0].id;
  const offset = (page - 1) * limit;

  console.log('📌 Get Followers - User ID:', userId);

  const followers = await FollowModel.getFollowers(
    userId, 
    currentUserId, 
    parseInt(limit), 
    parseInt(offset)
  );

  console.log('📌 Get Followers - Found:', followers.length);

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM follows WHERE following_id = $1::UUID AND status = 'accepted'",
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);

  ResponseHandler.paginated(res, followers, page, limit, total);
});

// Get following list
const getFollowing = catchAsync(async (req, res) => {
  const { username } = req.params;
  const currentUserId = req.user?.id || null;
  const { limit = 50, page = 1 } = req.query;

  console.log('📌 Get Following - Username:', username);

  const userResult = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const userId = userResult.rows[0].id;
  const offset = (page - 1) * limit;

  console.log('📌 Get Following - User ID:', userId);

  const following = await FollowModel.getFollowing(
    userId, 
    currentUserId, 
    parseInt(limit), 
    parseInt(offset)
  );

  console.log('📌 Get Following - Found:', following.length);

  if (following.length === 0) {
    const debugQuery = await pool.query(
      `SELECT 
        f.follower_id, 
        u.username as follower_name,
        f.following_id,
        u2.username as following_name,
        f.status
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       JOIN users u2 ON f.following_id = u2.id
       WHERE f.follower_id = $1::UUID AND f.status = 'accepted'`,
      [userId]
    );
    console.log('📌 Debug - Direct DB query for follows:', debugQuery.rows);
  }

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM follows WHERE follower_id = $1::UUID AND status = 'accepted'",
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);

  ResponseHandler.paginated(res, following, page, limit, total);
});

// Get pending follow requests
const getPendingRequests = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit = 50, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const requests = await FollowModel.getPendingRequests(userId, parseInt(limit), parseInt(offset));

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM follows WHERE following_id = $1::UUID AND status = 'pending'",
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);

  ResponseHandler.paginated(res, requests, page, limit, total);
});

// Check follow status
const checkFollowStatus = catchAsync(async (req, res) => {
  const currentUserId = req.user.id;
  const { userId } = req.params;

  console.log('📌 Check Follow Status - Current:', currentUserId, 'Target:', userId);

  const isFollowing = await FollowModel.isFollowing(currentUserId, userId);
  
  console.log('📌 Is Following:', isFollowing);

  const pendingResult = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'pending') as pending",
    [currentUserId, userId]
  );
  const requestPending = pendingResult.rows[0].pending;

  const blockedResult = await pool.query(
    `SELECT EXISTS(
      SELECT 1 FROM follows 
      WHERE (follower_id = $1::UUID AND following_id = $2::UUID AND status = 'blocked')
         OR (follower_id = $2::UUID AND following_id = $1::UUID AND status = 'blocked')
    ) as blocked`,
    [currentUserId, userId]
  );
  const isBlocked = blockedResult.rows[0].blocked;

  ResponseHandler.success(res, {
    is_following: isFollowing,
    request_pending: requestPending,
    is_blocked: isBlocked
  });
});

// Get follow suggestions
const getFollowSuggestions = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit = 20 } = req.query;

  const suggestions = await FollowModel.getSuggestions(userId, parseInt(limit));

  ResponseHandler.success(res, { suggestions });
});

// Remove follower
const removeFollower = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { followerId } = req.params;

  const result = await pool.query(
    "DELETE FROM follows WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'accepted' RETURNING *",
    [followerId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Follower not found', 404);
  }

  ResponseHandler.success(res, null, 'Follower removed successfully');
});

module.exports = {
  followUser,
  unfollowUser,
  acceptFollowRequest,
  rejectFollowRequest,
  blockUser,
  unblockUser,
  getFollowers,
  getFollowing,
  getPendingRequests,
  checkFollowStatus,
  getFollowSuggestions,
  removeFollower
};