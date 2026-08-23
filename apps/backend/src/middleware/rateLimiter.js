// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use the proper IP generator
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // For IP-based rate limiting, we need to use the built-in helper
    // This ensures IPv6 addresses are properly handled
    return rateLimit.ipKeyGenerator(req);
  }
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  },
  keyGenerator: (req) => {
    // For auth endpoints, always use IP-based limiting with proper IPv6 handling
    return rateLimit.ipKeyGenerator(req);
  }
});

// Upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    error: 'Upload limit reached, please try again later.'
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP with proper IPv6 handling
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return rateLimit.ipKeyGenerator(req);
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter
};