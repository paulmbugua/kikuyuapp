// src/modules/like/like.controller.js
const LikeModel = require('./like.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db'); // ADD THIS MISSING IMPORT

// Like a post
const likePost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  const result = await LikeModel.likePost(userId, postId);
  
  ResponseHandler.success(res, result, 'Post liked successfully');
});

// Unlike a post
const unlikePost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  const result = await LikeModel.unlikePost(userId, postId);
  
  ResponseHandler.success(res, result, 'Post unliked successfully');
});

// Like a comment
const likeComment = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  
  const result = await LikeModel.likeComment(userId, commentId);
  
  ResponseHandler.success(res, result, 'Comment liked successfully');
});

// Unlike a comment
const unlikeComment = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  
  const result = await LikeModel.unlikeComment(userId, commentId);
  
  ResponseHandler.success(res, result, 'Comment unliked successfully');
});

// Get post likers
const getPostLikers = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const { limit = 50, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const likers = await LikeModel.getPostLikers(postId, parseInt(limit), parseInt(offset));
  
  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM likes WHERE post_id = $1',
    [postId]
  );
  const total = parseInt(countResult.rows[0].count);
  
  ResponseHandler.paginated(res, likers, page, limit, total);
});

// Get comment likers
const getCommentLikers = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const { limit = 50, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const likers = await LikeModel.getCommentLikers(commentId, parseInt(limit), parseInt(offset));
  
  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM likes WHERE comment_id = $1',
    [commentId]
  );
  const total = parseInt(countResult.rows[0].count);
  
  ResponseHandler.paginated(res, likers, page, limit, total);
});

// Get user's liked posts
const getUserLikedPosts = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit = 20, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const posts = await LikeModel.getUserLikedPosts(userId, parseInt(limit), parseInt(offset));
  
  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM likes WHERE user_id = $1 AND post_id IS NOT NULL',
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);
  
  ResponseHandler.paginated(res, posts, page, limit, total);
});

module.exports = {
  likePost,
  unlikePost,
  likeComment,
  unlikeComment,
  getPostLikers,
  getCommentLikers,
  getUserLikedPosts
};