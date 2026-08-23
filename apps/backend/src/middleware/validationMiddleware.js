// src/middleware/validationMiddleware.js
const { validationResult } = require('express-validator');
const { AppError } = require('./errorMiddleware');

// Validate request
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = errors.array().map(err => ({
    field: err.path,
    message: err.msg
  }));

  throw new AppError(`Validation failed: ${JSON.stringify(extractedErrors)}`, 400);
};

// Validate file upload
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const config = require('../config/env');

  // Single file validation
  if (req.file) {
    const file = req.file;
    
    // Check file size
    if (file.size > config.upload.maxFileSize) {
      throw new AppError(`File too large. Max size: ${config.upload.maxFileSize / 1024 / 1024}MB`, 400);
    }

    // Check file type for images
    if (file.mimetype.startsWith('image/')) {
      if (!config.upload.allowedImageTypes.includes(file.mimetype)) {
        throw new AppError('Invalid image type. Allowed: JPEG, PNG, GIF, WebP', 400);
      }
      if (file.size > config.upload.maxImageSize) {
        throw new AppError(`Image too large. Max size: ${config.upload.maxImageSize / 1024 / 1024}MB`, 400);
      }
    }

    // Check file type for videos
    if (file.mimetype.startsWith('video/')) {
      if (!config.upload.allowedVideoTypes.includes(file.mimetype)) {
        throw new AppError('Invalid video type. Allowed: MP4, MOV, WebM', 400);
      }
      if (file.size > config.upload.maxVideoSize) {
        throw new AppError(`Video too large. Max size: ${config.upload.maxVideoSize / 1024 / 1024}MB`, 400);
      }
    }
  }

  // Multiple files validation
  if (req.files) {
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    
    for (const file of files) {
      if (file.size > config.upload.maxFileSize) {
        throw new AppError(`File ${file.originalname} too large`, 400);
      }
    }
  }

  next();
};

module.exports = {
  validate,
  validateFileUpload
};