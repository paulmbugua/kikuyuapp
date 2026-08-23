// src/modules/uhoroComment/uhoroComment.validation.js
const { body, param, query } = require('express-validator');

const validateCommentId = [
    param('commentId')
        .isUUID(4)
        .withMessage('Invalid comment ID format')
];

const validateCreateComment = [
    body('content')
        .notEmpty()
        .withMessage('Comment content is required')
        .isString()
        .withMessage('Content must be a string')
        .isLength({ min: 1, max: 500 })
        .withMessage('Comment must be between 1 and 500 characters'),
    body('parentId')
        .optional()
        .isUUID(4)
        .withMessage('Invalid parent comment ID format')
];

const validateUpdateComment = [
    body('content')
        .notEmpty()
        .withMessage('Comment content is required')
        .isString()
        .withMessage('Content must be a string')
        .isLength({ min: 1, max: 500 })
        .withMessage('Comment must be between 1 and 500 characters')
];

const validatePagination = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
];

module.exports = {
    validateCommentId,
    validateCreateComment,
    validateUpdateComment,
    validatePagination
};