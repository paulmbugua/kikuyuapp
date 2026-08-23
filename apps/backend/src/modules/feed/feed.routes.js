// src/modules/feed/feed.routes.js
const express = require('express');
const router = express.Router();
const feedController = require('./feed.controller');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const { validatePagination } = require('../post/post.validation');

// Public routes (with optional auth)
router.get('/', optionalAuth, feedController.getFeed);
router.get('/trending', validatePagination, validate, feedController.getTrendingFeed);
router.get('/latest', validatePagination, validate, feedController.getLatestFeed);
router.get('/hashtag/:hashtag', validatePagination, validate, optionalAuth, feedController.getFeedByHashtag);

// Protected routes (require authentication)
router.use(protect);

router.get('/following', feedController.getFollowingFeed);
router.get('/recommended', feedController.getRecommended);
router.get('/my-posts', feedController.getMyPosts);

module.exports = router;