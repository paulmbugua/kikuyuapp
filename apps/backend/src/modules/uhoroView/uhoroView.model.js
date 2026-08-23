// src/modules/uhoroView/uhoroView.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class UhoroViewModel {
    // Record a view
    static async recordView(videoId, userId, watchData) {
        const { watchDuration, watchedPercentage, completed } = watchData;

        // Check if video exists
        const videoCheck = await pool.query(
            'SELECT duration FROM uhoro_videos WHERE id = $1 AND is_active = true',
            [videoId]
        );

        if (videoCheck.rows.length === 0) {
            throw new AppError('Video not found', 404);
        }

        const video = videoCheck.rows[0];

        // Validate watch data
        if (watchDuration > video.duration) {
            throw new AppError('Watch duration cannot exceed video duration', 400);
        }

        const query = `
            INSERT INTO uhoro_views (video_id, user_id, watch_duration, watched_percentage, completed)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;

        const result = await pool.query(query, [
            videoId,
            userId || null, // Allow anonymous views
            watchDuration,
            watchedPercentage,
            completed
        ]);

        return result.rows[0];
    }

    // Get view history for user
    static async getUserHistory(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                vw.watch_duration, vw.watched_percentage, vw.completed, vw.created_at as viewed_at,
                
                CASE 
                    WHEN $1 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $1 AND video_id = v.id)
                    ELSE false
                END as is_liked
                
            FROM uhoro_views vw
            JOIN uhoro_videos v ON vw.video_id = v.id
            JOIN users u ON v.user_id = u.id
            WHERE vw.user_id = $1
            ORDER BY vw.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    // Get video view statistics
    static async getVideoStats(videoId) {
        const query = `
            SELECT
                COUNT(DISTINCT user_id) as unique_viewers,
                COUNT(*) as total_views,
                AVG(watch_duration) as avg_watch_duration,
                AVG(watched_percentage) as avg_watch_percentage,
                SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completions,
                
                -- Views over time (last 24h)
                (
                    SELECT COUNT(*)
                    FROM uhoro_views
                    WHERE video_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
                ) as views_last_24h,
                
                -- Retention data
                (
                    SELECT json_agg(json_build_object('percentage', percentage, 'viewers', viewers))
                    FROM (
                        SELECT 
                            FLOOR(watched_percentage / 10) * 10 as percentage,
                            COUNT(*) as viewers
                        FROM uhoro_views
                        WHERE video_id = $1
                        GROUP BY FLOOR(watched_percentage / 10) * 10
                        ORDER BY percentage
                    ) retention
                ) as retention_curve
                
            FROM uhoro_views
            WHERE video_id = $1
        `;

        const result = await pool.query(query, [videoId]);
        return result.rows[0];
    }

    // Check if user has watched video
    static async hasWatched(userId, videoId) {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM uhoro_views WHERE user_id = $1 AND video_id = $2) as watched',
            [userId, videoId]
        );

        return result.rows[0].watched;
    }

    // Get watch time for user (total minutes)
    static async getUserTotalWatchTime(userId) {
        const result = await pool.query(
            'SELECT COALESCE(SUM(watch_duration), 0) as total_seconds FROM uhoro_views WHERE user_id = $1',
            [userId]
        );

        return {
            seconds: result.rows[0].total_seconds,
            minutes: Math.round(result.rows[0].total_seconds / 60),
            hours: Math.round(result.rows[0].total_seconds / 3600 * 10) / 10
        };
    }

    // Clean up old view data (for analytics retention)
    static async cleanupOldViews(daysToKeep = 90) {
        const query = `
            DELETE FROM uhoro_views 
            WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
            RETURNING COUNT(*) as deleted_count
        `;

        const result = await pool.query(query);
        return result.rows[0].deleted_count;
    }
}

module.exports = UhoroViewModel;