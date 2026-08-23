// src/modules/wallet/wallet.controller.js
const WalletModel = require('./wallet.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Request withdrawal
const requestWithdrawal = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { amount, method, accountDetails } = req.body;
    
    const withdrawal = await WalletModel.requestWithdrawal(userId, amount, method, accountDetails);
    
    ResponseHandler.created(res, { withdrawal }, 'Withdrawal request submitted successfully');
});

// Get user's withdrawals
const getUserWithdrawals = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await WalletModel.getUserWithdrawals(userId, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.withdrawals, page, limit, result.total);
});

// Get single withdrawal
const getWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const userId = req.user.id;
    
    const withdrawal = await WalletModel.getWithdrawal(withdrawalId, userId);
    
    ResponseHandler.success(res, { withdrawal });
});

// Cancel withdrawal
const cancelWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const userId = req.user.id;
    
    const withdrawal = await WalletModel.cancelWithdrawal(withdrawalId, userId);
    
    ResponseHandler.success(res, { withdrawal }, 'Withdrawal cancelled successfully');
});

// Admin: Get all withdrawals
const getAllWithdrawals = catchAsync(async (req, res) => {
    const { status, limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await WalletModel.getAllWithdrawals(status, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.withdrawals, page, limit, result.total);
});

// Admin: Approve withdrawal
const approveWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const adminId = req.user.id;
    const { notes } = req.body;
    
    const withdrawal = await WalletModel.approveWithdrawal(withdrawalId, adminId, notes);
    
    ResponseHandler.success(res, { withdrawal }, 'Withdrawal approved');
});

// Admin: Process withdrawal
const processWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const adminId = req.user.id;
    
    const withdrawal = await WalletModel.processWithdrawal(withdrawalId, adminId);
    
    ResponseHandler.success(res, { withdrawal }, 'Withdrawal marked as processing');
});

// Admin: Complete withdrawal
const completeWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const adminId = req.user.id;
    const { transactionReference } = req.body;
    
    const withdrawal = await WalletModel.completeWithdrawal(withdrawalId, adminId, transactionReference);
    
    ResponseHandler.success(res, { withdrawal }, 'Withdrawal completed');
});

// Admin: Reject withdrawal
const rejectWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const adminId = req.user.id;
    const { reason } = req.body;
    
    const withdrawal = await WalletModel.rejectWithdrawal(withdrawalId, adminId, reason);
    
    ResponseHandler.success(res, { withdrawal }, 'Withdrawal rejected');
});

// Admin: Get withdrawal statistics
const getWithdrawalStats = catchAsync(async (req, res) => {
    const { period = 'month' } = req.query;
    
    const stats = await WalletModel.getWithdrawalStats(period);
    
    ResponseHandler.success(res, { stats });
});

module.exports = {
    requestWithdrawal,
    getUserWithdrawals,
    getWithdrawal,
    cancelWithdrawal,
    getAllWithdrawals,
    approveWithdrawal,
    processWithdrawal,
    completeWithdrawal,
    rejectWithdrawal,
    getWithdrawalStats
};