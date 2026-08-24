const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../../config/env');
const { protect } = require('../../middleware/authMiddleware');
const { uploadLimiter } = require('../../middleware/rateLimiter');
const controller = require('./upload.controller');

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, 'uploads/'),
  filename: (_req, file, callback) => callback(null, `promotion-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxVideoSize },
  fileFilter: (_req, file, callback) => {
    const allowed = [...config.upload.allowedImageTypes, ...config.upload.allowedVideoTypes];
    callback(allowed.includes(file.mimetype) ? null : new Error('Unsupported promotion media type'), allowed.includes(file.mimetype));
  }
});

const router = express.Router();
router.post('/promotion-media', protect, uploadLimiter, upload.single('media'), controller.uploadPromotionMedia);

module.exports = router;
