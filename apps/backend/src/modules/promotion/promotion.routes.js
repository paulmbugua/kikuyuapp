// src/modules/promotion/promotion.routes.js
const express = require('express');
const router = express.Router();
const promotionController = require('./promotion.controller');
const { protect, restrictTo, optionalAuth } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validatePlanId,
    validateCreatePromotion,
    validatePromotionId
} = require('./promotion.validation');

// Public routes
router.get('/plans', promotionController.getPlans);
router.get('/plans/:planId', validatePlanId, validate, promotionController.getPlan);
router.get('/active', promotionController.getActivePromotions);

// Protected routes
router.use(protect);

// User routes
router.get('/my-promotions', promotionController.getMyPromotions);
router.post('/create/mpesa', validateCreatePromotion, validate, promotionController.createWithMpesa);
router.post('/create/tokens', validateCreatePromotion, validate, promotionController.createWithTokens);
router.get('/:promotionId/analytics', validatePromotionId, validate, promotionController.getPromotionAnalytics);
router.delete('/:promotionId/cancel', validatePromotionId, validate, promotionController.cancelPromotion);

// Tracking routes (can be called by frontend)
router.post('/:promotionId/impression', optionalAuth, validatePromotionId, validate, promotionController.trackImpression);
router.post('/:promotionId/click', optionalAuth, validatePromotionId, validate, promotionController.trackClick);

// Admin routes
router.get('/admin/all', restrictTo('super_admin', 'platform_admin', 'finance'), promotionController.getAllPromotions);
router.get('/admin/stats', restrictTo('super_admin', 'platform_admin', 'finance'), promotionController.getPromotionStats);

module.exports = router;