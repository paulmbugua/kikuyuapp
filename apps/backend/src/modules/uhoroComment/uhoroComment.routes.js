// src/modules/uhoroComment/uhoroComment.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const uhoroCommentController = require('./uhoroComment.controller');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validateCommentId,
    validateCreateComment,
    validateUpdateComment,
    validatePagination
} = require('./uhoroComment.validation');

// Public routes
router.get('/',
    validatePagination,
    validate,
    optionalAuth,
    uhoroCommentController.getVideoComments
);

router.get('/:commentId/replies',
    validateCommentId,
    validatePagination,
    validate,
    optionalAuth,
    uhoroCommentController.getCommentReplies
);

// Protected routes
router.use(protect);

router.post('/',
    validateCreateComment,
    validate,
    uhoroCommentController.createComment
);

router.put('/:commentId',
    validateCommentId,
    validateUpdateComment,
    validate,
    uhoroCommentController.updateComment
);

router.delete('/:commentId',
    validateCommentId,
    validate,
    uhoroCommentController.deleteComment
);

router.post('/:commentId/like',
    validateCommentId,
    validate,
    uhoroCommentController.likeComment
);

router.delete('/:commentId/unlike',
    validateCommentId,
    validate,
    uhoroCommentController.unlikeComment
);

module.exports = router;