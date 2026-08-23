// src/modules/auth/auth.controller.js
const UserModel = require('../user/user.model');
const StaffModel = require('../staff/staff.model');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/tokenUtils');
const { validatePasswordStrength } = require('../../utils/passwordUtils');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');

// Compatibility response while provider-based Google login is disabled.
const googleLogin = catchAsync(async (req, res) => {
  throw new AppError('Google login is not enabled', 501);
});

// Staff Login (email + password)
const staffLogin = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  // Check if account is locked
  const isLocked = await StaffModel.isLocked(email);
  if (isLocked) {
    throw new AppError('Account is locked. Please try again later.', 423);
  }

  // Find staff by email
  const staff = await StaffModel.findByEmail(email);
  
  if (!staff) {
    // Increment login attempts for non-existent email to prevent enumeration
    await StaffModel.incrementLoginAttempts(email);
    throw new AppError('Invalid credentials', 401);
  }

  // Validate password
  const isValidPassword = await StaffModel.validatePassword(staff, password);
  
  if (!isValidPassword) {
    // Increment login attempts
    await StaffModel.incrementLoginAttempts(email);
    throw new AppError('Invalid credentials', 401);
  }

  // Reset login attempts on successful login
  await StaffModel.resetLoginAttempts(email);
  
  // Update last login
  await StaffModel.updateLastLogin(staff.id);

  // Generate JWT tokens
  const tokens = generateTokenPair({
    id: staff.id,
    email: staff.email,
    role: staff.role_name,
    isStaff: true
  });

  ResponseHandler.success(res, {
    staff: {
      id: staff.id,
      email: staff.email,
      full_name: staff.full_name,
      role: staff.role_name,
      permissions: staff.permissions,
      is_super_admin: staff.is_super_admin
    },
    tokens
  }, 'Staff login successful');
});

// Refresh token
const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Check if user/staff still exists
  let user;
  if (decoded.isStaff) {
    user = await StaffModel.findById(decoded.id);
  } else {
    user = await UserModel.findById(decoded.id);
  }

  if (!user) {
    throw new AppError('User not found', 401);
  }

  // Generate new tokens
  const tokens = generateTokenPair({
    id: user.id,
    email: user.email,
    role: decoded.role,
    isStaff: decoded.isStaff
  });

  ResponseHandler.success(res, { tokens }, 'Token refreshed successfully');
});

// Logout
const logout = catchAsync(async (req, res) => {
  // In a real implementation, you might want to blacklist the token
  // For now, just return success - client should discard tokens
  ResponseHandler.success(res, null, 'Logged out successfully');
});

// Change password (for staff)
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const staffId = req.user.id;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.isValid) {
    throw new AppError(passwordValidation.errors.join('. '), 400);
  }

  // Get staff with password
  const staff = await StaffModel.findByEmail(req.user.email);
  
  // Verify current password
  const isValid = await StaffModel.validatePassword(staff, currentPassword);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Update password
  const { hashPassword } = require('../../utils/passwordUtils');
  const hashedPassword = await hashPassword(newPassword);

  await pool.query(
    'UPDATE staff SET password_hash = $1 WHERE id = $2',
    [hashedPassword, staffId]
  );

  ResponseHandler.success(res, null, 'Password changed successfully');
});

// Verify email (optional)
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.params;
  
  // This would typically verify email verification token
  // For now, just return success
  ResponseHandler.success(res, null, 'Email verified successfully');
});

// Get current user
const getMe = catchAsync(async (req, res) => {
  let user;
  
  if (req.user.isStaff) {
    user = await StaffModel.findById(req.user.id);
  } else {
    user = await UserModel.findById(req.user.id);
  }

  ResponseHandler.success(res, { user });
});

module.exports = {
  googleLogin,
  staffLogin,
  refreshToken,
  logout,
  changePassword,
  verifyEmail,
  getMe
};