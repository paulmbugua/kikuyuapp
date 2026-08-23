// src/middleware/authMiddleware.js
const { verifyAccessToken } = require('../utils/tokenUtils');
const { AppError } = require('./errorMiddleware');
const pool = require('../config/db');
const catchAsync = require('../utils/catchAsync');

// Protect routes - verify JWT token
const protect = catchAsync(async (req, res, next) => {
  let token;

  // Get token from header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    throw new AppError('Not authorized to access this route', 401);
  }

  try {
    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user exists in database
    let user;
    
    if (decoded.isStaff) {
      // Staff user
      const result = await pool.query(
        `SELECT s.*, r.name as role_name, r.permissions 
         FROM staff s 
         JOIN roles r ON s.role_id = r.id 
         WHERE s.id = $1 AND s.is_active = true`,
        [decoded.id]
      );
      user = result.rows[0];
      
      if (user) {
        user.isStaff = true;
        user.role = user.role_name;
        user.permissions = user.permissions;
      }
    } else {
      // Regular user
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      user = result.rows[0];
      
      if (user) {
        user.isStaff = false;
        user.role = 'user';
      }
    }

    if (!user) {
      throw new AppError('User not found or inactive', 401);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    throw new AppError('Not authorized to access this route', 401);
  }
});

// Optional auth - doesn't throw error if no token
const optionalAuth = catchAsync(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      
      if (decoded.isStaff) {
        const result = await pool.query(
          'SELECT * FROM staff WHERE id = $1 AND is_active = true',
          [decoded.id]
        );
        req.user = result.rows[0];
        if (req.user) req.user.isStaff = true;
      } else {
        const result = await pool.query(
          'SELECT * FROM users WHERE id = $1 AND is_active = true',
          [decoded.id]
        );
        req.user = result.rows[0];
        if (req.user) req.user.isStaff = false;
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
  }
  
  next();
});

/**
 * Restrict access to specific roles
 * @param  {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user exists (from protect middleware)
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    // Check if user role is allowed
    // Handle both staff roles and regular user role
    const userRole = req.user.isStaff ? req.user.role : 'user';
    
    if (!roles.includes(userRole)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  restrictTo  // Add this line
};