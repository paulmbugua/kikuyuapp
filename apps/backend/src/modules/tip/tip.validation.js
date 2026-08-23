// src/modules/tip/tip.validation.js
const { body, param, query } = require('express-validator');

const validateTipId = [
    param('tipId')
        .isUUID(4)
        .withMessage('Invalid tip ID format')
];

const validateSendTip = [
    body('receiverId')
        .isUUID(4)
        .withMessage('Invalid receiver ID format'),
    body('amount')
        .isInt({ min: 10, max: 100000 })
        .withMessage('Tip amount must be between 10 and 100,000 tokens'),
    body('contentType')
        .optional()
        .isIn(['post', 'comment', 'uhoro', 'live', 'voice'])
        .withMessage('Invalid content type'),
    body('contentId')
        .optional()
        .isUUID(4)
        .withMessage('Invalid content ID format'),
    body('message')
        .optional()
        .isString()
        .withMessage('Message must be a string')
        .isLength({ max: 500 })
        .withMessage('Message cannot exceed 500 characters'),
    body('isAnonymous')
        .optional()
        .isBoolean()
        .withMessage('isAnonymous must be a boolean'),
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic must be a boolean')
];

const validateContentTips = [
    param('contentType')
        .isIn(['post', 'uhoro', 'live', 'voice'])
        .withMessage('Invalid content type'),
    param('contentId')
        .isUUID(4)
        .withMessage('Invalid content ID format')
];

const validateLeaderboard = [
    query('period')
        .optional()
        .isIn(['daily', 'weekly', 'monthly', 'all_time'])
        .withMessage('Period must be daily, weekly, monthly, or all_time'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('Limit must be between 1 and 500')
];

module.exports = {
    validateTipId,
    validateSendTip,
    validateContentTips,
    validateLeaderboard
};