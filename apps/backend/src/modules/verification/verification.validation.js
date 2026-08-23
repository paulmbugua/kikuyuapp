// src/modules/verification/verification.validation.js
const { body, param } = require('express-validator');

const validatePlanId = [
    param('planId')
        .isUUID(4)
        .withMessage('Invalid plan ID format')
];

const validatePurchaseMpesa = [
    body('planId')
        .isUUID(4)
        .withMessage('Invalid plan ID format'),
    body('phoneNumber')
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^(0|254|\+254)[71]\d{8}$/)
        .withMessage('Please provide a valid Kenyan phone number')
];

const validateGrantVerification = [
    param('userId')
        .isUUID(4)
        .withMessage('Invalid user ID format'),
    body('planId')
        .isUUID(4)
        .withMessage('Invalid plan ID format'),
    body('reason')
        .optional()
        .isString()
        .withMessage('Reason must be a string')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters')
];

const validateRevokeVerification = [
    param('userId')
        .isUUID(4)
        .withMessage('Invalid user ID format'),
    body('reason')
        .notEmpty()
        .withMessage('Revocation reason is required')
        .isString()
        .withMessage('Reason must be a string')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters')
];

module.exports = {
    validatePlanId,
    validatePurchaseMpesa,
    validateGrantVerification,
    validateRevokeVerification
};