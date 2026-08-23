// src/modules/verification/verification.controller.js
const VerificationModel = require('./verification.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');

// Get all verification plans
const getPlans = catchAsync(async (req, res) => {
    const plans = await VerificationModel.getPlans();
    ResponseHandler.success(res, { plans });
});

// Get single plan
const getPlan = catchAsync(async (req, res) => {
    const { planId } = req.params;
    const plan = await VerificationModel.getPlan(planId);
    ResponseHandler.success(res, { plan });
});

// Purchase verification with M-Pesa
const purchaseWithMpesa = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { planId, phoneNumber } = req.body;

    const result = await VerificationModel.purchaseWithMpesa(userId, planId, phoneNumber);

    ResponseHandler.success(res, {
        verification: result.verification,
        mpesa_transaction_id: result.mpesa_transaction_id
    }, 'Verification purchase initiated. Please complete M-Pesa payment.');
});

// Purchase verification with tokens
const purchaseWithTokens = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { planId } = req.body;

    const verification = await VerificationModel.purchaseWithTokens(userId, planId);

    ResponseHandler.success(res, { verification }, 'Verification purchased successfully with tokens');
});

// Get user's verification status
const getMyVerification = catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    const verification = await VerificationModel.getUserVerification(userId);
    
    ResponseHandler.success(res, { verification: verification || { is_verified: false } });
});

// Get user's verification history
const getMyHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const history = await VerificationModel.getHistory(userId, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, history.history, page, limit, history.total);
});

// Auto-renew verification
const autoRenew = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const verification = await VerificationModel.autoRenew(userId);

    ResponseHandler.success(res, { verification }, 'Verification auto-renewed successfully');
});

// Cancel auto-renew
const cancelAutoRenew = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const verification = await VerificationModel.cancelAutoRenew(userId);

    ResponseHandler.success(res, { verification }, 'Auto-renew cancelled');
});

// Admin: Grant verification
const grantVerification = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const staffId = req.user.id;
    const { planId, reason } = req.body;

    const verification = await VerificationModel.grantVerification(userId, staffId, planId, reason);

    ResponseHandler.success(res, { verification }, 'Verification granted successfully');
});

// Admin: Revoke verification
const revokeVerification = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const staffId = req.user.id;
    const { reason } = req.body;

    const verification = await VerificationModel.revokeVerification(userId, staffId, reason);

    ResponseHandler.success(res, { verification }, 'Verification revoked successfully');
});

// Admin: Get verification stats
const getVerificationStats = catchAsync(async (req, res) => {
    const stats = await VerificationModel.getStats();
    ResponseHandler.success(res, { stats });
});

// Admin: Get all verifications
const getAllVerifications = catchAsync(async (req, res) => {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    // Implement admin view of all verifications
    const query = `
        SELECT 
            uv.*,
            u.username,
            u.email,
            vp.name as plan_name
        FROM user_verifications uv
        JOIN users u ON uv.user_id = u.id
        JOIN verification_plans vp ON uv.plan_id = vp.id
        ORDER BY uv.created_at DESC
        LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) FROM user_verifications');
    const total = parseInt(countResult.rows[0].count);

    ResponseHandler.paginated(res, result.rows, page, limit, total);
});

module.exports = {
    getPlans,
    getPlan,
    purchaseWithMpesa,
    purchaseWithTokens,
    getMyVerification,
    getMyHistory,
    autoRenew,
    cancelAutoRenew,
    grantVerification,
    revokeVerification,
    getVerificationStats,
    getAllVerifications
};