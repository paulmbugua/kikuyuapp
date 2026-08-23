// src/modules/verification/verification.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const verificationController = require('./verification.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validatePlanId,
    validatePurchaseMpesa,
    validateGrantVerification,
    validateRevokeVerification
} = require('./verification.validation');

// Public routes
router.get('/plans', verificationController.getPlans);
router.get('/plans/:planId', validatePlanId, validate, verificationController.getPlan);

// Protected routes
router.use(protect);

// User routes
router.get('/me', verificationController.getMyVerification);
router.get('/history', verificationController.getMyHistory);

// FIXED: Use body validation for purchase routes (not param validation)
router.post('/purchase/mpesa', 
    body('planId').isUUID(4).withMessage('Invalid plan ID format'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required')
        .matches(/^(0|254|\+254)[71]\d{8}$/).withMessage('Please provide a valid Kenyan phone number'),
    validate,
    verificationController.purchaseWithMpesa
);

router.post('/purchase/tokens', 
    body('planId').isUUID(4).withMessage('Invalid plan ID format'),
    validate,
    verificationController.purchaseWithTokens
);

router.post('/auto-renew', verificationController.autoRenew);
router.delete('/auto-renew', verificationController.cancelAutoRenew);

// Admin routes
router.get('/admin/all', restrictTo('super_admin', 'platform_admin'), verificationController.getAllVerifications);
router.get('/admin/stats', restrictTo('super_admin', 'platform_admin', 'finance'), verificationController.getVerificationStats);
router.post('/admin/grant/:userId', restrictTo('super_admin'), validateGrantVerification, validate, verificationController.grantVerification);
router.post('/admin/revoke/:userId', restrictTo('super_admin'), validateRevokeVerification, validate, verificationController.revokeVerification);

module.exports = router;