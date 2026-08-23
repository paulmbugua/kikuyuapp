const NotificationModel = require('./notification.model');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { AppError } = require('../../middleware/errorMiddleware');
const pool = require('../../config/db');

// Get user's notifications
const getNotifications = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1, filter = 'all' } = req.query;
    const offset = (page - 1) * limit;

    const result = await NotificationModel.getUserNotifications(
        userId, 
        parseInt(limit), 
        parseInt(offset), 
        filter
    );

    ResponseHandler.paginated(res, result.notifications, page, limit, result.total, {
        unreadCount: result.unreadCount,
        hasMore: result.hasMore
    });
});

// Get unread count
const getUnreadCount = catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    // Optimized query using the new index
    const result = await pool.query(
        `SELECT COUNT(*) as count 
         FROM notifications 
         WHERE user_id = $1::UUID AND is_read = false`,
        [userId]
    );
    
    const count = parseInt(result.rows[0].count);
    ResponseHandler.success(res, { unreadCount: count });
});

// Mark notification as read
const markAsRead = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await NotificationModel.markAsRead(notificationId, userId);
    ResponseHandler.success(res, { notification }, 'Notification marked as read');
});

// Mark all notifications as read
const markAllAsRead = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const notifications = await NotificationModel.markAllAsRead(userId);
    ResponseHandler.success(res, { count: notifications.length }, 'All notifications marked as read');
});

// Delete notification
const deleteNotification = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { notificationId } = req.params;

    await NotificationModel.deleteNotification(notificationId, userId);
    ResponseHandler.success(res, null, 'Notification deleted');
});

// Delete all notifications
const deleteAllNotifications = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const deleted = await NotificationModel.deleteAllNotifications(userId);
    ResponseHandler.success(res, { count: deleted.length }, 'All notifications deleted');
});

// Get notification stats
const getStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const stats = await NotificationModel.getStats(userId);
    ResponseHandler.success(res, { stats });
});
const createTestNotification = catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    const testNotification = await NotificationModel.create({
        userId: userId,
        type: 'new_message',
        actorId: userId,
        actorName: req.user.full_name || req.user.username,
        actorAvatarUrl: req.user.avatar_url,
        content: 'This is a test notification from the system',
        referenceId: null,
        referenceType: 'system',
        metadata: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
    });
    
    ResponseHandler.success(res, { notification: testNotification }, 'Test notification created');
});

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getStats,
    createTestNotification // Add this
};