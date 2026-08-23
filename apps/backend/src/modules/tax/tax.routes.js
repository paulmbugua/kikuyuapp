// src/modules/tax/tax.routes.js
const express = require('express');
const router = express.Router();
const taxController = require('./tax.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');

// Public routes (limited info)
router.get('/configs', taxController.getConfigs);
router.get('/configs/:taxType', taxController.getConfigByType);

// Protected routes (users)
router.use(protect);

router.get('/user/me', taxController.getUserTaxInfo);
router.put('/user/me', taxController.updateUserTaxInfo);
router.get('/user/:userId', restrictTo('super_admin', 'platform_admin'), taxController.getUserTaxInfo);

// Finance team routes
router.get('/transactions', restrictTo('super_admin', 'platform_admin', 'finance'), taxController.getTransactions);
router.get('/summary', restrictTo('super_admin', 'platform_admin', 'finance'), taxController.getSummary);
router.get('/liability', restrictTo('super_admin', 'platform_admin', 'finance'), taxController.getTaxLiability);
router.get('/creator/:userId', restrictTo('super_admin', 'platform_admin', 'finance'), taxController.getCreatorTaxSummary);

// Super admin only
router.post('/configs', restrictTo('super_admin'), taxController.createConfig);
router.put('/configs/:configId', restrictTo('super_admin'), taxController.updateConfig);
router.post('/reports/generate', restrictTo('super_admin'), taxController.generateTaxReport);
router.put('/reports/:reportId/file', restrictTo('super_admin'), taxController.markReportAsFiled);

module.exports = router;