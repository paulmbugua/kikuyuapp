// src/modules/like/like.routes.js
const express = require('express');
const router = express.Router();
const likeController = require('./like.controller');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const { validatePostId } = require('../post/post.validation');
const { validateCommentId } = require('../comment/comment.validation');

// Post likes
router.post('/post/:postId', protect, validatePostId, validate, likeController.likePost);
router.delete('/post/:postId', protect, validatePostId, validate, likeController.unlikePost);
router.get('/post/:postId', optionalAuth, validatePostId, validate, likeController.getPostLikers);

// Comment likes
router.post('/comment/:commentId', protect, validateCommentId, validate, likeController.likeComment);
router.delete('/comment/:commentId', protect, validateCommentId, validate, likeController.unlikeComment);
router.get('/comment/:commentId', optionalAuth, validateCommentId, validate, likeController.getCommentLikers);

// User's liked posts
router.get('/user/me', protect, likeController.getUserLikedPosts);

module.exports = router;