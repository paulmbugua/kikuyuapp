// src/middleware/roleMiddleware.js
const { AppError } = require('./errorMiddleware');

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }

    // Check if user has required role
    const hasRole = roles.includes(req.user.role);
    
    // Super admin has all access
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!hasRole && !isSuperAdmin) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

// Check specific permission
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has the required permission
    const permissions = req.user.permissions || [];
    
    if (!permissions.includes(permission) && !permissions.includes('all')) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

// Check if user is owner or has permission
const isOwnerOrHasPermission = (getResourceOwnerId, permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }

    // Super admin bypass
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user is the owner
    const ownerId = await getResourceOwnerId(req);
    if (req.user.id === ownerId) {
      return next();
    }

    // Check permission
    const permissions = req.user.permissions || [];
    if (permissions.includes(permission) || permissions.includes('all')) {
      return next();
    }

    return next(new AppError('You do not have permission to perform this action', 403));
  };
};

// Staff only middleware
const staffOnly = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Not authorized', 401));
  }

  if (!req.user.isStaff) {
    return next(new AppError('Staff access only', 403));
  }

  next();
};

module.exports = {
  restrictTo,
  hasPermission,
  isOwnerOrHasPermission,
  staffOnly
};