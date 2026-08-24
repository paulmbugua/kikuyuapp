// src/cron/jobs.js
const cron = require('node-cron');
const pool = require('../config/db');
const logger = require('../utils/logger');

const setupDailyJobs = () => {
    
    // ✅ Presence cleanup - every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            logger.debug('🧹 Running presence cleanup...');
            
            const result = await pool.query(`
            WITH updated AS (
                UPDATE user_presence
                SET status = 'offline',
                    socket_id = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE updated_at < NOW() - INTERVAL '5 minutes'
                    AND status != 'offline'
                RETURNING 1
            )
            SELECT COUNT(*)::INTEGER AS updated_count FROM updated
            `);

            const cleaned = parseInt(result.rows[0]?.updated_count || 0);
            
            if (cleaned > 0) {
                logger.info(`🧹 Cleaned up ${cleaned} stale presence records`);
            }
        } catch (error) {
            logger.error('❌ Presence cleanup failed:', error.message);
        }
    });

    // ✅ Expire verifications (12 AM)
    cron.schedule('0 0 * * *', async () => {
        try {
            logger.info('Running verification expiration job...');
            await pool.query('SELECT expire_verifications()');
            logger.info('Verification expiration job completed');
        } catch (error) {
            logger.error('Verification expiration job failed:', error);
        }
    });

    // ✅ Daily stats (1 AM)
    cron.schedule('0 1 * * *', async () => {
        try {
            logger.info('Running daily stats generation...');
            await pool.query('SELECT generate_daily_stats()');
            logger.info('Daily stats generation completed');
        } catch (error) {
            logger.error('Daily stats generation failed:', error);
        }
    });

    // ✅ Creator earnings (2 AM)
    cron.schedule('0 2 * * *', async () => {
        try {
            logger.info('Running creator earnings generation...');
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const startDate = new Date(yesterday);
            startDate.setDate(1);

            await pool.query('SELECT generate_creator_earnings($1, $2)', [
                startDate.toISOString().split('T')[0],
                yesterday.toISOString().split('T')[0]
            ]);

            logger.info('Creator earnings generation completed');
        } catch (error) {
            logger.error('Creator earnings generation failed:', error);
        }
    });

    // ✅ Platform revenue (3 AM)
    cron.schedule('0 3 * * *', async () => {
        try {
            logger.info('Running platform revenue generation...');
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const startDate = new Date(yesterday);
            startDate.setDate(1);

            await pool.query('SELECT generate_platform_revenue($1, $2)', [
                startDate.toISOString().split('T')[0],
                yesterday.toISOString().split('T')[0]
            ]);

            logger.info('Platform revenue generation completed');
        } catch (error) {
            logger.error('Platform revenue generation failed:', error);
        }
    });

    // ✅ Cleanup promotions (every 6 hours)
    cron.schedule('0 */6 * * *', async () => {
        try {
            logger.info('Checking expiring promotions...');
            
            await pool.query(`
                UPDATE promoted_content 
                SET is_active = false 
                WHERE is_active = true AND ends_at <= NOW()
            `);

            logger.info('Promotion cleanup completed');
        } catch (error) {
            logger.error('Promotion cleanup failed:', error);
        }
    });

    // ✅ Monthly tax reports (1st day at 4 AM)
    cron.schedule('0 4 1 * *', async () => {
        try {
            logger.info('Running monthly tax report generation...');
            
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

            await pool.query(
                'SELECT generate_tax_report($1, $2, $3)',
                ['vat', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
            );

            await pool.query(
                'SELECT generate_tax_report($1, $2, $3)',
                ['withholding', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
            );

            await pool.query(
                'SELECT generate_tax_report($1, $2, $3)',
                ['service', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
            );

            logger.info('Monthly tax reports generated');
        } catch (error) {
            logger.error('Monthly tax report generation failed:', error);
        }
    });

    // ✅ Clean impressions weekly (Sunday 2 AM)
    cron.schedule('0 2 * * 0', async () => {
        try {
            logger.info('Cleaning up old impression data...');
            
            await pool.query(`
                DELETE FROM promotion_impressions 
                WHERE viewed_at < NOW() - INTERVAL '90 days'
            `);

            logger.info('Impression cleanup completed');
        } catch (error) {
            logger.error('Impression cleanup failed:', error);
        }
    });

    // ✅ Renewal reminders (9 AM)
    cron.schedule('0 9 * * *', async () => {
        try {
            logger.info('Sending renewal reminders...');
            
            const expiringSoon = await pool.query(`
                SELECT 
                    u.id, u.email, u.username,
                    vp.name as plan_name,
                    uv.expires_at
                FROM user_verifications uv
                JOIN users u ON uv.user_id = u.id
                JOIN verification_plans vp ON uv.plan_id = vp.id
                WHERE uv.is_active = true 
                    AND uv.auto_renew = false
                    AND uv.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            `);

            for (const user of expiringSoon.rows) {
                logger.info(`Reminder for ${user.email}: expires on ${user.expires_at}`);
            }

            logger.info(`Sent ${expiringSoon.rows.length} renewal reminders`);
        } catch (error) {
            logger.error('Renewal reminders failed:', error);
        }
    });

    logger.info('✅ All cron jobs initialized');
};

module.exports = {
    setupDailyJobs
};