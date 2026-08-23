// src/modules/admin/admin.controller.js
const AdminModel = require('./admin.model');
const StaffModel = require('../staff/staff.model');
const AnalyticsModel = require('../analytics/analytics.model');
const ModerationModel = require('../moderation/moderation.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { exportToExcel } = require('../../utils/excelExport');
const pool = require('../../config/db');

// ==================== DASHBOARD ====================

// Get admin dashboard overview
const getDashboard = catchAsync(async (req, res) => {
    const overview = await AnalyticsModel.getDashboardOverview();
    const userGrowth = await AnalyticsModel.getUserGrowth('30d');
    const contentStats = await AnalyticsModel.getContentAnalytics('7d');
    const tokenStats = await AnalyticsModel.getTokenAnalytics('7d');

    ResponseHandler.success(res, {
        overview,
        user_growth: userGrowth,
        content: contentStats,
        tokens: tokenStats
    });
});

// Get system health status
const getSystemHealth = catchAsync(async (req, res) => {
    const health = await AdminModel.getSystemHealth();
    ResponseHandler.success(res, { health });
});

// ==================== USER MANAGEMENT ====================

// Get all users with filters
const getUsers = catchAsync(async (req, res) => {
    const { 
        search, status, verified, role,
        start_date, end_date,
        limit = 50, page = 1, sort = '-created_at' 
    } = req.query;

    const filters = {
        search,
        status,
        verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
        role,
        start_date,
        end_date,
        sort
    };

    const offset = (page - 1) * limit;
    const result = await AdminModel.getUsers(filters, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.users, page, limit, result.total);
});

// Get single user details (admin view)
const getUserDetails = catchAsync(async (req, res) => {
    const { userId } = req.params;
    
    const user = await AdminModel.getUserDetails(userId);
    
    ResponseHandler.success(res, { user });
});

// Update user (admin)
const updateUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const staffId = req.user.id;
    const updates = req.body;

    const user = await AdminModel.updateUser(userId, staffId, updates);

    ResponseHandler.success(res, { user }, 'User updated successfully');
});

// Delete user (admin)
const deleteUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const staffId = req.user.id;

    await AdminModel.deleteUser(userId, staffId);

    ResponseHandler.success(res, null, 'User deleted successfully');
});

// ==================== CONTENT MANAGEMENT ====================

// Get all posts (admin view)
const getPosts = catchAsync(async (req, res) => {
    const { 
        user_id, status, start_date, end_date,
        limit = 50, page = 1, sort = '-created_at' 
    } = req.query;

    const filters = {
        user_id,
        status,
        start_date,
        end_date,
        sort
    };

    const offset = (page - 1) * limit;
    const result = await AdminModel.getPosts(filters, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.posts, page, limit, result.total);
});

// Get all videos (admin view)
const getVideos = catchAsync(async (req, res) => {
    const { 
        user_id, status, moderation_status,
        limit = 50, page = 1, sort = '-created_at' 
    } = req.query;

    const filters = {
        user_id,
        status,
        moderation_status,
        sort
    };

    const offset = (page - 1) * limit;
    const result = await AdminModel.getVideos(filters, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.videos, page, limit, result.total);
});

// Delete content (admin)
const deleteContent = catchAsync(async (req, res) => {
    const { contentType, contentId } = req.params;
    const staffId = req.user.id;

    await AdminModel.deleteContent(contentType, contentId, staffId);

    ResponseHandler.success(res, null, `${contentType} deleted successfully`);
});

// ==================== MODERATION ====================

// Get moderation queue
const getModerationQueue = catchAsync(async (req, res) => {
    const { status = 'pending', limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await ModerationModel.getModerationQueue(status, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.items, page, limit, result.total);
});

// Moderate content
const moderateContent = catchAsync(async (req, res) => {
    const { itemId } = req.params;
    const staffId = req.user.id;
    const { action, notes } = req.body;

    const result = await ModerationModel.moderate(itemId, staffId, action, notes);

    ResponseHandler.success(res, result, `Content ${action}d successfully`);
});

// Get pending reports
const getReports = catchAsync(async (req, res) => {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await ModerationModel.getPendingReports(parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.reports, page, limit, result.total);
});

// Resolve report
const resolveReport = catchAsync(async (req, res) => {
    const { reportId } = req.params;
    const staffId = req.user.id;
    const { resolution, notes } = req.body;

    const report = await ModerationModel.resolveReport(reportId, staffId, resolution, notes);

    ResponseHandler.success(res, { report }, 'Report resolved');
});

// ==================== BANNED USERS ====================

// Get banned users
const getBannedUsers = catchAsync(async (req, res) => {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await ModerationModel.getBannedUsers(parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.banned_users, page, limit, result.total);
});

// Ban user
const banUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const staffId = req.user.id;
    const { reason, duration, expires_at } = req.body;

    const ban = await ModerationModel.banUser(userId, staffId, reason, duration, expires_at);

    ResponseHandler.success(res, { ban }, 'User banned successfully');
});

// Unban user
const unbanUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const staffId = req.user.id;

    const result = await ModerationModel.unbanUser(userId, staffId);

    ResponseHandler.success(res, result, 'User unbanned successfully');
});

// ==================== STAFF MANAGEMENT ====================

// Get all staff
const getStaff = catchAsync(async (req, res) => {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await StaffModel.getAllWithDetails(parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.staff, page, limit, result.total);
});

// Create staff
const createStaff = catchAsync(async (req, res) => {
    const staffData = req.body;
    const createdBy = req.user.id;

    const staff = await StaffModel.create(staffData, createdBy);

    ResponseHandler.created(res, { staff }, 'Staff created successfully');
});

// Update staff role
const updateStaffRole = catchAsync(async (req, res) => {
    const { staffId } = req.params;
    const { roleId } = req.body;
    const updatedBy = req.user.id;

    const staff = await StaffModel.updateRole(staffId, roleId, updatedBy);

    ResponseHandler.success(res, { staff }, 'Staff role updated');
});

// Toggle staff active status
const toggleStaffActive = catchAsync(async (req, res) => {
    const { staffId } = req.params;
    const { isActive } = req.body;
    const updatedBy = req.user.id;

    const staff = await StaffModel.toggleActive(staffId, updatedBy, isActive);

    ResponseHandler.success(res, { staff }, `Staff ${isActive ? 'activated' : 'deactivated'} successfully`);
});

// Reset staff password
const resetStaffPassword = catchAsync(async (req, res) => {
    const { staffId } = req.params;
    const { newPassword } = req.body;
    const resetBy = req.user.id;

    const { hashPassword } = require('../../utils/passwordUtils');
    const hashedPassword = await hashPassword(newPassword);

    await StaffModel.resetPassword(staffId, hashedPassword, resetBy);

    ResponseHandler.success(res, null, 'Password reset successfully');
});

// Get staff activity logs
const getStaffLogs = catchAsync(async (req, res) => {
    const { staffId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await StaffModel.getActivityLog(staffId, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.logs, page, limit, result.total);
});

// Get all admin activity logs
const getAllActivityLogs = catchAsync(async (req, res) => {
    const { 
        staff_id, action, entity_type,
        start_date, end_date,
        limit = 50, page = 1 
    } = req.query;
    const offset = (page - 1) * limit;

    const filters = {
        staff_id,
        action,
        entity_type,
        start_date,
        end_date
    };

    const result = await StaffModel.getAllActivityLogs(filters, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, result.logs, page, limit, result.total);
});

// ==================== SYSTEM SETTINGS ====================

// Get all settings
const getSettings = catchAsync(async (req, res) => {
    const { public_only = false } = req.query;

    const settings = await AdminModel.getSettings(public_only === 'true');

    ResponseHandler.success(res, { settings });
});

// Get setting by key
const getSetting = catchAsync(async (req, res) => {
    const { key } = req.params;

    const setting = await AdminModel.getSetting(key);

    ResponseHandler.success(res, { setting });
});

// Update setting
const updateSetting = catchAsync(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const staffId = req.user.id;

    const setting = await AdminModel.updateSetting(key, value, staffId);

    ResponseHandler.success(res, { setting }, 'Setting updated successfully');
});

// Update multiple settings
const updateSettings = catchAsync(async (req, res) => {
    const { settings } = req.body;
    const staffId = req.user.id;

    const results = await AdminModel.updateSettings(settings, staffId);

    ResponseHandler.success(res, { updated: results.length }, 'Settings updated successfully');
});

// ==================== ANALYTICS ====================

// Get user analytics
const getUserAnalytics = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;

    const data = await AnalyticsModel.getUserGrowth(period);
    const geographic = await AnalyticsModel.getGeographicDistribution();

    ResponseHandler.success(res, {
        growth: data,
        geographic
    });
});

// Get content analytics
const getContentAnalytics = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;

    const content = await AnalyticsModel.getContentAnalytics(period);
    const engagement = await AnalyticsModel.getEngagementMetrics(period);
    const hourly = await AnalyticsModel.getHourlyActivity();

    ResponseHandler.success(res, {
        content,
        engagement,
        hourly_activity: hourly
    });
});

// Get token analytics
const getTokenAnalytics = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;

    const tokens = await AnalyticsModel.getTokenAnalytics(period);

    ResponseHandler.success(res, { tokens });
});

// Get moderation analytics
const getModerationAnalytics = catchAsync(async (req, res) => {
    const { period = '30d' } = req.query;

    const moderation = await AnalyticsModel.getModerationAnalytics(period);

    ResponseHandler.success(res, { moderation });
});

// Get top creators
const getTopCreators = catchAsync(async (req, res) => {
    const { limit = 10, period = '30d' } = req.query;

    const creators = await AnalyticsModel.getTopCreators(parseInt(limit), period);

    ResponseHandler.success(res, { creators });
});

// Get device analytics
const getDeviceAnalytics = catchAsync(async (req, res) => {
    const devices = await AnalyticsModel.getDeviceAnalytics();

    ResponseHandler.success(res, { devices });
});

// Export analytics report
const exportAnalyticsReport = catchAsync(async (req, res) => {
    const { start_date, end_date, format = 'json' } = req.query;

    if (!start_date || !end_date) {
        throw new AppError('Start date and end date are required', 400);
    }

    const report = await AnalyticsModel.getFullReport(start_date, end_date);

    if (format === 'excel') {
        const excelBuffer = await exportToExcel(report.daily, 'Daily Stats');
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${start_date}-to-${end_date}.xlsx`);
        res.send(excelBuffer);
    } else {
        ResponseHandler.success(res, { report });
    }
});

module.exports = {
    // Dashboard
    getDashboard,
    getSystemHealth,
    
    // User management
    getUsers,
    getUserDetails,
    updateUser,
    deleteUser,
    
    // Content management
    getPosts,
    getVideos,
    deleteContent,
    
    // Moderation
    getModerationQueue,
    moderateContent,
    getReports,
    resolveReport,
    
    // Banned users
    getBannedUsers,
    banUser,
    unbanUser,
    
    // Staff management
    getStaff,
    createStaff,
    updateStaffRole,
    toggleStaffActive,
    resetStaffPassword,
    getStaffLogs,
    getAllActivityLogs,
    
    // System settings
    getSettings,
    getSetting,
    updateSetting,
    updateSettings,
    
    // Analytics
    getUserAnalytics,
    getContentAnalytics,
    getTokenAnalytics,
    getModerationAnalytics,
    getTopCreators,
    getDeviceAnalytics,
    exportAnalyticsReport
};