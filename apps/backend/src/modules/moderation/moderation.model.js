// src/modules/moderation/moderation.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class ModerationModel {
    // Report content
    static async reportContent(reporterId, contentType, contentId, reason, description = null) {
        // Check if content exists
        const content = await this.getContent(contentType, contentId);
        if (!content) {
            throw new AppError('Content not found', 404);
        }

        // Check if already reported by this user
        const existing = await pool.query(
            `SELECT id FROM content_reports 
             WHERE reporter_id = $1 
               AND content_type = $2 
               AND content_id = $3 
               AND status IN ('pending', 'investigating')`,
            [reporterId, contentType, contentId]
        );

        if (existing.rows.length > 0) {
            throw new AppError('You have already reported this content', 400);
        }

        const query = `
            INSERT INTO content_reports (
                reporter_id, content_type, content_id, reason, description
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const result = await pool.query(query, [reporterId, contentType, contentId, reason, description]);

        // Add to moderation queue if report count reaches threshold
        await this.updateModerationQueue(contentType, contentId);

        return result.rows[0];
    }

    // Get pending reports
    static async getPendingReports(limit = 50, offset = 0) {
        const query = `
            SELECT 
                r.*,
                reporter.username as reporter_username,
                reporter.full_name as reporter_name,
                (
                    SELECT COUNT(*) 
                    FROM content_reports 
                    WHERE content_type = r.content_type 
                        AND content_id = r.content_id
                ) as total_reports
            FROM content_reports r
            JOIN users reporter ON r.reporter_id = reporter.id
            WHERE r.status = 'pending'
            ORDER BY r.created_at ASC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM content_reports WHERE status = 'pending'`
        );

        // Fetch content details for each report
        for (const report of result.rows) {
            report.content = await this.getContent(report.content_type, report.content_id);
        }

        return {
            reports: result.rows,
            total: parseInt(countResult.rows[0].count)
        };
    }

    // Get moderation queue
    static async getModerationQueue(status = 'pending', limit = 50, offset = 0) {
        const query = `
            SELECT 
                m.*,
                u.username, u.full_name, u.avatar_url,
                (
                    SELECT COUNT(*) 
                    FROM content_reports 
                    WHERE content_type = m.content_type 
                        AND content_id = m.content_id
                ) as report_count
            FROM moderation_queue m
            JOIN users u ON m.user_id = u.id
            WHERE m.status = $1
            ORDER BY 
                CASE m.priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                END,
                m.created_at ASC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [status, limit, offset]);

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM moderation_queue WHERE status = $1`,
            [status]
        );

        return {
            items: result.rows,
            total: parseInt(countResult.rows[0].count)
        };
    }

    // Moderate content
    static async moderate(itemId, staffId, action, notes = null) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get queue item
            const queueItem = await client.query(
                'SELECT * FROM moderation_queue WHERE id = $1',
                [itemId]
            );

            if (queueItem.rows.length === 0) {
                throw new AppError('Moderation item not found', 404);
            }

            const item = queueItem.rows[0];

            // Update queue item
            await client.query(
                `UPDATE moderation_queue 
                 SET status = $1,
                     moderated_by = $2,
                     moderated_at = CURRENT_TIMESTAMP,
                     moderation_notes = $3
                 WHERE id = $4`,
                [action === 'approve' ? 'approved' : 'rejected', staffId, notes, itemId]
            );

            // Take action on content
            if (action === 'reject') {
                await this.removeContent(client, item.content_type, item.content_id);
            }

            // Update all related reports
            await client.query(
                `UPDATE content_reports 
                 SET status = 'resolved',
                     reviewed_by = $1,
                     reviewed_at = CURRENT_TIMESTAMP,
                     resolution_notes = $2
                 WHERE content_type = $3 
                   AND content_id = $4 
                   AND status IN ('pending', 'investigating')`,
                [staffId, notes, item.content_type, item.content_id]
            );

            // Log admin action
            await this.logAdminAction(client, staffId, 'moderate', item.content_type, item.content_id, {
                action,
                notes,
                queue_item_id: itemId
            });

            await client.query('COMMIT');

            return {
                id: itemId,
                status: action === 'approve' ? 'approved' : 'rejected',
                content_type: item.content_type,
                content_id: item.content_id
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Ban user
    static async banUser(userId, staffId, reason, duration = 'permanent', expiresAt = null) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if already banned
            const existing = await client.query(
                `SELECT * FROM banned_users 
                 WHERE user_id = $1 
                   AND (expires_at IS NULL OR expires_at > NOW())`,
                [userId]
            );

            if (existing.rows.length > 0) {
                throw new AppError('User is already banned', 400);
            }

            // Create ban record
            const banResult = await client.query(
                `INSERT INTO banned_users (
                    user_id, banned_by, reason, duration, expires_at
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [userId, staffId, reason, duration, expiresAt]
            );

            // Deactivate user
            await client.query(
                'UPDATE users SET is_active = false WHERE id = $1',
                [userId]
            );

            // Log admin action
            await this.logAdminAction(client, staffId, 'ban_user', 'user', userId, {
                reason,
                duration,
                expires_at: expiresAt
            });

            await client.query('COMMIT');

            return banResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Unban user
    static async unbanUser(userId, staffId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update ban record
            await client.query(
                `UPDATE banned_users 
                 SET lifted_by = $1,
                     lifted_at = CURRENT_TIMESTAMP
                 WHERE user_id = $2 AND lifted_at IS NULL`,
                [staffId, userId]
            );

            // Reactivate user
            await client.query(
                'UPDATE users SET is_active = true WHERE id = $1',
                [userId]
            );

            // Log admin action
            await this.logAdminAction(client, staffId, 'unban_user', 'user', userId);

            await client.query('COMMIT');

            return { user_id: userId, unbanned: true };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Update moderation queue based on report count
    static async updateModerationQueue(contentType, contentId) {
        const reportCount = await pool.query(
            `SELECT COUNT(*) 
             FROM content_reports 
             WHERE content_type = $1 
               AND content_id = $2 
               AND status = 'pending'`,
            [contentType, contentId]
        );

        const count = parseInt(reportCount.rows[0].count);

        // Determine priority based on report count
        let priority = 'normal';
        if (count >= 10) priority = 'urgent';
        else if (count >= 5) priority = 'high';
        else if (count >= 2) priority = 'normal';
        else priority = 'low';

        // Get content details
        const content = await this.getContent(contentType, contentId);
        
        if (!content) return;

        // Insert or update queue
        await pool.query(
            `INSERT INTO moderation_queue (
                content_type, content_id, user_id, content_snapshot, report_count, priority
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (content_type, content_id) 
            DO UPDATE SET 
                report_count = $5,
                priority = $6,
                status = 'pending',
                updated_at = CURRENT_TIMESTAMP`,
            [contentType, contentId, content.user_id, JSON.stringify(content), count, priority]
        );
    }

    // Get content by type and ID
    static async getContent(contentType, contentId) {
        let query;
        let result;
        
        switch (contentType) {
            case 'post':
                query = 'SELECT * FROM posts WHERE id = $1';
                result = await pool.query(query, [contentId]);
                break;
            case 'comment':
                query = 'SELECT * FROM comments WHERE id = $1';
                result = await pool.query(query, [contentId]);
                break;
            case 'uhoro':
                query = 'SELECT * FROM uhoro_videos WHERE id = $1';
                result = await pool.query(query, [contentId]);
                break;
            case 'profile':
                query = 'SELECT id, username, full_name, bio, avatar_url FROM users WHERE id = $1';
                result = await pool.query(query, [contentId]);
                break;
            default:
                return null;
        }

        return result.rows[0] || null;
    }

    // Remove content (soft delete)
    static async removeContent(client, contentType, contentId) {
        switch (contentType) {
            case 'post':
                await client.query(
                    'UPDATE posts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [contentId]
                );
                break;
            case 'comment':
                await client.query(
                    'UPDATE comments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [contentId]
                );
                break;
            case 'uhoro':
                await client.query(
                    'UPDATE uhoro_videos SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [contentId]
                );
                break;
        }
    }

    // Log admin action
    static async logAdminAction(client, staffId, action, entityType, entityId, metadata = {}) {
        await client.query(
            `INSERT INTO admin_activity_logs (
                staff_id, action, entity_type, entity_id, metadata
            ) VALUES ($1, $2, $3, $4, $5)`,
            [staffId, action, entityType, entityId, JSON.stringify(metadata)]
        );
    }

    // Get banned users
    static async getBannedUsers(limit = 50, offset = 0) {
        const query = `
            SELECT 
                b.*,
                u.username, u.full_name, u.email,
                banner.username as banned_by_username
            FROM banned_users b
            JOIN users u ON b.user_id = u.id
            JOIN staff banner ON b.banned_by = banner.id
            WHERE b.lifted_at IS NULL
            ORDER BY b.created_at DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM banned_users WHERE lifted_at IS NULL'
        );

        return {
            banned_users: result.rows,
            total: parseInt(countResult.rows[0].count)
        };
    }

    // Resolve report without moderation
    static async resolveReport(reportId, staffId, resolution, notes = null) {
        const query = `
            UPDATE content_reports 
            SET status = $1,
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                resolution_notes = $3
            WHERE id = $4
            RETURNING *
        `;

        const result = await pool.query(query, [resolution, staffId, notes, reportId]);

        if (result.rows.length === 0) {
            throw new AppError('Report not found', 404);
        }

        return result.rows[0];
    }
}

module.exports = ModerationModel;