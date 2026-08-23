// src/modules/comment/comment.validation.js
const { body, param, query } = require('express-validator');

const validateCreateComment = [
  body('content')
    .notEmpty()
    .withMessage('Comment content is required')
    .isString()
    .withMessage('Content must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  body('parentId')
    .optional()
    .isUUID(4)
    .withMessage('Invalid parent comment ID format')
];

const validateCommentId = [
  param('commentId')
    .isUUID(4)
    .withMessage('Invalid comment ID format')
];

const validatePostId = [
  param('postId')
    .isUUID(4)
    .withMessage('Invalid post ID format')
];

module.exports = {
  validateCreateComment,
  validateCommentId,
  validatePostId
};