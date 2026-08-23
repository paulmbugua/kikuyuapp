// src/modules/tip/tip.routes.js
const express = require('express');
const router = express.Router();
const tipController = require('./tip.controller');
const { protect, restrictTo, optionalAuth } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validateSendTip,
    validateTipId,
    validateContentTips,
    validateLeaderboard
} = require('./tip.validation');

// Public routes
router.get('/leaderboard', validateLeaderboard, validate, tipController.getLeaderboard);
router.get('/stats', tipController.getTipStats);
router.get('/content/:contentType/:contentId', validateContentTips, validate, optionalAuth, tipController.getContentTips);

// Protected routes
router.use(protect);

router.post('/', validateSendTip, validate, tipController.sendTip);
router.get('/sent', tipController.getSentTips);
router.get('/received', tipController.getReceivedTips);
router.get('/:tipId', validateTipId, validate, tipController.getTip);

// Admin routes
router.get('/admin/pending', restrictTo('super_admin', 'moderator'), tipController.getPendingTips);

module.exports = router;