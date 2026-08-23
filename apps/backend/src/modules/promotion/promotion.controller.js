// src/modules/promotion/promotion.controller.js
const PromotionModel = require('./promotion.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Get all promotion plans
const getPlans = catchAsync(async (req, res) => {
    const plans = await PromotionModel.getPlans();
    ResponseHandler.success(res, { plans });
});

// Get single plan
const getPlan = catchAsync(async (req, res) => {
    const { planId } = req.params;
    const plan = await PromotionModel.getPlan(planId);
    ResponseHandler.success(res, { plan });
});

// Create promotion with M-Pesa
const createWithMpesa = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { planId, content, phoneNumber } = req.body;

    const result = await PromotionModel.createWithMpesa(userId, planId, content, phoneNumber);

    ResponseHandler.success(res, {
        promotion: result.promotion,
        mpesa_transaction_id: result.mpesa_transaction_id
    }, 'Promotion created. Please complete M-Pesa payment.');
});

// Create promotion with tokens
const createWithTokens = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { planId, content } = req.body;

    const promotion = await PromotionModel.createWithTokens(userId, planId, content);

    ResponseHandler.success(res, { promotion }, 'Promotion created successfully');
});

// Get user's promotions
const getMyPromotions = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { status = 'active', limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await PromotionModel.getUserPromotions(userId, status, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.promotions, page, limit, result.total);
});

// Get promotion analytics
const getPromotionAnalytics = catchAsync(async (req, res) => {
    const { promotionId } = req.params;
    const userId = req.user.id;

    const analytics = await PromotionModel.getAnalytics(promotionId, userId);

    ResponseHandler.success(res, { analytics });
});

// Cancel promotion
const cancelPromotion = catchAsync(async (req, res) => {
    const { promotionId } = req.params;
    const userId = req.user.id;

    const promotion = await PromotionModel.cancelPromotion(promotionId, userId);

    ResponseHandler.success(res, { promotion }, 'Promotion cancelled');
});

// Get active promotions (for feed)
const getActivePromotions = catchAsync(async (req, res) => {
    const { limit = 10 } = req.query;
    
    const promotions = await PromotionModel.getActivePromotions(parseInt(limit));
    
    ResponseHandler.success(res, { promotions });
});

// Track impression (called by frontend)
const trackImpression = catchAsync(async (req, res) => {
    const { promotionId } = req.params;
    const userId = req.user?.id;

    await PromotionModel.trackImpression(promotionId, userId, req);

    ResponseHandler.success(res, null, 'Impression tracked');
});

// Track click (called by frontend)
const trackClick = catchAsync(async (req, res) => {
    const { promotionId } = req.params;
    const userId = req.user?.id;

    await PromotionModel.trackClick(promotionId, userId, req);

    ResponseHandler.success(res, null, 'Click tracked');
});

// Admin: Get all promotions
const getAllPromotions = catchAsync(async (req, res) => {
    const { user_id, status, limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const filters = { user_id, status };
    const result = await PromotionModel.getAllPromotions(filters, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.promotions, page, limit, result.total);
});

// Admin: Get promotion stats
const getPromotionStats = catchAsync(async (req, res) => {
    const stats = await PromotionModel.getStats();
    ResponseHandler.success(res, { stats });
});

module.exports = {
    getPlans,
    getPlan,
    createWithMpesa,
    createWithTokens,
    getMyPromotions,
    getPromotionAnalytics,
    cancelPromotion,
    getActivePromotions,
    trackImpression,
    trackClick,
    getAllPromotions,
    getPromotionStats
};