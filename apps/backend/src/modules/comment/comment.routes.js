// src/modules/comment/comment.routes.js
const express = require('express');
const router = express.Router(); // Remove mergeParams
const commentController = require('./comment.controller');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
  validateCreateComment,
  validateCommentId,
} = require('./comment.validation');

// Public routes (with optional auth)
router.get('/:commentId/replies', validateCommentId, validate, optionalAuth, commentController.getCommentReplies);
router.get('/:commentId/thread', validateCommentId, validate, optionalAuth, commentController.getCommentThread);

// Protected routes
router.use(protect);

// Update comment
router.put('/:commentId', validateCommentId, validateCreateComment, validate, commentController.updateComment);

// Delete comment
router.delete('/:commentId', validateCommentId, validate, commentController.deleteComment);

module.exports = router;