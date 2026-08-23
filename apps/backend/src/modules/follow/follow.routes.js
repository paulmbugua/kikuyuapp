// src/modules/follow/follow.routes.js
const express = require('express');
const router = express.Router();
const followController = require('./follow.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
  validateUserId,
  validateFollowerId,
  validatePagination
} = require('./follow.validation');

// All follow routes are protected
router.use(protect);

// Follow/unfollow - note: these use userId parameter
router.post('/:userId/follow', validateUserId, validate, followController.followUser);
router.delete('/:userId/unfollow', validateUserId, validate, followController.unfollowUser);

// Follow requests
router.get('/requests/pending', validatePagination, validate, followController.getPendingRequests);
router.post('/requests/:followerId/accept', validateFollowerId, validate, followController.acceptFollowRequest);
router.delete('/requests/:followerId/reject', validateFollowerId, validate, followController.rejectFollowRequest);

// Block/unblock
router.post('/:userId/block', validateUserId, validate, followController.blockUser);
router.delete('/:userId/unblock', validateUserId, validate, followController.unblockUser);

// Suggestions
router.get('/suggestions', followController.getFollowSuggestions);

// Status check
router.get('/:userId/status', validateUserId, validate, followController.checkFollowStatus);

// Followers and Following - IMPORTANT: these use username, not userId
router.get('/:username/followers', followController.getFollowers);
router.get('/:username/following', followController.getFollowing);

// Remove follower
router.delete('/followers/:followerId/remove', validateFollowerId, validate, followController.removeFollower);

module.exports = router;