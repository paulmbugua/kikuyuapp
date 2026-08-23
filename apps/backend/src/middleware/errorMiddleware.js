// src/middleware/errorMiddleware.js
const config = require('../config/env');
const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Not found middleware
const notFound = (req, res, next) => {
  const error = new AppError(`🔍 Not Found - ${req.originalUrl}`, 404);
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error
  logger.error({
    message: error.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    statusCode: error.statusCode
  });

  // PostgreSQL duplicate key error
  if (err.code === '23505') {
    const field = err.detail.match(/Key \((.*?)\)=/)?.[1] || 'field';
    error = new AppError(`${field} already exists`, 400);
  }

  // PostgreSQL foreign key error
  if (err.code === '23503') {
    error = new AppError('Referenced record does not exist', 400);
  }

  // PostgreSQL not null violation
  if (err.code === '23502') {
    error = new AppError(`Missing required field: ${err.column}`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error = new AppError(err.message, 400);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('Unexpected file field', 400);
  }

  // Send response
  res.status(error.statusCode).json({
    success: false,
    error: error.message,
    stack: config.isDevelopment ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  AppError,
  notFound,
  errorHandler
};