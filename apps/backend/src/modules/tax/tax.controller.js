// src/modules/tax/tax.controller.js
const TaxModel = require('./tax.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');

// Get all tax configs
const getConfigs = catchAsync(async (req, res) => {
    const { active_only = true } = req.query;
    
    const configs = await TaxModel.getConfigs(active_only === 'true');
    
    ResponseHandler.success(res, { configs });
});

// Get tax config by type
const getConfigByType = catchAsync(async (req, res) => {
    const { taxType } = req.params;
    const { country = 'KE' } = req.query;
    
    const config = await TaxModel.getConfigByType(taxType, country);
    
    if (!config) {
        throw new AppError('Tax config not found for this type', 404);
    }
    
    ResponseHandler.success(res, { config });
});

// Create tax config (admin)
const createConfig = catchAsync(async (req, res) => {
    const staffId = req.user.id;
    
    const config = await TaxModel.createConfig(req.body, staffId);
    
    ResponseHandler.created(res, { config }, 'Tax configuration created successfully');
});

// Update tax config (admin)
const updateConfig = catchAsync(async (req, res) => {
    const { configId } = req.params;
    
    const config = await TaxModel.updateConfig(configId, req.body);
    
    ResponseHandler.success(res, { config }, 'Tax configuration updated successfully');
});

// Get tax transactions
const getTransactions = catchAsync(async (req, res) => {
    const { 
        user_id, tax_type, status,
        start_date, end_date,
        limit = 50, page = 1 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const filters = {
        user_id,
        tax_type,
        status,
        start_date,
        end_date
    };
    
    const result = await TaxModel.getTransactions(filters, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, result.transactions, page, limit, result.total);
});

// Get tax summary
const getSummary = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;
    
    const summary = await TaxModel.getSummary(period);
    
    ResponseHandler.success(res, { summary });
});

// Update user tax information
const updateUserTaxInfo = catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    const user = await TaxModel.updateUserTaxInfo(userId, req.body);
    
    ResponseHandler.success(res, { user }, 'Tax information updated successfully');
});

// Get user tax information
const getUserTaxInfo = catchAsync(async (req, res) => {
    const userId = req.params.userId || req.user.id;
    
    const result = await pool.query(
        'SELECT id, username, email, kRA_pin, tax_residency, tax_id, business_registration, tax_exempt FROM users WHERE id = $1',
        [userId]
    );
    
    if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
    }
    
    ResponseHandler.success(res, { tax_info: result.rows[0] });
});

// Generate tax report (admin)
const generateTaxReport = catchAsync(async (req, res) => {
    const { report_type, period_start, period_end } = req.body;
    
    const report = await TaxModel.generateTaxReport(report_type, period_start, period_end);
    
    ResponseHandler.success(res, { report }, 'Tax report generated successfully');
});

// Mark report as filed (admin)
const markReportAsFiled = catchAsync(async (req, res) => {
    const { reportId } = req.params;
    const staffId = req.user.id;
    const { filing_reference } = req.body;
    
    const report = await TaxModel.markReportAsFiled(reportId, staffId, filing_reference);
    
    ResponseHandler.success(res, { report }, 'Tax report marked as filed');
});

// Get tax liability
const getTaxLiability = catchAsync(async (req, res) => {
    const liability = await TaxModel.getTaxLiability();
    
    ResponseHandler.success(res, { liability });
});

// Get creator tax summary
const getCreatorTaxSummary = catchAsync(async (req, res) => {
    const userId = req.params.userId || req.user.id;
    
    const summary = await TaxModel.getCreatorTaxSummary(userId);
    
    ResponseHandler.success(res, { tax_summary: summary });
});

module.exports = {
    getConfigs,
    getConfigByType,
    createConfig,
    updateConfig,
    getTransactions,
    getSummary,
    updateUserTaxInfo,
    getUserTaxInfo,
    generateTaxReport,
    markReportAsFiled,
    getTaxLiability,
    getCreatorTaxSummary
};