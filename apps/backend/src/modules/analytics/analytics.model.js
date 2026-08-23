// src/modules/analytics/analytics.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class AnalyticsModel {
    // Get dashboard overview
    static async getDashboardOverview() {
        const query = `
            WITH current_stats AS (
                SELECT
                    (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                    (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
                    (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '24 hours') as active_users_24h,
                    
                    (SELECT COUNT(*) FROM posts WHERE is_active = true) as total_posts,
                    (SELECT COUNT(*) FROM posts WHERE created_at > NOW() - INTERVAL '24 hours') as new_posts_24h,
                    
                    (SELECT COUNT(*) FROM uhoro_videos WHERE is_active = true AND moderation_status = 'approved') as total_videos,
                    (SELECT COUNT(*) FROM uhoro_videos WHERE created_at > NOW() - INTERVAL '24 hours') as new_videos_24h,
                    
                    (SELECT COUNT(*) FROM uhoro_views WHERE created_at > NOW() - INTERVAL '24 hours') as video_views_24h,
                    
                    (SELECT COALESCE(SUM(amount), 0) FROM token_transactions WHERE type = 'purchase' AND created_at > NOW() - INTERVAL '24 hours') as revenue_24h,
                    (SELECT COALESCE(SUM(amount), 0) FROM token_transactions WHERE type = 'tip_sent' AND created_at > NOW() - INTERVAL '24 hours') as tips_24h,
                    
                    (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending') as pending_moderation,
                    (SELECT COUNT(*) FROM content_reports WHERE status = 'pending') as pending_reports
            )
            SELECT * FROM current_stats
        `;
        
        const result = await pool.query(query);
        return result.rows[0];
    }

    // Get user growth analytics
    static async getUserGrowth(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';
        
        const query = `
            WITH dates AS (
                SELECT generate_series(
                    DATE(NOW() - INTERVAL '${interval}'),
                    DATE(NOW()),
                    '1 day'::interval
                )::date as date
            )
            SELECT 
                d.date,
                COUNT(DISTINCT u.id) FILTER (WHERE DATE(u.created_at) = d.date) as new_users,
                COUNT(DISTINCT u.id) FILTER (WHERE DATE(u.last_login) = d.date) as active_users,
                (
                    SELECT COUNT(*)
                    FROM users
                    WHERE DATE(created_at) <= d.date
                ) as cumulative_users
            FROM dates d
            LEFT JOIN users u ON DATE(u.created_at) = d.date OR DATE(u.last_login) = d.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `;
        
        const result = await pool.query(query);
        
        // Calculate trends
        const values = result.rows.map(r => r.new_users);
        const trend = this.calculateTrend(values);
        
        return {
            data: result.rows,
            trend,
            total_users: result.rows[result.rows.length - 1]?.cumulative_users || 0
        };
    }

    // Get content analytics
    static async getContentAnalytics(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';
        
        const query = `
            WITH dates AS (
                SELECT generate_series(
                    DATE(NOW() - INTERVAL '${interval}'),
                    DATE(NOW()),
                    '1 day'::interval
                )::date as date
            )
            SELECT 
                d.date,
                COUNT(DISTINCT p.id) FILTER (WHERE DATE(p.created_at) = d.date) as posts,
                COUNT(DISTINCT c.id) FILTER (WHERE DATE(c.created_at) = d.date) as comments,
                COUNT(DISTINCT uv.id) FILTER (WHERE DATE(uv.created_at) = d.date) as videos,
                COUNT(DISTINCT l.id) FILTER (WHERE DATE(l.created_at) = d.date) as likes,
                COUNT(DISTINCT v.id) FILTER (WHERE DATE(v.created_at) = d.date) as views
            FROM dates d
            LEFT JOIN posts p ON DATE(p.created_at) = d.date
            LEFT JOIN comments c ON DATE(c.created_at) = d.date
            LEFT JOIN uhoro_videos uv ON DATE(uv.created_at) = d.date
            LEFT JOIN likes l ON DATE(l.created_at) = d.date
            LEFT JOIN uhoro_views v ON DATE(v.created_at) = d.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `;
        
        const result = await pool.query(query);
        
        // Get totals
        const totals = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM posts WHERE is_active = true) as total_posts,
                (SELECT COUNT(*) FROM comments WHERE is_active = true) as total_comments,
                (SELECT COUNT(*) FROM uhoro_videos WHERE is_active = true) as total_videos,
                (SELECT COUNT(*) FROM likes) as total_likes,
                (SELECT COUNT(*) FROM uhoro_views) as total_views
        `);
        
        return {
            daily: result.rows,
            totals: totals.rows[0]
        };
    }

    // Get token economy analytics
    static async getTokenAnalytics(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';
        
        const query = `
            WITH dates AS (
                SELECT generate_series(
                    DATE(NOW() - INTERVAL '${interval}'),
                    DATE(NOW()),
                    '1 day'::interval
                )::date as date
            )
            SELECT 
                d.date,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'purchase'), 0) as tokens_purchased,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'tip_sent'), 0) as tokens_tipped,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'withdrawal'), 0) as tokens_withdrawn,
                (
                    SELECT COALESCE(AVG(token_balance), 0)
                    FROM users
                    WHERE DATE(created_at) <= d.date
                ) as avg_balance
            FROM dates d
            LEFT JOIN token_transactions t ON DATE(t.created_at) = d.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `;
        
        const result = await pool.query(query);
        
        // Get financial summary
        const financials = await pool.query(`
            SELECT
                COALESCE(SUM(amount), 0) as total_revenue
            FROM mpesa_transactions
            WHERE status = 'success'
        `);
        
        return {
            daily: result.rows,
            summary: {
                total_revenue: financials.rows[0].total_revenue,
                tokens_in_circulation: await this.getTotalTokensInCirculation()
            }
        };
    }

    // Get engagement metrics
    static async getEngagementMetrics(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';
        
        const query = `
            SELECT
                -- User engagement
                AVG(daily_active_users) as avg_daily_active_users,
                AVG(daily_new_users) as avg_daily_new_users,
                
                -- Content engagement
                AVG(daily_posts) as avg_daily_posts,
                AVG(daily_comments) as avg_daily_comments,
                AVG(daily_videos) as avg_daily_videos,
                AVG(daily_likes) as avg_daily_likes,
                AVG(daily_views) as avg_daily_views,
                
                -- Ratios
                AVG(daily_likes::float / NULLIF(daily_posts, 0)) as avg_likes_per_post,
                AVG(daily_comments::float / NULLIF(daily_posts, 0)) as avg_comments_per_post,
                AVG(daily_views::float / NULLIF(daily_videos, 0)) as avg_views_per_video
                
            FROM daily_stats
            WHERE date > NOW() - INTERVAL '${interval}'
        `;
        
        const result = await pool.query(query);
        return result.rows[0];
    }

    // Get moderation analytics
    static async getModerationAnalytics(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';
        
        const query = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') as pending_items,
                COUNT(*) FILTER (WHERE status = 'approved') as approved_items,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected_items,
                COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_items,
                AVG(EXTRACT(EPOCH FROM (moderated_at - created_at))) / 3600 as avg_response_time_hours
            FROM moderation_queue
            WHERE created_at > NOW() - INTERVAL '${interval}'
        `;
        
        const result = await pool.query(query);
        
        // Get top reported content types
        const topReports = await pool.query(`
            SELECT 
                content_type,
                COUNT(*) as report_count
            FROM content_reports
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY content_type
            ORDER BY report_count DESC
        `);
        
        return {
            summary: result.rows[0],
            top_reported_types: topReports.rows
        };
    }

    // Get top creators
    static async getTopCreators(limit = 10, period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';
        
        const query = `
            SELECT 
                u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
                COUNT(DISTINCT p.id) as posts_count,
                COUNT(DISTINCT uv.id) as videos_count,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'tip_received'), 0) as tips_received,
                (
                    SELECT COUNT(*)
                    FROM uhoro_views v
                    WHERE v.video_id IN (SELECT id FROM uhoro_videos WHERE user_id = u.id)
                    AND v.created_at > NOW() - INTERVAL '${interval}'
                ) as total_views,
                (
                    SELECT COUNT(*)
                    FROM follows f
                    WHERE f.following_id = u.id
                ) as followers_count
            FROM users u
            LEFT JOIN posts p ON u.id = p.user_id AND p.created_at > NOW() - INTERVAL '${interval}'
            LEFT JOIN uhoro_videos uv ON u.id = uv.user_id AND uv.created_at > NOW() - INTERVAL '${interval}'
            LEFT JOIN token_transactions t ON u.id = t.user_id AND t.type = 'tip_received' AND t.created_at > NOW() - INTERVAL '${interval}'
            WHERE u.is_active = true
            GROUP BY u.id
            ORDER BY tips_received DESC, total_views DESC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    // Get geographic distribution
    static async getGeographicDistribution() {
        const query = `
            SELECT 
                COALESCE(country, 'Unknown') as country,
                COUNT(*) as user_count,
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
            FROM users
            WHERE is_active = true
            GROUP BY country
            ORDER BY user_count DESC
            LIMIT 20
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    // Get device analytics
    static async getDeviceAnalytics() {
        const query = `
            SELECT 
                COALESCE(device_info->>'platform', 'Unknown') as platform,
                COUNT(*) as session_count,
                COUNT(DISTINCT user_id) as unique_users
            FROM user_presence
            WHERE updated_at > NOW() - INTERVAL '7 days'
            GROUP BY platform
            ORDER BY session_count DESC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    // Get hourly activity pattern
    static async getHourlyActivity() {
        const query = `
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                COUNT(*) as activity_count
            FROM (
                SELECT created_at FROM posts WHERE created_at > NOW() - INTERVAL '7 days'
                UNION ALL
                SELECT created_at FROM comments WHERE created_at > NOW() - INTERVAL '7 days'
                UNION ALL
                SELECT created_at FROM uhoro_views WHERE created_at > NOW() - INTERVAL '7 days'
            ) activities
            GROUP BY hour
            ORDER BY hour
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    // Export full analytics report
    static async getFullReport(startDate, endDate) {
        const query = `
            SELECT *
            FROM daily_stats
            WHERE date BETWEEN $1 AND $2
            ORDER BY date ASC
        `;
        
        const result = await pool.query(query, [startDate, endDate]);
        
        // Calculate summary
        const summary = {
            total_users: result.rows[result.rows.length - 1]?.total_users || 0,
            total_revenue: result.rows.reduce((sum, day) => sum + parseFloat(day.revenue_kes), 0),
            total_tokens_tipped: result.rows.reduce((sum, day) => sum + parseInt(day.tokens_tipped), 0),
            avg_daily_active_users: Math.round(result.rows.reduce((sum, day) => sum + parseInt(day.active_users), 0) / result.rows.length),
            period_start: startDate,
            period_end: endDate
        };
        
        return {
            daily: result.rows,
            summary
        };
    }

    // Helper: Calculate trend percentage
    static calculateTrend(values) {
        if (values.length < 7) return 0;
        
        const recent = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const previous = values.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
        
        if (previous === 0) return recent > 0 ? 100 : 0;
        
        return ((recent - previous) / previous) * 100;
    }

    // Helper: Get total tokens in circulation
    static async getTotalTokensInCirculation() {
        const result = await pool.query(
            'SELECT COALESCE(SUM(token_balance), 0) as total FROM users'
        );
        return parseInt(result.rows[0].total);
    }
}

module.exports = AnalyticsModel;