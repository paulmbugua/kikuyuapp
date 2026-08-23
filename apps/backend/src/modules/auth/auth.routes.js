// src/modules/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const { authLimiter } = require('../../middleware/rateLimiter');
const {
  validateGoogleLogin,
  validateStaffLogin,
  validateRefreshToken,
  validateChangePassword
} = require('./auth.validation');

// Add this temporarily for testing
router.get('/google', (req, res) => {
  res.status(200).json({ 
    message: 'GET endpoint works! Use POST for actual login',
    note: 'This is just a test endpoint'
  });
});

// Public routes (with rate limiting)
router.post('/google', authLimiter, validateGoogleLogin, validate, authController.googleLogin);
router.post('/staff/login', authLimiter, validateStaffLogin, validate, authController.staffLogin);
router.post('/refresh-token', authLimiter, validateRefreshToken, validate, authController.refreshToken);
router.post('/logout', authLimiter, authController.logout);
router.get('/verify-email/:token', authController.verifyEmail);

// Protected routes
router.get('/me', protect, authController.getMe);
router.post('/change-password', protect, validateChangePassword, validate, authController.changePassword);

module.exports = router;