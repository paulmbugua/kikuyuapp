// src/modules/user/user.validation.js
const { body, param, query } = require('express-validator');

const validateUsername = [
  param('username')
    .isString()
    .withMessage('Username must be a string')
    .matches(/^[a-zA-Z0-9_]{3,30}$/)
    .withMessage('Username must be 3-30 characters and can only contain letters, numbers, and underscores')
];

const validateUpdateProfile = [
  body('full_name')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ max: 100 })
    .withMessage('Full name cannot exceed 100 characters'),
  body('bio')
    .optional()
    .isString()
    .withMessage('Bio must be a string')
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Invalid gender option'),
  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
    .custom(value => {
      const date = new Date(value);
      const age = Math.floor((Date.now() - date) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 13) {
        throw new Error('User must be at least 13 years old');
      }
      return true;
    }),
  body('country')
    .optional()
    .isString()
    .withMessage('Country must be a string')
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
  body('is_private')
    .optional()
    .isBoolean()
    .withMessage('is_private must be a boolean')
];

const validateSearch = [
  query('q')
    .optional()
    .isString()
    .withMessage('Search query must be a string')
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  query('verified')
    .optional()
    .isBoolean()
    .withMessage('verified must be true or false'),
  query('country')
    .optional()
    .isString()
    .withMessage('Country must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
];

const validatePrivacy = [
  body('is_private')
    .isBoolean()
    .withMessage('is_private must be a boolean')
];

module.exports = {
  validateUsername,
  validateUpdateProfile,
  validateSearch,
  validatePrivacy
};