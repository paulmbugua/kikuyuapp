// src/modules/admin/admin.validation.js
const { body, param, query } = require('express-validator');

const validateUserId = [
    param('userId')
        .isUUID(4)
        .withMessage('Invalid user ID format')
];

const validateContentType = [
    param('contentType')
        .isIn(['post', 'comment', 'uhoro', 'profile'])
        .withMessage('Invalid content type'),
    param('contentId')
        .isUUID(4)
        .withMessage('Invalid content ID format')
];

const validateModeration = [
    param('itemId')
        .isUUID(4)
        .withMessage('Invalid moderation item ID'),
    body('action')
        .isIn(['approve', 'reject'])
        .withMessage('Action must be either approve or reject'),
    body('notes')
        .optional()
        .isString()
        .withMessage('Notes must be a string')
        .isLength({ max: 500 })
        .withMessage('Notes cannot exceed 500 characters')
];

const validateBanUser = [
    body('reason')
        .notEmpty()
        .withMessage('Ban reason is required')
        .isString()
        .withMessage('Reason must be a string')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters'),
    body('duration')
        .optional()
        .isIn(['temporary', 'permanent'])
        .withMessage('Duration must be temporary or permanent'),
    body('expires_at')
        .optional()
        .isISO8601()
        .withMessage('Invalid expiration date format')
        .custom((value, { req }) => {
            if (req.body.duration === 'temporary' && !value) {
                throw new Error('Expiration date required for temporary bans');
            }
            return true;
        })
];

const validateCreateStaff = [
    body('email')
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('full_name')
        .notEmpty()
        .withMessage('Full name is required')
        .isString()
        .withMessage('Full name must be a string')
        .isLength({ max: 100 })
        .withMessage('Full name cannot exceed 100 characters'),
    body('role_id')
        .isUUID(4)
        .withMessage('Invalid role ID'),
    body('is_super_admin')
        .optional()
        .isBoolean()
        .withMessage('is_super_admin must be a boolean')
];

const validateUpdateStaffRole = [
    param('staffId')
        .isUUID(4)
        .withMessage('Invalid staff ID'),
    body('roleId')
        .isUUID(4)
        .withMessage('Invalid role ID')
];

const validateSettings = [
    body('value')
        .notEmpty()
        .withMessage('Setting value is required')
];

const validateAnalyticsPeriod = [
    query('period')
        .optional()
        .isIn(['7d', '30d', '90d', 'all'])
        .withMessage('Period must be 7d, 30d, 90d, or all')
];

module.exports = {
    validateUserId,
    validateContentType,
    validateModeration,
    validateBanUser,
    validateCreateStaff,
    validateUpdateStaffRole,
    validateSettings,
    validateAnalyticsPeriod
};