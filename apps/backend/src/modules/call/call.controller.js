// src/modules/call/call.controller.js
const CallModel = require('./call.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Get call history
const getCallHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const calls = await CallModel.getHistory(userId, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, calls, page, limit, null);
});

// Get single call
const getCall = catchAsync(async (req, res) => {
    const { callId } = req.params;
    const userId = req.user.id;

    const call = await CallModel.getCall(callId, userId);

    ResponseHandler.success(res, { call });
});

// Get call statistics
const getCallStats = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const stats = await CallModel.getUserStats(userId);

    ResponseHandler.success(res, { stats });
});

// End call (HTTP fallback)
const endCall = catchAsync(async (req, res) => {
    const { callId } = req.params;
    const userId = req.user.id;

    const call = await CallModel.end(callId, userId);

    ResponseHandler.success(res, { call }, 'Call ended');
});

// Rate call quality
const rateCallQuality = catchAsync(async (req, res) => {
    const { callId } = req.params;
    const userId = req.user.id;
    const { quality_score, avg_bitrate, packet_loss, latency } = req.body;

    // Verify user was in the call
    const call = await CallModel.getCall(callId, userId);
    
    if (!call) {
        throw new AppError('Call not found', 404);
    }

    const updated = await CallModel.updateQuality(callId, {
        quality_score,
        avg_bitrate,
        packet_loss,
        latency
    });

    ResponseHandler.success(res, { call: updated }, 'Call quality rated');
});

module.exports = {
    getCallHistory,
    getCall,
    getCallStats,
    endCall,
    rateCallQuality
};