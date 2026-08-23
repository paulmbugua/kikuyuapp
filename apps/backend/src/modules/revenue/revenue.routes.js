// src/modules/revenue/revenue.routes.js
const express = require('express');
const router = express.Router();
const revenueController = require('./revenue.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');

// All revenue routes are protected (staff only)
router.use(protect);
router.use(restrictTo('super_admin', 'platform_admin', 'finance', 'analytics'));

router.get('/platform', revenueController.getPlatformRevenue);
router.get('/breakdown', revenueController.getRevenueBreakdown);
router.get('/daily', revenueController.getDailyRevenue);
router.get('/projections', revenueController.getProjections);
router.get('/segments', revenueController.getRevenueBySegment);
router.get('/patterns/hourly', revenueController.getHourlyPattern);
router.get('/patterns/weekly', revenueController.getWeeklyPattern);
router.get('/period', revenueController.getPlatformRevenuePeriod);
router.get('/creators', revenueController.getAllCreatorsEarnings);
router.get('/creators/top', revenueController.getTopEarners);
router.get('/creators/:userId', revenueController.getCreatorEarnings);
router.get('/report', revenueController.generateRevenueReport);

module.exports = router;