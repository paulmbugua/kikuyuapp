// src/utils/tokenUtils.js
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AppError } = require('../middleware/errorMiddleware');

// Generate access token
const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401);
    }
    throw new AppError('Invalid token', 401);
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw new AppError('Invalid refresh token', 401);
  }
};

// Generate token pair
const generateTokenPair = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'user',
    isStaff: user.isStaff || false
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn
  };
};

// Decode token without verification
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  decodeToken
};