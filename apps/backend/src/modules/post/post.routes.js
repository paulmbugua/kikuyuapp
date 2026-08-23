// src/modules/post/post.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const postController = require('./post.controller');
const commentController = require('../comment/comment.controller'); // Make sure this path is correct
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const { validate, validateFileUpload } = require('../../middleware/validationMiddleware');
const { uploadLimiter } = require('../../middleware/rateLimiter');
const {
  validateCreatePost,
  validatePostId,
  validateUserId,
  validateHashtag,
  validatePagination
} = require('./post.validation');
const {
  validateCreateComment
} = require('../comment/comment.validation');
const config = require('../../config/env');

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Update the fileFilter to be more explicit
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxVideoSize || 100 * 1024 * 1024 // 100MB for videos
  },
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    const allAllowed = [...imageTypes, ...videoTypes];
    
    if (allAllowed.includes(file.mimetype)) {
      // Store the media type in request for later use
      req.fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Please upload images (JPEG, PNG, GIF, WEBP) or videos (MP4, MOV, AVI, WEBM).`), false);
    }
  }
});
// ============ PUBLIC ROUTES ============
router.get('/explore', validatePagination, validate, postController.getExploreFeed);
router.get('/hashtags/trending', postController.getTrendingHashtags);
router.get('/hashtag/:hashtag', validateHashtag, validatePagination, validate, optionalAuth, postController.getPostsByHashtag);
router.get('/:postId', validatePostId, validate, optionalAuth, postController.getPost);
router.get('/user/:userId', validateUserId, validatePagination, validate, optionalAuth, postController.getUserPosts);

// Comment routes (public read)
router.get('/:postId/comments',
  optionalAuth,
  validatePostId,
  validatePagination,
  validate,
  commentController.getPostComments
);

// ============ PROTECTED ROUTES ============
router.use(protect);

// Feed
router.get('/feed', validatePagination, validate, postController.getFeed);

// Post CRUD
router.post('/',
  uploadLimiter,
  upload.single('media'),
  validateFileUpload,
  validateCreatePost,
  validate,
  postController.createPost
);

router.put('/:postId',
  validatePostId,
  validateCreatePost,
  validate,
  postController.updatePost
);

router.delete('/:postId',
  validatePostId,
  validate,
  postController.deletePost
);

// Pin post
router.post('/:postId/pin',
  validatePostId,
  validate,
  postController.pinPost
);

// Comment creation
router.post('/:postId/comments',
  validatePostId,
  validateCreateComment,
  validate,
  commentController.createComment  // Make sure this function exists
);
router.post('/:postId/view', protect, validatePostId, validate, postController.trackView);

module.exports = router;