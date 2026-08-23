// src/jobs/cleanupOfflineNotifications.js
const pool = require('../config/db');
const logger = require('../utils/logger');

// Clean up old delivered notifications (older than 7 days)
const cleanupOldOfflineNotifications = async () => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const result = await pool.query(
            `DELETE FROM offline_notifications 
             WHERE delivered_at IS NOT NULL 
             AND delivered_at < $1
             RETURNING id`,
            [sevenDaysAgo]
        );
        
        if (result.rowCount > 0) {
            logger.info(`Cleaned up ${result.rowCount} old delivered offline notifications`);
        }
    } catch (error) {
        logger.error('Error cleaning up offline notifications:', error);
    }
};

// Run cleanup every day
if (process.env.NODE_ENV === 'production') {
    setInterval(cleanupOldOfflineNotifications, 24 * 60 * 60 * 1000);
}

module.exports = { cleanupOldOfflineNotifications };