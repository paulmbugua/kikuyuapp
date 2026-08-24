// src/modules/user/user.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('./user.controller');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const config = require('../../config/env');

// Keep uploads in memory and stream them directly to Cloudflare R2.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload?.maxFileSize || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// =============================================
// PUBLIC ROUTES (no authentication)
// =============================================
router.get('/search', userController.searchUsers);

// =============================================
// PROTECTED ROUTES (require authentication)
// =============================================

// Test route to verify router is working
router.get('/test', protect, (req, res) => {
  res.json({ 
    message: 'User routes are working!',
    user: { id: req.user.id, email: req.user.email }
  });
});

// Current user routes
router.get('/me', protect, userController.getCurrentUser);
router.put('/profile', protect, userController.updateProfile);
router.put('/privacy', protect, userController.updatePrivacy);

// Upload routes
router.post('/avatar', protect, upload.single('avatar'), userController.uploadAvatar);
router.post('/cover', protect, upload.single('cover'), userController.uploadCover);

// Stats and suggestions
router.get('/suggestions', protect, userController.getUserSuggestions);
router.get('/stats/follow', protect, userController.getFollowStats);
router.get('/activity', protect, userController.getUserActivity);

// Mutual followers (specific route before generic param)
router.get('/mutual/:targetUserId', protect, userController.getMutualFollowers);

// Keep the username catch-all last so it cannot intercept specific routes.
router.get('/:username', optionalAuth, userController.getUserProfile);

console.log('✅ User routes registered successfully');

module.exports = router;