// src/modules/token/token.validation.js
const { body, param, query } = require('express-validator');

const validatePackageId = [
    param('packageId')
        .isUUID(4)
        .withMessage('Invalid package ID format')
];

const validatePurchase = [
    body('packageId')
        .isUUID(4)
        .withMessage('Invalid package ID format'),
    body('phoneNumber')
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^(0|254|\+254)[71]\d{8}$/)
        .withMessage('Please provide a valid Kenyan phone number')
];

const validateCreatePackage = [
    body('name')
        .notEmpty()
        .withMessage('Package name is required')
        .isString()
        .withMessage('Name must be a string')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    body('token_amount')
        .isInt({ min: 1 })
        .withMessage('Token amount must be a positive integer'),
    body('price_kes')
        .isFloat({ min: 1 })
        .withMessage('Price must be a positive number'),
    body('bonus_percentage')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Bonus percentage must be between 0 and 100')
];

const validateUpdatePackage = [
    body('name')
        .optional()
        .isString()
        .withMessage('Name must be a string')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    body('token_amount')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Token amount must be a positive integer'),
    body('price_kes')
        .optional()
        .isFloat({ min: 1 })
        .withMessage('Price must be a positive number'),
    body('bonus_percentage')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Bonus percentage must be between 0 and 100'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean')
];

module.exports = {
    validatePackageId,
    validatePurchase,
    validateCreatePackage,
    validateUpdatePackage
};