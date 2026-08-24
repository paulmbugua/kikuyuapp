// src/modules/auth/auth.controller.js
const crypto = require('crypto');
const UserModel = require('../user/user.model');
const StaffModel = require('../staff/staff.model');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/tokenUtils');
const { validatePasswordStrength } = require('../../utils/passwordUtils');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');
const config = require('../../config/env');
const {
  STATE_COOKIE,
  createState,
  exchangeCodeForProfile,
  getAuthorizationUrl,
  parseCookies,
  stateCookieOptions,
  verifyState
} = require('./googleOAuth.service');

const safeJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');

const allowedFrontendOrigin = (candidate) => {
  const localOrigins = config.isProduction
    ? []
    : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000', 'http://127.0.0.1:8080'];
  const allowedOrigins = new Set([...config.googleOAuth.frontendOrigins, ...localOrigins]);
  return allowedOrigins.has(candidate) ? candidate : config.googleOAuth.frontendOrigin;
};

const sendOAuthPopupResponse = (res, payload, requestedFrontendOrigin) => {
  const frontendOrigin = allowedFrontendOrigin(requestedFrontendOrigin);
  const nonce = crypto.randomBytes(18).toString('base64');
  const message = safeJson(payload);
  const targetOrigin = safeJson(frontendOrigin);
  const fallbackPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const fallbackUrl = safeJson(frontendOrigin + '/login#oauth=' + fallbackPayload);
  const csp = "default-src 'none'; script-src 'nonce-" + nonce + "'; base-uri 'none'; frame-ancestors 'none'";
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Google sign-in</title></head><body><script nonce="' + nonce + '">if (window.opener) { window.opener.postMessage(' + message + ', ' + targetOrigin + '); window.close(); } else { window.location.replace(' + fallbackUrl + '); }</script></body></html>';
  res.status(200).set({
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': csp,
    'Cross-Origin-Opener-Policy': 'unsafe-none',
    'Referrer-Policy': 'no-referrer'
  }).send(html);
};

const googleLogin = (req, res) => {
  const frontendOrigin = allowedFrontendOrigin(
    typeof req.query.origin === 'string' ? req.query.origin : undefined
  );
  const state = createState(frontendOrigin);
  res.cookie(STATE_COOKIE, state, stateCookieOptions);
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.redirect(getAuthorizationUrl(state));
};

const googleCallback = async (req, res) => {
  let frontendOrigin = config.googleOAuth.frontendOrigin;
  const clearOptions = {
    httpOnly: stateCookieOptions.httpOnly,
    secure: stateCookieOptions.secure,
    sameSite: stateCookieOptions.sameSite,
    path: stateCookieOptions.path
  };

  try {
    const { code, error, state } = req.query;
    if (error) throw new AppError(`Google sign-in was cancelled: ${error}`, 400);
    if (!code || typeof code !== 'string') throw new AppError('Google authorization code is missing', 400);

    const cookies = parseCookies(req.headers.cookie);
    const statePayload = verifyState(state, cookies[STATE_COOKIE]);
    if (!statePayload) {
      throw new AppError('Invalid or expired Google OAuth state', 400);
    }
    frontendOrigin = allowedFrontendOrigin(statePayload.frontendOrigin);

    const googleProfile = await exchangeCodeForProfile(code);
    const user = await UserModel.findOrCreateFromGoogle(googleProfile);
    const tokens = generateTokenPair({ id: user.id, email: user.email, role: 'user', isStaff: false });
    delete user.google_sub;

    res.clearCookie(STATE_COOKIE, clearOptions);
    return sendOAuthPopupResponse(res, {
      type: 'kikuyu:google-oauth',
      ok: true,
      data: { user, tokens }
    }, frontendOrigin);
  } catch (error) {
    res.clearCookie(STATE_COOKIE, clearOptions);
    return sendOAuthPopupResponse(res, {
      type: 'kikuyu:google-oauth',
      ok: false,
      error: error.message || 'Google sign-in failed'
    }, frontendOrigin);
  }
};

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
  googleCallback,
  staffLogin,
  refreshToken,
  logout,
  changePassword,
  verifyEmail,
  getMe
};