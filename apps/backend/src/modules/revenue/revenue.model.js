// src/modules/revenue/revenue.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class RevenueModel {
    // Get platform revenue summary
    static async getPlatformRevenue(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

        const query = `
            SELECT 
                COALESCE(SUM(commission_amount), 0) as total_commission,
                COALESCE(SUM(tax_amount), 0) as total_tax_collected,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT creator_id) as unique_creators,
                AVG(commission_amount) as avg_commission,
                MAX(commission_amount) as max_commission
            FROM commission_transactions
            WHERE created_at > NOW() - INTERVAL '${interval}'
        `;

        const result = await pool.query(query);
        return result.rows[0];
    }

    // Get revenue breakdown by type
    static async getRevenueBreakdown(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

        const query = `
            SELECT 
                transaction_type,
                COUNT(*) as count,
                SUM(original_amount) as total_original,
                SUM(commission_amount) as total_commission,
                SUM(commission_amount) * 100.0 / NULLIF(SUM(original_amount), 0) as effective_rate
            FROM commission_transactions
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY transaction_type
            ORDER BY total_commission DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get daily revenue for charting
    static async getDailyRevenue(days = 30) {
        const query = `
            WITH dates AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '${days} days',
                    CURRENT_DATE,
                    '1 day'::interval
                )::date as date
            )
            SELECT 
                d.date,
                COALESCE(SUM(ct.commission_amount), 0) as commissions,
                COALESCE(SUM(tt.tax_amount), 0) as taxes,
                COALESCE(SUM(ct.commission_amount), 0) + COALESCE(SUM(tt.tax_amount), 0) as total
            FROM dates d
            LEFT JOIN commission_transactions ct ON DATE(ct.created_at) = d.date
            LEFT JOIN tax_transactions tt ON DATE(tt.created_at) = d.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get creator earnings summary
    static async getCreatorEarnings(userId = null, period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

        let query = `
            SELECT 
                user_id,
                u.username,
                u.full_name,
                SUM(total_tips) as total_tips,
                SUM(total_commission) as total_commission,
                SUM(total_tax) as total_tax,
                SUM(net_earnings) as net_earnings
            FROM creator_earnings ce
            JOIN users u ON ce.user_id = u.id
            WHERE period_end > NOW() - INTERVAL '${interval}'
        `;

        if (userId) {
            query += ` AND ce.user_id = $1`;
            const result = await pool.query(query + ' GROUP BY ce.user_id, u.id', [userId]);
            return result.rows[0] || null;
        }

        query += ` GROUP BY ce.user_id, u.id ORDER BY net_earnings DESC LIMIT 100`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Get top earning creators
    static async getTopEarners(limit = 10, period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

        const query = `
            SELECT 
                u.id,
                u.username,
                u.full_name,
                u.avatar_url,
                u.is_verified,
                SUM(ce.total_tips) as total_tips,
                SUM(ce.net_earnings) as net_earnings
            FROM creator_earnings ce
            JOIN users u ON ce.user_id = u.id
            WHERE ce.period_end > NOW() - INTERVAL '${interval}'
            GROUP BY u.id
            ORDER BY net_earnings DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    // Get revenue projections
    static async getProjections(months = 3) {
        // Get average daily revenue for last 30 days
        const avgQuery = `
            SELECT 
                AVG(daily_total) as avg_daily_revenue
            FROM (
                SELECT 
                    DATE(created_at) as date,
                    SUM(commission_amount) as daily_total
                FROM commission_transactions
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
            ) daily
        `;

        const avgResult = await pool.query(avgQuery);
        const avgDaily = parseFloat(avgResult.rows[0].avg_daily_revenue) || 0;

        // Calculate growth rate (compare last 30 days vs previous 30 days)
        const growthQuery = `
            WITH periods AS (
                SELECT 
                    SUM(commission_amount) as current_period
                FROM commission_transactions
                WHERE created_at > NOW() - INTERVAL '30 days'
            ),
            previous_period AS (
                SELECT 
                    SUM(commission_amount) as previous
                FROM commission_transactions
                WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
            )
            SELECT 
                current_period,
                previous,
                CASE 
                    WHEN previous > 0 THEN ((current_period - previous) / previous * 100)
                    ELSE 0
                END as growth_rate
            FROM periods, previous_period
        `;

        const growthResult = await pool.query(growthQuery);
        const growthRate = parseFloat(growthResult.rows[0].growth_rate) || 10; // Default 10% growth

        // Project for next months
        const projections = [];
        let projectedRevenue = avgDaily * 30;

        for (let i = 1; i <= months; i++) {
            projectedRevenue *= (1 + growthRate / 100 / 12); // Monthly growth
            projections.push({
                month: i,
                projected_revenue: Math.round(projectedRevenue * 100) / 100,
                confidence: i === 1 ? 'high' : i === 2 ? 'medium' : 'low'
            });
        }

        return {
            avg_daily_revenue: avgDaily,
            current_monthly_revenue: avgDaily * 30,
            growth_rate: growthRate,
            projections
        };
    }

    // Get revenue by user segment
    static async getRevenueBySegment() {
        const query = `
            WITH user_segments AS (
                SELECT 
                    u.id,
                    CASE 
                        WHEN u.is_verified THEN 'verified'
                        WHEN u.followers_count > 10000 THEN 'influencer'
                        WHEN u.followers_count > 1000 THEN 'active'
                        ELSE 'regular'
                    END as segment
                FROM users u
            )
            SELECT 
                us.segment,
                COUNT(DISTINCT ct.user_id) as users,
                COUNT(ct.id) as transactions,
                SUM(ct.commission_amount) as revenue
            FROM commission_transactions ct
            JOIN user_segments us ON ct.user_id = us.id
            WHERE ct.created_at > NOW() - INTERVAL '30 days'
            GROUP BY us.segment
            ORDER BY revenue DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get hourly revenue pattern
    static async getHourlyPattern() {
        const query = `
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                AVG(commission_amount) as avg_commission,
                COUNT(*) as transaction_count,
                SUM(commission_amount) as total_revenue
            FROM commission_transactions
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY hour
            ORDER BY hour
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get revenue by day of week
    static async getWeeklyPattern() {
        const query = `
            SELECT 
                EXTRACT(DOW FROM created_at) as day_of_week,
                AVG(commission_amount) as avg_commission,
                COUNT(*) as transaction_count,
                SUM(commission_amount) as total_revenue
            FROM commission_transactions
            WHERE created_at > NOW() - INTERVAL '90 days'
            GROUP BY day_of_week
            ORDER BY day_of_week
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get platform revenue (from platform_revenue table)
    static async getPlatformRevenuePeriod(periodStart, periodEnd) {
        const query = `
            SELECT *
            FROM platform_revenue
            WHERE period_start >= $1 AND period_end <= $2
            ORDER BY period_start ASC
        `;

        const result = await pool.query(query, [periodStart, periodEnd]);
        return result.rows;
    }

    // Generate revenue report
    static async generateRevenueReport(periodStart, periodEnd) {
        // Call the stored procedure to generate platform revenue
        await pool.query('SELECT generate_platform_revenue($1, $2)', [periodStart, periodEnd]);

        // Fetch the generated report
        return this.getPlatformRevenuePeriod(periodStart, periodEnd);
    }
}

module.exports = RevenueModel;