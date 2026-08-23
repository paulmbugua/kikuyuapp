// src/modules/commission/commission.routes.js
const express = require('express');
const router = express.Router();
const commissionController = require('./commission.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');

// Public routes (limited info)
router.get('/configs', commissionController.getConfigs);
router.get('/configs/:transactionType', commissionController.getConfigByType);

// Protected routes (all staff)
router.use(protect);
router.use(restrictTo('super_admin', 'platform_admin', 'finance'));

router.get('/transactions', commissionController.getTransactions);
router.get('/summary', commissionController.getSummary);
router.get('/daily', commissionController.getDailyTotals);
router.get('/earnings/total', commissionController.getTotalEarnings);
router.post('/calculate', commissionController.calculateCommission);

// Super admin only
router.post('/configs', restrictTo('super_admin'), commissionController.createConfig);
router.put('/configs/:configId', restrictTo('super_admin'), commissionController.updateConfig);

module.exports = router;