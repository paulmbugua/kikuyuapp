// src/modules/uhoro/uhoro.validation.js
const { body, param, query } = require('express-validator');

const validateVideoId = [
    param('videoId')
        .isUUID(4)
        .withMessage('Invalid video ID format')
];

const validateUserId = [
    param('userId')
        .isUUID(4)
        .withMessage('Invalid user ID format')
];

const validateHashtag = [
    param('hashtag')
        .isString()
        .withMessage('Hashtag must be a string')
        .matches(/^[A-Za-z0-9_]+$/)
        .withMessage('Hashtag can only contain letters, numbers, and underscores')
        .isLength({ min: 2, max: 50 })
        .withMessage('Hashtag must be between 2 and 50 characters')
];

const validatePagination = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('type')
        .optional()
        .isIn(['for-you', 'following', 'popular'])
        .withMessage('Feed type must be for-you, following, or popular')
];

const validateUpload = [
    body('title')
        .optional()
        .isString()
        .withMessage('Title must be a string')
        .isLength({ max: 150 })
        .withMessage('Title cannot exceed 150 characters'),
    body('description')
        .optional()
        .isString()
        .withMessage('Description must be a string')
        .isLength({ max: 2000 })
        .withMessage('Description cannot exceed 2000 characters'),
    body('allowsComments')
        .optional()
        .isBoolean()
        .withMessage('allowsComments must be a boolean'),
    body('allowsDuets')
        .optional()
        .isBoolean()
        .withMessage('allowsDuets must be a boolean'),
    body('allowsStitches')
        .optional()
        .isBoolean()
        .withMessage('allowsStitches must be a boolean'),
    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean')
];

const validateUpdate = [
    body('title')
        .optional()
        .isString()
        .withMessage('Title must be a string')
        .isLength({ max: 150 })
        .withMessage('Title cannot exceed 150 characters'),
    body('description')
        .optional()
        .isString()
        .withMessage('Description must be a string')
        .isLength({ max: 2000 })
        .withMessage('Description cannot exceed 2000 characters'),
    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean'),
    body('allowsComments')
        .optional()
        .isBoolean()
        .withMessage('allowsComments must be a boolean'),
    body('allowsDuets')
        .optional()
        .isBoolean()
        .withMessage('allowsDuets must be a boolean'),
    body('allowsStitches')
        .optional()
        .isBoolean()
        .withMessage('allowsStitches must be a boolean')
];

module.exports = {
    validateVideoId,
    validateUserId,
    validateHashtag,
    validatePagination,
    validateUpload,
    validateUpdate
};