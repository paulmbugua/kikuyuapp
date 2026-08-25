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
const nodemailer = require('nodemailer');
const { hashPassword, comparePassword } = require('../../utils/passwordUtils');
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

const mailTransport = () => {
  if (!config.mail.host || !config.mail.user || !config.mail.pass) throw new AppError('Email service is not configured', 503);
  return nodemailer.createTransport({ host: config.mail.host, port: config.mail.port, secure: config.mail.secure, auth: { user: config.mail.user, pass: config.mail.pass } });
};

const sendMail = (message) => mailTransport().sendMail({ from: config.mail.from, replyTo: config.mail.replyTo, ...message });

const publicUser = (user) => {
  const safe = { ...user };
  delete safe.password_hash;
  delete safe.password_reset_token_hash;
  delete safe.password_reset_expires_at;
  delete safe.google_sub;
  return safe;
};

const createLocalUsername = async (email, requested) => {
  const base = (requested || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 28) || 'member';
  let username = base;
  let counter = 1;
  while (await UserModel.usernameExists(username)) username = base + counter++;
  return username;
};

const localRegister = catchAsync(async (req, res) => {
  const { email, password, confirmPassword, fullName, username } = req.body;
  if (!email || !password || !confirmPassword) throw new AppError('Email, password and confirmation are required', 400);
  if (password !== confirmPassword) throw new AppError('Passwords do not match', 400);
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) throw new AppError(validation.errors.join('. '), 400);
  const normalizedEmail = email.trim().toLowerCase();
  if (await UserModel.findByEmail(normalizedEmail)) throw new AppError('An account with this email already exists', 409);
  const userUsername = await createLocalUsername(normalizedEmail, username);
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (email, username, full_name, password_hash, is_verified, last_login)
     VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP) RETURNING *`,
    [normalizedEmail, userUsername, (fullName || userUsername).trim(), passwordHash]
  );
  const user = result.rows[0];
  const tokens = generateTokenPair({ id: user.id, email: user.email, role: 'user', isStaff: false });
  ResponseHandler.success(res, { user: publicUser(user), tokens }, 'Account created successfully', 201);
});

const localLogin = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required', 400);
  const user = await UserModel.findByEmail(email.trim().toLowerCase());
  if (!user?.password_hash || !(await comparePassword(password, user.password_hash))) throw new AppError('Invalid email or password', 401);
  await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
  const tokens = generateTokenPair({ id: user.id, email: user.email, role: 'user', isStaff: false });
  ResponseHandler.success(res, { user: publicUser(user), tokens }, 'Login successful');
});

const requestPasswordReset = catchAsync(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) throw new AppError('Email is required', 400);
  const user = await UserModel.findByEmail(email);
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query('UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = NOW() + INTERVAL \'30 minutes\' WHERE id = $2', [tokenHash, user.id]);
    const resetUrl = config.googleOAuth.frontendOrigin + '/reset-password?token=' + rawToken + '&email=' + encodeURIComponent(email);
    await sendMail({ to: email, subject: 'Reset your Thutha password', html: '<h2>Reset your Thutha password</h2><p>Use the button below within 30 minutes to choose a new password.</p><p><a href="' + resetUrl + '">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>' });
  }
  ResponseHandler.success(res, null, 'If an account exists for that email, a reset link has been sent');
});

const resetPassword = catchAsync(async (req, res) => {
  const { email, token, password, confirmPassword } = req.body;
  if (!email || !token || !password || !confirmPassword) throw new AppError('All fields are required', 400);
  if (password !== confirmPassword) throw new AppError('Passwords do not match', 400);
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) throw new AppError(validation.errors.join('. '), 400);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND password_reset_token_hash = $2 AND password_reset_expires_at > NOW() LIMIT 1', [email.trim(), tokenHash]);
  if (!result.rows[0]) throw new AppError('This reset link is invalid or expired', 400);
  const passwordHash = await hashPassword(password);
  await pool.query('UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [passwordHash, result.rows[0].id]);
  ResponseHandler.success(res, null, 'Password reset successfully');
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
  googleCallback,
  localRegister,
  localLogin,
  requestPasswordReset,
  resetPassword,
  staffLogin,
  refreshToken,
  logout,
  changePassword,
  verifyEmail,
  getMe
};