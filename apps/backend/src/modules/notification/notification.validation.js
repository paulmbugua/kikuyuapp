const { param, query } = require('express-validator');

const validateNotificationId = [
    param('notificationId')
        .isUUID(4)
        .withMessage('Invalid notification ID format')
];

// In notification.validation.js
const validateGetNotifications = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('filter')
        .optional()
        .isIn(['all', 'like', 'comment', 'follow', 'tip', 'verified', 'mention', 'repost', 'new_post', 'comment_reply']) // ADDED new types
        .withMessage('Invalid filter type')
];

module.exports = {
    validateNotificationId,
    validateGetNotifications
};