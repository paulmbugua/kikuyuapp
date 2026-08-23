const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const { validateNotificationId } = require('./notification.validation');

// All routes require authentication
router.use(protect);

// Get notifications
router.get('/', notificationController.getNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.get('/stats', notificationController.getStats);

// Mark as read
router.put('/:notificationId/read', validateNotificationId, validate, notificationController.markAsRead);
router.put('/read/all', notificationController.markAllAsRead);

// Delete notifications
router.delete('/:notificationId', validateNotificationId, validate, notificationController.deleteNotification);
router.delete('/', notificationController.deleteAllNotifications);
router.post('/test', notificationController.createTestNotification);

module.exports = router;