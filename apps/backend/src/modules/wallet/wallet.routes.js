// src/modules/wallet/wallet.routes.js
const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validateWithdrawalRequest,
    validateWithdrawalId
} = require('./wallet.validation');

// Protected routes
router.use(protect);

// User routes
router.post('/withdrawals', validateWithdrawalRequest, validate, walletController.requestWithdrawal);
router.get('/withdrawals', walletController.getUserWithdrawals);
router.get('/withdrawals/:withdrawalId', validateWithdrawalId, validate, walletController.getWithdrawal);
router.post('/withdrawals/:withdrawalId/cancel', validateWithdrawalId, validate, walletController.cancelWithdrawal);

// Admin routes
router.get('/admin/withdrawals', restrictTo('super_admin', 'finance'), walletController.getAllWithdrawals);
router.get('/admin/stats', restrictTo('super_admin', 'finance'), walletController.getWithdrawalStats);
router.post('/admin/withdrawals/:withdrawalId/approve', restrictTo('super_admin', 'finance'), validateWithdrawalId, validate, walletController.approveWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/process', restrictTo('super_admin', 'finance'), validateWithdrawalId, validate, walletController.processWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/complete', restrictTo('super_admin', 'finance'), validateWithdrawalId, validate, walletController.completeWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/reject', restrictTo('super_admin', 'finance'), validateWithdrawalId, validate, walletController.rejectWithdrawal);

module.exports = router;