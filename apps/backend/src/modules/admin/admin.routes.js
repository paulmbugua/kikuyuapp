// src/modules/admin/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validateUserId,
    validateContentType,
    validateModeration,
    validateBanUser,
    validateCreateStaff,
    validateUpdateStaffRole,
    validateSettings,
    validateAnalyticsPeriod
} = require('./admin.validation');

// All admin routes require authentication and staff role
router.use(protect);
router.use(restrictTo('super_admin', 'platform_admin', 'moderator', 'finance', 'analytics'));

// ==================== DASHBOARD ====================
router.get('/dashboard', adminController.getDashboard);
router.get('/health', restrictTo('super_admin'), adminController.getSystemHealth);

// ==================== USER MANAGEMENT ====================
router.get('/users', 
    restrictTo('super_admin', 'platform_admin', 'moderator'), 
    adminController.getUsers
);

router.get('/users/:userId', 
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    validateUserId,
    validate,
    adminController.getUserDetails
);

router.put('/users/:userId',
    restrictTo('super_admin', 'platform_admin'),
    validateUserId,
    validate,
    adminController.updateUser
);

router.delete('/users/:userId',
    restrictTo('super_admin'),
    validateUserId,
    validate,
    adminController.deleteUser
);

// ==================== CONTENT MANAGEMENT ====================
router.get('/posts',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    adminController.getPosts
);

router.get('/videos',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    adminController.getVideos
);

router.delete('/content/:contentType/:contentId',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    validateContentType,
    validate,
    adminController.deleteContent
);

// ==================== MODERATION ====================
router.get('/moderation/queue',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    adminController.getModerationQueue
);

router.post('/moderation/:itemId',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    validateModeration,
    validate,
    adminController.moderateContent
);

router.get('/reports',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    adminController.getReports
);

router.post('/reports/:reportId/resolve',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    adminController.resolveReport
);

// ==================== BANNED USERS ====================
router.get('/banned-users',
    restrictTo('super_admin', 'platform_admin', 'moderator'),
    adminController.getBannedUsers
);

router.post('/users/:userId/ban',
    restrictTo('super_admin', 'platform_admin'),
    validateUserId,
    validateBanUser,
    validate,
    adminController.banUser
);

router.post('/users/:userId/unban',
    restrictTo('super_admin', 'platform_admin'),
    validateUserId,
    validate,
    adminController.unbanUser
);

// ==================== STAFF MANAGEMENT ====================
// Staff management is super_admin only
router.use('/staff', restrictTo('super_admin'));

router.get('/staff', adminController.getStaff);
router.post('/staff', validateCreateStaff, validate, adminController.createStaff);
router.put('/staff/:staffId/role', validateUpdateStaffRole, validate, adminController.updateStaffRole);
router.put('/staff/:staffId/toggle', adminController.toggleStaffActive);
router.post('/staff/:staffId/reset-password', adminController.resetStaffPassword);
router.get('/staff/:staffId/logs', adminController.getStaffLogs);
router.get('/logs/all', adminController.getAllActivityLogs);

// ==================== SYSTEM SETTINGS ====================
// Settings management (different permission levels)
router.get('/settings',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    adminController.getSettings
);

router.get('/settings/:key',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    adminController.getSetting
);

router.put('/settings/:key',
    restrictTo('super_admin', 'platform_admin'),
    validateSettings,
    validate,
    adminController.updateSetting
);

router.post('/settings/bulk',
    restrictTo('super_admin'),
    adminController.updateSettings
);

// ==================== ANALYTICS ====================
// Analytics routes (accessible by analytics role)
router.get('/analytics/users',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    validateAnalyticsPeriod,
    validate,
    adminController.getUserAnalytics
);

router.get('/analytics/content',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    validateAnalyticsPeriod,
    validate,
    adminController.getContentAnalytics
);

router.get('/analytics/tokens',
    restrictTo('super_admin', 'platform_admin', 'finance', 'analytics'),
    validateAnalyticsPeriod,
    validate,
    adminController.getTokenAnalytics
);

router.get('/analytics/moderation',
    restrictTo('super_admin', 'platform_admin', 'moderator', 'analytics'),
    validateAnalyticsPeriod,
    validate,
    adminController.getModerationAnalytics
);

router.get('/analytics/top-creators',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    adminController.getTopCreators
);

router.get('/analytics/devices',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    adminController.getDeviceAnalytics
);

router.get('/analytics/export',
    restrictTo('super_admin', 'platform_admin', 'analytics'),
    adminController.exportAnalyticsReport
);

module.exports = router;