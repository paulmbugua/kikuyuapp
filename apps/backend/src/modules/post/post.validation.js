// src/modules/post/post.validation.js
const { body, param, query } = require('express-validator');

const validateCreatePost = [
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string')
    .isLength({ max: 5000 })
    .withMessage('Content cannot exceed 5000 characters')
    .custom(content => {
      if (content && content.trim().length === 0) {
        throw new Error('Content cannot be empty');
      }
      return true;
    })
];

const validatePostId = [
  param('postId')
    .isUUID(4)
    .withMessage('Invalid post ID format')
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
    .withMessage('Page must be a positive integer')
];

module.exports = {
  validateCreatePost,
  validatePostId,
  validateUserId,
  validateHashtag,
  validatePagination
};