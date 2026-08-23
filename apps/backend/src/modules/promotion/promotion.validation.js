const { body, param, query } = require('express-validator');

const validatePlanId = [
    param('planId')
        .isUUID(4)
        .withMessage('Invalid plan ID format')
];

const validatePromotionId = [
    param('promotionId')
        .isUUID(4)
        .withMessage('Invalid promotion ID format')
];

const validateCreatePromotion = [
    body('planId')
        .isUUID(4)
        .withMessage('Invalid plan ID format'),
    body('content')
        .isObject()
        .withMessage('Content must be an object'),
    body('content.contentType')
        .isIn(['post', 'uhoro', 'profile'])
        .withMessage('Content type must be post, uhoro, or profile'),
    body('content.contentId')
        .isUUID(4)
        .withMessage('Invalid content ID format'),
    body('content.audience_targeting')
        .optional()
        .isObject()
        .withMessage('Audience targeting must be an object'),
    body('paymentMethod')
        .optional()
        .isIn(['tokens', 'mpesa'])
        .withMessage('Payment method must be tokens or mpesa'),
    body('phoneNumber')
        .if(body('paymentMethod').equals('mpesa'))
        .notEmpty()
        .withMessage('Phone number required for M-Pesa payment')
        .matches(/^(0|254|\+254)[71]\d{8}$/)
        .withMessage('Please provide a valid Kenyan phone number')
];

module.exports = {
    validatePlanId,
    validatePromotionId,
    validateCreatePromotion
};