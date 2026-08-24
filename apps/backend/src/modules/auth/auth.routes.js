// src/modules/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const { authLimiter } = require('../../middleware/rateLimiter');
const {
  validateStaffLogin,
  validateRefreshToken,
  validateChangePassword
} = require('./auth.validation');

// Public routes (with rate limiting)
router.get('/google', authLimiter, authController.googleLogin);
router.get('/google/callback', authController.googleCallback);
router.post('/staff/login', authLimiter, validateStaffLogin, validate, authController.staffLogin);
router.post('/refresh-token', authLimiter, validateRefreshToken, validate, authController.refreshToken);
router.post('/logout', authLimiter, authController.logout);
router.get('/verify-email/:token', authController.verifyEmail);

// Protected routes
router.get('/me', protect, authController.getMe);
router.post('/change-password', protect, validateChangePassword, validate, authController.changePassword);

module.exports = router;