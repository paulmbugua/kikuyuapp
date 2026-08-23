// src/modules/comment/comment.controller.js
const CommentModel = require('./comment.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { validateCommentContent, moderateContent } = require('../../utils/contentModeration');
const pool = require('../../config/db');
const NotificationModel = require('../notification/notification.model');

// Create comment
const createComment = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const { content, parentId } = req.body;
  
  // Validate content
  const validation = validateCommentContent(content);
  if (!validation.isValid) {
    throw new AppError(validation.reason, 400);
  }
  
  // Moderate content
  const moderation = moderateContent(content);
  if (!moderation.isClean) {
    throw new AppError(`Comment moderation failed: ${moderation.issues.join(', ')}`, 400);
  }
  
  const comment = await CommentModel.create(postId, userId, content, parentId);
  
  // Get post owner information
  const postResult = await pool.query(
    'SELECT user_id FROM posts WHERE id = $1 AND is_active = true',
    [postId]
  );
  
  if (postResult.rows.length > 0) {
    const postOwnerId = postResult.rows[0].user_id;
    
    // Don't notify if user is commenting on their own post
    if (postOwnerId !== userId) {
      await NotificationModel.createCommentNotification(
        userId, 
        postId, 
        postOwnerId, 
        content
      );
    }
    
    // If it's a reply to another comment, notify the parent comment owner
    if (parentId) {
      const parentCommentResult = await pool.query(
        'SELECT user_id FROM comments WHERE id = $1 AND is_active = true',
        [parentId]
      );
      
      if (parentCommentResult.rows.length > 0) {
        const parentCommentOwnerId = parentCommentResult.rows[0].user_id;
        
        if (parentCommentOwnerId !== userId && parentCommentOwnerId !== postOwnerId) {
          const actorResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [userId]
          );
          
          if (actorResult.rows.length > 0) {
            const actor = actorResult.rows[0];
            await NotificationModel.create({
              userId: parentCommentOwnerId,
              type: 'comment_reply',
              actorId: userId,
              actorName: actor.full_name || actor.username,
              actorAvatarUrl: actor.avatar_url,
              content: `${actor.full_name || actor.username} replied to your comment: "${content.substring(0, 50)}..."`,
              referenceId: parentId,
              referenceType: 'comment'
            });
          }
        }
      }
    }
  }
  
  ResponseHandler.created(res, { comment }, 'Comment added successfully');
});

// Get post comments
const getPostComments = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const currentUserId = req.user?.id;
  const { limit = 50, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const comments = await CommentModel.getPostComments(
    postId, 
    currentUserId, 
    parseInt(limit), 
    parseInt(offset)
  );
  
  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM comments WHERE post_id = $1 AND parent_id IS NULL AND is_active = true',
    [postId]
  );
  const total = parseInt(countResult.rows[0].count);
  
  ResponseHandler.paginated(res, comments, page, limit, total);
});

// Get comment replies
const getCommentReplies = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const currentUserId = req.user?.id;
  const { limit = 50, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const replies = await CommentModel.getReplies(
    commentId, 
    currentUserId, 
    parseInt(limit), 
    parseInt(offset)
  );
  
  ResponseHandler.success(res, { replies });
});

// Update comment
const updateComment = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  const { content } = req.body;
  
  if (!content) {
    throw new AppError('Content is required', 400);
  }
  
  const validation = validateCommentContent(content);
  if (!validation.isValid) {
    throw new AppError(validation.reason, 400);
  }
  
  const moderation = moderateContent(content);
  if (!moderation.isClean) {
    throw new AppError(`Comment moderation failed: ${moderation.issues.join(', ')}`, 400);
  }
  
  const comment = await CommentModel.update(commentId, userId, content);
  
  ResponseHandler.success(res, { comment }, 'Comment updated successfully');
});

// Delete comment
const deleteComment = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  
  await CommentModel.delete(commentId, userId);
  
  ResponseHandler.success(res, null, 'Comment deleted successfully');
});

// Get comment thread
const getCommentThread = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const currentUserId = req.user?.id;
  
  const thread = await CommentModel.getThread(commentId, currentUserId);
  
  ResponseHandler.success(res, { thread });
});

// Export all functions
module.exports = {
  createComment,
  getPostComments,
  getCommentReplies,
  updateComment,
  deleteComment,
  getCommentThread
};