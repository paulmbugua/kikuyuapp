// src/modules/token/token.routes.js
const express = require('express');
const router = express.Router();
const tokenController = require('./token.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validatePurchase,
    validatePackageId,
    validateCreatePackage,
    validateUpdatePackage
} = require('./token.validation');

// Public routes
router.get('/packages', tokenController.getPackages);
router.get('/packages/:packageId', validatePackageId, validate, tokenController.getPackage);

// Protected routes
router.use(protect);

router.get('/balance', tokenController.getBalance);
router.get('/transactions', tokenController.getTransactionHistory);
router.get('/stats', tokenController.getTokenStats);
router.post('/purchase', validatePurchase, validate, tokenController.purchaseTokens);
router.get('/transactions/:transactionId', tokenController.checkTransactionStatus);

// Admin routes
router.post('/packages', restrictTo('super_admin', 'finance'), validateCreatePackage, validate, tokenController.createPackage);
router.put('/packages/:packageId', restrictTo('super_admin', 'finance'), validatePackageId, validateUpdatePackage, validate, tokenController.updatePackage);

module.exports = router;