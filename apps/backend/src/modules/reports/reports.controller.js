// src/modules/reports/reports.controller.js
const ReportsModel = require('./reports.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Generate creator earnings report
const generateCreatorEarningsReport = catchAsync(async (req, res) => {
    const { start_date, end_date, format = 'json' } = req.query;
    
    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }
    
    if (format === 'excel' || format === 'csv') {
        const data = await ReportsModel.generateCreatorEarningsReport(start_date, end_date, format);
        
        res.setHeader('Content-Type', format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=creator-earnings-${start_date}-to-${end_date}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        res.send(data);
    } else {
        const report = await ReportsModel.generateCreatorEarningsReport(start_date, end_date);
        ResponseHandler.success(res, { report });
    }
});

// Generate tax report
const generateTaxReport = catchAsync(async (req, res) => {
    const { report_type, start_date, end_date, format = 'json' } = req.query;
    
    if (!report_type || !start_date || !end_date) {
        throw new AppError('Report type, start date, and end date are required', 400);
    }
    
    if (format === 'excel' || format === 'csv') {
        const data = await ReportsModel.generateTaxReport(report_type, start_date, end_date, format);
        
        res.setHeader('Content-Type', format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${report_type}-tax-${start_date}-to-${end_date}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        res.send(data);
    } else {
        const report = await ReportsModel.generateTaxReport(report_type, start_date, end_date);
        ResponseHandler.success(res, { report });
    }
});

// Generate platform revenue report
const generatePlatformRevenueReport = catchAsync(async (req, res) => {
    const { start_date, end_date, format = 'json' } = req.query;
    
    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }
    
    if (format === 'excel' || format === 'csv') {
        const data = await ReportsModel.generatePlatformRevenueReport(start_date, end_date, format);
        
        res.setHeader('Content-Type', format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=platform-revenue-${start_date}-to-${end_date}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        res.send(data);
    } else {
        const report = await ReportsModel.generatePlatformRevenueReport(start_date, end_date);
        ResponseHandler.success(res, { report });
    }
});

// Generate transaction report
const generateTransactionReport = catchAsync(async (req, res) => {
    const { start_date, end_date, type = 'all', format = 'json' } = req.query;
    
    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }
    
    if (format === 'excel' || format === 'csv') {
        const data = await ReportsModel.generateTransactionReport(start_date, end_date, type, format);
        
        res.setHeader('Content-Type', format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions-${start_date}-to-${end_date}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        res.send(data);
    } else {
        const report = await ReportsModel.generateTransactionReport(start_date, end_date, type);
        ResponseHandler.success(res, { report });
    }
});

// Generate user earnings report
const getUserEarningsReport = catchAsync(async (req, res) => {
    const { start_date, end_date, format = 'json' } = req.query;
    const userId = req.params.userId || req.user.id;
    
    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }
    
    if (format === 'excel' || format === 'csv') {
        const data = await ReportsModel.getUserEarningsReport(userId, start_date, end_date, format);
        
        res.setHeader('Content-Type', format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=my-earnings-${start_date}-to-${end_date}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        res.send(data);
    } else {
        const report = await ReportsModel.getUserEarningsReport(userId, start_date, end_date);
        ResponseHandler.success(res, { report });
    }
});

// Get summary stats
const getSummaryStats = catchAsync(async (req, res) => {
    const stats = await ReportsModel.getSummaryStats();
    
    ResponseHandler.success(res, { stats });
});

// Get financial health
const getFinancialHealth = catchAsync(async (req, res) => {
    const health = await ReportsModel.getFinancialHealth();
    
    ResponseHandler.success(res, { financial_health: health });
});

module.exports = {
    generateCreatorEarningsReport,
    generateTaxReport,
    generatePlatformRevenueReport,
    generateTransactionReport,
    getUserEarningsReport,
    getSummaryStats,
    getFinancialHealth
};