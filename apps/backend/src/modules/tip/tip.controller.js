// src/modules/tip/tip.controller.js
const TipModel = require('./tip.model');
const { validateTipAmount } = require('../../utils/currency');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Send a tip
const sendTip = catchAsync(async (req, res) => {
    const senderId = req.user.id;
    const tipData = req.body;
    
    // Validate tip amount
    const validation = validateTipAmount(tipData.amount);
    if (!validation.valid) {
        throw new AppError(validation.message, 400);
    }
    
    const tip = await TipModel.send(senderId, tipData);
    
    // Emit socket event for real-time notification
    const io = req.app.get('io');
    if (io) {
        io.to(`user:${tipData.receiverId}`).emit('tip:received', {
            tip: {
                id: tip.id,
                amount: tip.amount,
                sender: tip.is_anonymous ? { is_anonymous: true } : tip.sender,
                message: tip.message,
                created_at: tip.created_at
            }
        });
    }
    
    ResponseHandler.created(res, { tip }, 'Tip sent successfully');
});

// Get tip by ID
const getTip = catchAsync(async (req, res) => {
    const { tipId } = req.params;
    const userId = req.user.id;
    
    const tip = await TipModel.getTipById(tipId, userId);
    
    ResponseHandler.success(res, { tip });
});

// Get tips sent by user
const getSentTips = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await TipModel.getSentTips(userId, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.tips, page, limit, result.total);
});

// Get tips received by user
const getReceivedTips = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await TipModel.getReceivedTips(userId, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.tips, page, limit, result.total);
});

// Get tips for content
const getContentTips = catchAsync(async (req, res) => {
    const { contentType, contentId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await TipModel.getContentTips(contentType, contentId, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.tips, page, limit, null, { total_amount: result.total_amount });
});

// Get leaderboard
const getLeaderboard = catchAsync(async (req, res) => {
    const { period = 'weekly', limit = 100 } = req.query;
    
    const leaderboard = await TipModel.getLeaderboard(period, parseInt(limit));
    
    ResponseHandler.success(res, { leaderboard });
});

// Get tip statistics
const getTipStats = catchAsync(async (req, res) => {
    const userId = req.query.userId ? req.query.userId : null;
    
    const stats = await TipModel.getStats(userId);
    
    ResponseHandler.success(res, { stats });
});

// Admin: Get tips pending moderation
const getPendingTips = catchAsync(async (req, res) => {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const tips = await TipModel.getPendingModeration(parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, tips, page, limit, null);
});

module.exports = {
    sendTip,
    getTip,
    getSentTips,
    getReceivedTips,
    getContentTips,
    getLeaderboard,
    getTipStats,
    getPendingTips
};