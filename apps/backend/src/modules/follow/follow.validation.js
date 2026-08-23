// src/modules/follow/follow.validation.js
const { param, query } = require('express-validator');

const validateUserId = [
  param('userId')
    .isUUID(4)
    .withMessage('Invalid user ID format')
];

const validateFollowerId = [
  param('followerId')
    .isUUID(4)
    .withMessage('Invalid follower ID format')
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
  validateUserId,
  validateFollowerId,
  validatePagination
};