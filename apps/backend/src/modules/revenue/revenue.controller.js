// src/modules/revenue/revenue.controller.js
const RevenueModel = require('./revenue.model');
const ReportsModel = require('../reports/reports.model');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Get platform revenue summary
const getPlatformRevenue = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;
    
    const revenue = await RevenueModel.getPlatformRevenue(period);
    
    ResponseHandler.success(res, { revenue });
});

// Get revenue breakdown
const getRevenueBreakdown = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;
    
    const breakdown = await RevenueModel.getRevenueBreakdown(period);
    
    ResponseHandler.success(res, { breakdown });
});

// Get daily revenue
const getDailyRevenue = catchAsync(async (req, res) => {
    const { days = 30 } = req.query;
    
    const daily = await RevenueModel.getDailyRevenue(parseInt(days));
    
    ResponseHandler.success(res, { daily });
});

// Get creator earnings
const getCreatorEarnings = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { period = '30d' } = req.query;
    
    const earnings = await RevenueModel.getCreatorEarnings(userId, period);
    
    ResponseHandler.success(res, { earnings });
});

// Get all creators earnings (admin)
const getAllCreatorsEarnings = catchAsync(async (req, res) => {
    const { period = '30d', limit = 50, page = 1 } = req.query;
    
    const earnings = await RevenueModel.getCreatorEarnings(null, period);
    
    // Manual pagination
    const start = (page - 1) * limit;
    const paginated = earnings.slice(start, start + parseInt(limit));
    
    ResponseHandler.paginated(res, paginated, page, limit, earnings.length);
});

// Get top earners
const getTopEarners = catchAsync(async (req, res) => {
    const { limit = 10, period = '30d' } = req.query;
    
    const earners = await RevenueModel.getTopEarners(parseInt(limit), period);
    
    ResponseHandler.success(res, { top_earners: earners });
});

// Get revenue projections
const getProjections = catchAsync(async (req, res) => {
    const { months = 3 } = req.query;
    
    const projections = await RevenueModel.getProjections(parseInt(months));
    
    ResponseHandler.success(res, { projections });
});

// Get revenue by segment
const getRevenueBySegment = catchAsync(async (req, res) => {
    const segments = await RevenueModel.getRevenueBySegment();
    
    ResponseHandler.success(res, { segments });
});

// Get hourly pattern
const getHourlyPattern = catchAsync(async (req, res) => {
    const pattern = await RevenueModel.getHourlyPattern();
    
    ResponseHandler.success(res, { hourly_pattern: pattern });
});

// Get weekly pattern
const getWeeklyPattern = catchAsync(async (req, res) => {
    const pattern = await RevenueModel.getWeeklyPattern();
    
    ResponseHandler.success(res, { weekly_pattern: pattern });
});

// Get platform revenue period
const getPlatformRevenuePeriod = catchAsync(async (req, res) => {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }
    
    const revenue = await RevenueModel.getPlatformRevenuePeriod(start_date, end_date);
    
    ResponseHandler.success(res, { revenue });
});

// Generate revenue report
const generateRevenueReport = catchAsync(async (req, res) => {
    const { start_date, end_date, format = 'json' } = req.query;
    
    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }
    
    if (format === 'excel' || format === 'csv') {
        const data = await ReportsModel.generatePlatformRevenueReport(start_date, end_date, format);
        
        res.setHeader('Content-Type', format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=revenue-${start_date}-to-${end_date}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        res.send(data);
    } else {
        const revenue = await RevenueModel.generateRevenueReport(start_date, end_date);
        ResponseHandler.success(res, { revenue });
    }
});

module.exports = {
    getPlatformRevenue,
    getRevenueBreakdown,
    getDailyRevenue,
    getCreatorEarnings,
    getAllCreatorsEarnings,
    getTopEarners,
    getProjections,
    getRevenueBySegment,
    getHourlyPattern,
    getWeeklyPattern,
    getPlatformRevenuePeriod,
    generateRevenueReport
};