// src/modules/uhoro/uhoro.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uhoroController = require('./uhoro.controller');
const uhoroCommentRoutes = require('../uhoroComment/uhoroComment.routes');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const { validate, validateFileUpload } = require('../../middleware/validationMiddleware');
const { uploadLimiter } = require('../../middleware/rateLimiter');
const {
    validateVideoId,
    validateUserId,
    validateHashtag,
    validatePagination,
    validateUpload,
    validateUpdate
} = require('./uhoro.validation');
const config = require('../../config/env');

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'uhoro-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

// Mount comment routes
router.use('/:videoId/comments', uhoroCommentRoutes);

// Public routes
router.get('/feed', validatePagination, validate, optionalAuth, uhoroController.getFeed);
router.get('/trending/hashtags', uhoroController.getTrendingHashtags);
router.get('/hashtag/:hashtag', validateHashtag, validatePagination, validate, optionalAuth, uhoroController.getVideosByHashtag);
router.get('/search', validatePagination, validate, optionalAuth, uhoroController.searchVideos);
router.get('/user/:userId', validateUserId, validatePagination, validate, optionalAuth, uhoroController.getUserVideos);
router.get('/:videoId', validateVideoId, validate, optionalAuth, uhoroController.getVideo);

// Protected routes
router.use(protect);

// Video upload and management
router.post('/upload',
    uploadLimiter,
    upload.single('video'),
    validateFileUpload,
    validateUpload,
    validate,
    uhoroController.uploadVideo
);

router.put('/:videoId',
    validateVideoId,
    validateUpdate,
    validate,
    uhoroController.updateVideo
);

router.delete('/:videoId',
    validateVideoId,
    validate,
    uhoroController.deleteVideo
);

// Engagement
router.post('/:videoId/like',
    validateVideoId,
    validate,
    uhoroController.likeVideo
);

router.delete('/:videoId/unlike',
    validateVideoId,
    validate,
    uhoroController.unlikeVideo
);

router.get('/:videoId/likers',
    validateVideoId,
    validatePagination,
    validate,
    uhoroController.getVideoLikers
);

router.post('/:videoId/share',
    validateVideoId,
    validate,
    uhoroController.shareVideo
);

router.post('/:videoId/view',
    validateVideoId,
    validate,
    uhoroController.recordView
);

// Analytics
router.get('/:videoId/analytics',
    validateVideoId,
    validate,
    uhoroController.getVideoAnalytics
);

// User history
router.get('/history/views',
    validatePagination,
    validate,
    uhoroController.getWatchHistory
);

router.get('/stats/watch-time',
    uhoroController.getWatchTimeStats
);

module.exports = router;