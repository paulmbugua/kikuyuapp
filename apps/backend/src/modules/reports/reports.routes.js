// src/modules/reports/reports.routes.js
const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');

// All report routes are protected
router.use(protect);

// User reports
router.get('/my-earnings', reportsController.getUserEarningsReport);

// Staff reports
router.get('/summary', 
    restrictTo('super_admin', 'platform_admin', 'finance', 'analytics'), 
    reportsController.getSummaryStats
);

router.get('/financial-health', 
    restrictTo('super_admin', 'platform_admin', 'finance'), 
    reportsController.getFinancialHealth
);

router.get('/creator-earnings', 
    restrictTo('super_admin', 'platform_admin', 'finance'), 
    reportsController.generateCreatorEarningsReport
);

router.get('/tax', 
    restrictTo('super_admin', 'platform_admin', 'finance'), 
    reportsController.generateTaxReport
);

router.get('/platform-revenue', 
    restrictTo('super_admin', 'platform_admin', 'finance'), 
    reportsController.generatePlatformRevenueReport
);

router.get('/transactions', 
    restrictTo('super_admin', 'platform_admin', 'finance'), 
    reportsController.generateTransactionReport
);

module.exports = router;