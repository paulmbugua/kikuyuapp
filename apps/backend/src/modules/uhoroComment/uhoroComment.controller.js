// src/modules/uhoroComment/uhoroComment.controller.js
const UhoroCommentModel = require('./uhoroComment.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { moderateContent } = require('../../utils/contentModeration');

// ==================== CREATE COMMENT ====================

/**
 * @desc    Add a comment to a video
 * @route   POST /api/v1/uhoro/:videoId/comments
 * @access  Private
 */
const createComment = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;
    const { content, parentId } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
        throw new AppError('Comment content is required', 400);
    }

    if (content.length > 500) {
        throw new AppError('Comment cannot exceed 500 characters', 400);
    }

    // Moderate content for hate speech, spam, etc.
    const moderation = moderateContent(content);
    if (!moderation.isClean) {
        throw new AppError(`Comment contains inappropriate content: ${moderation.issues.join(', ')}`, 400);
    }

    // Create comment
    const comment = await UhoroCommentModel.create(videoId, userId, content, parentId);

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
        io.to(`video:${videoId}`).emit('new_comment', {
            video_id: videoId,
            comment: comment
        });

        // If it's a reply, notify parent comment owner
        if (parentId) {
            const parentComment = await UhoroCommentModel.findById(parentId);
            if (parentComment && parentComment.user_id !== userId) {
                io.to(`user:${parentComment.user_id}`).emit('comment_reply', {
                    video_id: videoId,
                    comment: comment,
                    parent_comment_id: parentId
                });
            }
        }

        // Notify video owner
        const video = await pool.query('SELECT user_id FROM uhoro_videos WHERE id = $1', [videoId]);
        if (video.rows[0] && video.rows[0].user_id !== userId) {
            io.to(`user:${video.rows[0].user_id}`).emit('video_comment', {
                video_id: videoId,
                comment: comment
            });
        }
    }

    ResponseHandler.created(res, { comment }, 'Comment added successfully');
});

// ==================== GET COMMENTS ====================

/**
 * @desc    Get all comments for a video (top-level only)
 * @route   GET /api/v1/uhoro/:videoId/comments
 * @access  Public (with optional auth)
 */
const getVideoComments = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const currentUserId = req.user?.id;
    const { limit = 50, page = 1, sort = 'popular' } = req.query;
    const offset = (page - 1) * limit;

    // Validate sort parameter
    const validSorts = ['popular', 'recent', 'oldest'];
    if (!validSorts.includes(sort)) {
        throw new AppError('Sort must be popular, recent, or oldest', 400);
    }

    const comments = await UhoroCommentModel.getVideoComments(
        videoId, 
        currentUserId, 
        sort,
        parseInt(limit), 
        parseInt(offset)
    );

    // Get total count for pagination
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM uhoro_comments WHERE video_id = $1 AND parent_id IS NULL AND is_active = true',
        [videoId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get total comments count (including replies)
    const totalAllResult = await pool.query(
        'SELECT COUNT(*) FROM uhoro_comments WHERE video_id = $1 AND is_active = true',
        [videoId]
    );
    const totalAll = parseInt(totalAllResult.rows[0].count);

    ResponseHandler.paginated(res, comments, page, limit, total, {
        total_comments: totalAll
    });
});

/**
 * @desc    Get replies to a specific comment
 * @route   GET /api/v1/uhoro/comments/:commentId/replies
 * @access  Public (with optional auth)
 */
const getCommentReplies = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const currentUserId = req.user?.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const replies = await UhoroCommentModel.getReplies(
        commentId, 
        currentUserId, 
        parseInt(limit), 
        parseInt(offset)
    );

    ResponseHandler.success(res, { replies });
});

/**
 * @desc    Get a single comment with its replies
 * @route   GET /api/v1/uhoro/comments/:commentId
 * @access  Public (with optional auth)
 */
const getComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const currentUserId = req.user?.id;

    const comment = await UhoroCommentModel.findById(commentId, currentUserId);

    if (!comment) {
        throw new AppError('Comment not found', 404);
    }

    // Get first few replies
    const replies = await UhoroCommentModel.getReplies(commentId, currentUserId, 5, 0);

    ResponseHandler.success(res, {
        comment,
        replies: replies,
        has_more_replies: comment.replies_count > 5
    });
});

/**
 * @desc    Get comment thread (comment + all replies)
 * @route   GET /api/v1/uhoro/comments/:commentId/thread
 * @access  Public (with optional auth)
 */
const getCommentThread = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const currentUserId = req.user?.id;

    const thread = await UhoroCommentModel.getThread(commentId, currentUserId);

    ResponseHandler.success(res, { thread });
});

// ==================== UPDATE/DELETE COMMENTS ====================

/**
 * @desc    Update a comment
 * @route   PUT /api/v1/uhoro/comments/:commentId
 * @access  Private (comment owner only)
 */
const updateComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
        throw new AppError('Comment content is required', 400);
    }

    if (content.length > 500) {
        throw new AppError('Comment cannot exceed 500 characters', 400);
    }

    // Moderate content
    const moderation = moderateContent(content);
    if (!moderation.isClean) {
        throw new AppError(`Comment contains inappropriate content: ${moderation.issues.join(', ')}`, 400);
    }

    const comment = await UhoroCommentModel.update(commentId, userId, content);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
        io.to(`video:${comment.video_id}`).emit('comment_updated', {
            comment_id: commentId,
            content: content,
            is_edited: true,
            updated_at: new Date().toISOString()
        });
    }

    ResponseHandler.success(res, { comment }, 'Comment updated successfully');
});

/**
 * @desc    Delete a comment (soft delete)
 * @route   DELETE /api/v1/uhoro/comments/:commentId
 * @access  Private (comment owner or video owner or admin)
 */
const deleteComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    // First check if user is authorized to delete
    const comment = await UhoroCommentModel.findById(commentId);
    
    if (!comment) {
        throw new AppError('Comment not found', 404);
    }

    // Check if user is comment owner, video owner, or admin
    const isCommentOwner = comment.user_id === userId;
    const isVideoOwner = await checkVideoOwnership(comment.video_id, userId);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';

    if (!isCommentOwner && !isVideoOwner && !isAdmin) {
        throw new AppError('You do not have permission to delete this comment', 403);
    }

    await UhoroCommentModel.delete(commentId, userId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
        io.to(`video:${comment.video_id}`).emit('comment_deleted', {
            comment_id: commentId,
            deleted_by: userId
        });
    }

    ResponseHandler.success(res, null, 'Comment deleted successfully');
});

// ==================== COMMENT LIKES ====================

/**
 * @desc    Like a comment
 * @route   POST /api/v1/uhoro/comments/:commentId/like
 * @access  Private
 */
const likeComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    const result = await UhoroCommentModel.likeComment(userId, commentId);

    // Get updated comment for socket event
    const comment = await UhoroCommentModel.findById(commentId, userId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
        io.to(`video:${comment.video_id}`).emit('comment_liked', {
            comment_id: commentId,
            user_id: userId,
            likes_count: comment.likes_count,
            is_liked: true
        });

        // Notify comment owner
        if (comment.user_id !== userId) {
            io.to(`user:${comment.user_id}`).emit('comment_like_notification', {
                comment_id: commentId,
                liked_by: userId,
                liked_by_username: req.user.username
            });
        }
    }

    ResponseHandler.success(res, result, 'Comment liked successfully');
});

/**
 * @desc    Unlike a comment
 * @route   DELETE /api/v1/uhoro/comments/:commentId/like
 * @access  Private
 */
const unlikeComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    const result = await UhoroCommentModel.unlikeComment(userId, commentId);

    // Get updated comment for socket event
    const comment = await UhoroCommentModel.findById(commentId, userId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
        io.to(`video:${comment.video_id}`).emit('comment_unliked', {
            comment_id: commentId,
            user_id: userId,
            likes_count: comment.likes_count,
            is_liked: false
        });
    }

    ResponseHandler.success(res, result, 'Comment unliked successfully');
});

/**
 * @desc    Get users who liked a comment
 * @route   GET /api/v1/uhoro/comments/:commentId/likers
 * @access  Public
 */
const getCommentLikers = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const likers = await UhoroCommentModel.getCommentLikers(commentId, parseInt(limit), parseInt(offset));

    // Get total count
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM uhoro_comment_likes WHERE comment_id = $1',
        [commentId]
    );
    const total = parseInt(countResult.rows[0].count);

    ResponseHandler.paginated(res, likers, page, limit, total);
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Helper to check if user owns the video
 */
const checkVideoOwnership = async (videoId, userId) => {
    const result = await pool.query(
        'SELECT user_id FROM uhoro_videos WHERE id = $1',
        [videoId]
    );
    return result.rows[0]?.user_id === userId;
};

/**
 * @desc    Report a comment (for moderation)
 * @route   POST /api/v1/uhoro/comments/:commentId/report
 * @access  Private
 */
const reportComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const { reason, description } = req.body;

    if (!reason) {
        throw new AppError('Please provide a reason for reporting', 400);
    }

    // Check if already reported by this user
    const existing = await pool.query(
    'SELECT id FROM content_reports WHERE reporter_id = $1 AND content_type = $2 AND content_id = $3 AND status = $4',
    [userId, 'comment', commentId, 'pending']
);

    if (existing.rows.length > 0) {
        throw new AppError('You have already reported this comment', 400);
    }

    // Create report
    const reportResult = await pool.query(
        `INSERT INTO content_reports (reporter_id, content_type, content_id, reason, description)
         VALUES ($1, 'comment', $2, $3, $4)
         RETURNING *`,
        [userId, commentId, reason, description]
    );

    // Update moderation queue
    await pool.query(
        `INSERT INTO moderation_queue (content_type, content_id, user_id, content_snapshot, report_count)
         SELECT 'comment', $1, user_id, row_to_json(c), 1
         FROM uhoro_comments c
         WHERE c.id = $1
         ON CONFLICT (content_type, content_id) 
         DO UPDATE SET report_count = moderation_queue.report_count + 1`,
        [commentId]
    );

    ResponseHandler.success(res, { report: reportResult.rows[0] }, 'Comment reported successfully');
});

/**
 * @desc    Pin a comment (highlight best comment)
 * @route   POST /api/v1/uhoro/comments/:commentId/pin
 * @access  Private (video owner only)
 */
const pinComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Check if user owns the video
    const comment = await UhoroCommentModel.findById(commentId);
    const isVideoOwner = await checkVideoOwnership(comment.video_id, userId);

    if (!isVideoOwner) {
        throw new AppError('Only the video owner can pin comments', 403);
    }

    // Pin comment (unpin any previously pinned)
    await pool.query(
        `UPDATE uhoro_comments 
         SET is_pinned = (id = $1)
         WHERE video_id = $2`,
        [commentId, comment.video_id]
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
        io.to(`video:${comment.video_id}`).emit('comment_pinned', {
            comment_id: commentId,
            pinned_by: userId
        });
    }

    ResponseHandler.success(res, null, 'Comment pinned successfully');
});

module.exports = {
    createComment,
    getVideoComments,
    getCommentReplies,
    getComment,
    getCommentThread,
    updateComment,
    deleteComment,
    likeComment,
    unlikeComment,
    getCommentLikers,
    reportComment,
    pinComment
};