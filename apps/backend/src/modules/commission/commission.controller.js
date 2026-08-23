// src/modules/commission/commission.controller.js
const CommissionModel = require('./commission.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Get all commission configs
const getConfigs = catchAsync(async (req, res) => {
    const { active_only = true } = req.query;
    
    const configs = await CommissionModel.getConfigs(active_only === 'true');
    
    ResponseHandler.success(res, { configs });
});

// Get commission config by type
const getConfigByType = catchAsync(async (req, res) => {
    const { transactionType } = req.params;
    
    const config = await CommissionModel.getConfigByType(transactionType);
    
    if (!config) {
        throw new AppError('Commission config not found for this transaction type', 404);
    }
    
    ResponseHandler.success(res, { config });
});

// Create commission config (admin)
const createConfig = catchAsync(async (req, res) => {
    const staffId = req.user.id;
    
    const config = await CommissionModel.createConfig(req.body, staffId);
    
    ResponseHandler.created(res, { config }, 'Commission configuration created successfully');
});

// Update commission config (admin)
const updateConfig = catchAsync(async (req, res) => {
    const { configId } = req.params;
    
    const config = await CommissionModel.updateConfig(configId, req.body);
    
    ResponseHandler.success(res, { config }, 'Commission configuration updated successfully');
});

// Get commission transactions
const getTransactions = catchAsync(async (req, res) => {
    const { 
        user_id, transaction_type, status,
        start_date, end_date,
        limit = 50, page = 1 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const filters = {
        user_id,
        transaction_type,
        status,
        start_date,
        end_date
    };
    
    const result = await CommissionModel.getTransactions(filters, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.transactions, page, limit, result.total);
});

// Get commission summary
const getSummary = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;
    
    const summary = await CommissionModel.getSummary(period);
    
    ResponseHandler.success(res, { summary });
});

// Get daily totals
const getDailyTotals = catchAsync(async (req, res) => {
    const { days = 30 } = req.query;
    
    const totals = await CommissionModel.getDailyTotals(parseInt(days));
    
    ResponseHandler.success(res, { daily_totals: totals });
});

// Get total earnings
const getTotalEarnings = catchAsync(async (req, res) => {
    const earnings = await CommissionModel.getTotalEarnings();
    
    ResponseHandler.success(res, { earnings });
});

// Calculate commission for an amount (utility)
const calculateCommission = catchAsync(async (req, res) => {
    const { amount, transaction_type } = req.body;
    
    const config = await CommissionModel.getConfigByType(transaction_type);
    
    if (!config) {
        throw new AppError('No commission config found for this transaction type', 404);
    }
    
    const calculation = CommissionModel.calculateCommission(amount, config);
    
    ResponseHandler.success(res, { calculation });
});

module.exports = {
    getConfigs,
    getConfigByType,
    createConfig,
    updateConfig,
    getTransactions,
    getSummary,
    getDailyTotals,
    getTotalEarnings,
    calculateCommission
};