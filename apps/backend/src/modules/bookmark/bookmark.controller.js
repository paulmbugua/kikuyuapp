// src/modules/bookmark/bookmark.controller.js
const BookmarkModel = require('./bookmark.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db'); // Add this import

// Bookmark a post
const bookmarkPost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  // Handle case where body might be undefined or empty
  const collection = req.body?.collection || 'Saved';
  
  const result = await BookmarkModel.create(userId, postId, collection);
  
  ResponseHandler.success(res, result, 'Post bookmarked successfully');
});

// Remove bookmark
const removeBookmark = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  const result = await BookmarkModel.delete(userId, postId);
  
  ResponseHandler.success(res, result, 'Bookmark removed successfully');
});

// Get user's bookmarks
const getUserBookmarks = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { collection, limit = 20, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const bookmarks = await BookmarkModel.getUserBookmarks(
    userId, 
    collection, 
    parseInt(limit), 
    parseInt(offset)
  );
  
  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM bookmarks WHERE user_id = $1';
  const countValues = [userId];
  
  if (collection) {
    countQuery += ' AND collection_name = $2';
    countValues.push(collection);
  }
  
  const countResult = await pool.query(countQuery, countValues);
  const total = parseInt(countResult.rows[0].count);
  
  ResponseHandler.paginated(res, bookmarks, page, limit, total);
});

// Get bookmark collections
const getCollections = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const collections = await BookmarkModel.getCollections(userId);
  
  ResponseHandler.success(res, { collections });
});

// Move bookmark to collection
const moveToCollection = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const { collection } = req.body;
  
  if (!collection) {
    throw new AppError('Collection name is required', 400);
  }
  
  const result = await BookmarkModel.moveToCollection(userId, postId, collection);
  
  ResponseHandler.success(res, result, 'Bookmark moved successfully');
});

// Check if post is bookmarked
const checkBookmark = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  const isBookmarked = await BookmarkModel.isBookmarked(userId, postId);
  
  ResponseHandler.success(res, { isBookmarked });
});

module.exports = {
  bookmarkPost,
  removeBookmark,
  getUserBookmarks,
  getCollections,
  moveToCollection,
  checkBookmark
};