// src/modules/reports/reports.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const { exportToExcel, exportToCSV } = require('../../utils/excelExport');

class ReportsModel {
    // Generate creator earnings report
    static async generateCreatorEarningsReport(periodStart, periodEnd, format = 'json') {
        const query = `
            SELECT 
                u.id as user_id,
                u.username,
                u.full_name,
                u.email,
                u.kRA_pin,
                ce.period_start,
                ce.period_end,
                ce.total_tips,
                ce.total_commission,
                ce.total_tax,
                ce.total_withholding_tax,
                ce.net_earnings,
                ce.breakdown
            FROM creator_earnings ce
            JOIN users u ON ce.user_id = u.id
            WHERE ce.period_start >= $1 AND ce.period_end <= $2
            ORDER BY ce.net_earnings DESC
        `;

        const result = await pool.query(query, [periodStart, periodEnd]);

        if (format === 'excel') {
            return await exportToExcel(result.rows, 'Creator Earnings');
        } else if (format === 'csv') {
            return await exportToCSV(result.rows);
        }

        return result.rows;
    }

    // Generate tax report for KRA
    static async generateTaxReport(reportType, periodStart, periodEnd, format = 'json') {
        const query = `
            SELECT 
                tt.*,
                u_payer.username as payer_username,
                u_payer.kRA_pin as payer_pin,
                u_recipient.username as recipient_username,
                u_recipient.kRA_pin as recipient_pin,
                tc.name as tax_name,
                tc.statutory_reference
            FROM tax_transactions tt
            LEFT JOIN users u_payer ON tt.payer_id = u_payer.id
            LEFT JOIN users u_recipient ON tt.recipient_id = u_recipient.id
            LEFT JOIN tax_configs tc ON tt.tax_config_id = tc.id
            WHERE tt.tax_type = $1
                AND tt.created_at::date BETWEEN $2 AND $3
                AND tt.status != 'exempt'
            ORDER BY tt.created_at ASC
        `;

        const result = await pool.query(query, [reportType, periodStart, periodEnd]);

        if (format === 'excel') {
            return await exportToExcel(result.rows, `${reportType.toUpperCase()} Tax Report`);
        } else if (format === 'csv') {
            return await exportToCSV(result.rows);
        }

        return result.rows;
    }

    // Generate platform revenue report
    static async generatePlatformRevenueReport(periodStart, periodEnd, format = 'json') {
        const query = `
            SELECT *
            FROM platform_revenue
            WHERE period_start >= $1 AND period_end <= $2
            ORDER BY period_start ASC
        `;

        const result = await pool.query(query, [periodStart, periodEnd]);

        if (format === 'excel') {
            return await exportToExcel(result.rows, 'Platform Revenue');
        } else if (format === 'csv') {
            return await exportToCSV(result.rows);
        }

        return result.rows;
    }

    // Generate transaction report
    static async generateTransactionReport(periodStart, periodEnd, type = 'all', format = 'json') {
        let query = `
            SELECT 
                'commission' as source,
                ct.id,
                ct.transaction_type,
                ct.original_amount,
                ct.commission_amount as platform_fee,
                ct.net_amount,
                ct.status,
                ct.created_at,
                u_sender.username as user,
                u_receiver.username as creator
            FROM commission_transactions ct
            LEFT JOIN users u_sender ON ct.user_id = u_sender.id
            LEFT JOIN users u_receiver ON ct.creator_id = u_receiver.id
            WHERE ct.created_at::date BETWEEN $1 AND $2
        `;

        if (type === 'commission' || type === 'all') {
            // Already included
        }

        if (type === 'all') {
            query += `
                UNION ALL
                SELECT 
                    'tax' as source,
                    tt.id,
                    tt.transaction_type,
                    tt.taxable_amount,
                    tt.tax_amount,
                    tt.taxable_amount - tt.tax_amount,
                    tt.status,
                    tt.created_at,
                    u_payer.username,
                    u_recipient.username
                FROM tax_transactions tt
                LEFT JOIN users u_payer ON tt.payer_id = u_payer.id
                LEFT JOIN users u_recipient ON tt.recipient_id = u_recipient.id
                WHERE tt.created_at::date BETWEEN $1 AND $2
            `;
        } else if (type === 'tax') {
            query = `
                SELECT 
                    'tax' as source,
                    tt.id,
                    tt.transaction_type,
                    tt.taxable_amount,
                    tt.tax_amount,
                    tt.taxable_amount - tt.tax_amount,
                    tt.status,
                    tt.created_at,
                    u_payer.username,
                    u_recipient.username
                FROM tax_transactions tt
                LEFT JOIN users u_payer ON tt.payer_id = u_payer.id
                LEFT JOIN users u_recipient ON tt.recipient_id = u_recipient.id
                WHERE tt.created_at::date BETWEEN $1 AND $2
            `;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, [periodStart, periodEnd]);

        if (format === 'excel') {
            return await exportToExcel(result.rows, 'Transaction Report');
        } else if (format === 'csv') {
            return await exportToCSV(result.rows);
        }

        return result.rows;
    }

    // Generate user earnings report for a specific user
    static async getUserEarningsReport(userId, periodStart, periodEnd, format = 'json') {
        const query = `
            SELECT 
                ce.*,
                u.username,
                u.full_name,
                u.email,
                u.kRA_pin
            FROM creator_earnings ce
            JOIN users u ON ce.user_id = u.id
            WHERE ce.user_id = $1
                AND ce.period_start >= $2 
                AND ce.period_end <= $3
            ORDER BY ce.period_start DESC
        `;

        const result = await pool.query(query, [userId, periodStart, periodEnd]);

        if (format === 'excel') {
            return await exportToExcel(result.rows, 'My Earnings');
        } else if (format === 'csv') {
            return await exportToCSV(result.rows);
        }

        return result.rows;
    }

    // Get summary statistics for dashboard
    static async getSummaryStats() {
        const query = `
            WITH current_month AS (
                SELECT 
                    COALESCE(SUM(commission_amount), 0) as total_commission,
                    COALESCE(SUM(tax_amount), 0) as total_tax
                FROM commission_transactions
                WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
            ),
            previous_month AS (
                SELECT 
                    COALESCE(SUM(commission_amount), 0) as total_commission
                FROM commission_transactions
                WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            ),
            top_creator AS (
                SELECT 
                    u.username,
                    SUM(ce.net_earnings) as earnings
                FROM creator_earnings ce
                JOIN users u ON ce.user_id = u.id
                WHERE ce.period_end > NOW() - INTERVAL '30 days'
                GROUP BY u.id, u.username
                ORDER BY earnings DESC
                LIMIT 1
            )
            SELECT 
                (SELECT total_commission FROM current_month) as current_month_revenue,
                (SELECT total_tax FROM current_month) as current_month_tax,
                (SELECT total_commission FROM previous_month) as previous_month_revenue,
                CASE 
                    WHEN (SELECT total_commission FROM previous_month) > 0 
                    THEN ((SELECT total_commission FROM current_month) - (SELECT total_commission FROM previous_month)) 
                         / (SELECT total_commission FROM previous_month) * 100
                    ELSE 0
                END as revenue_growth,
                (SELECT COUNT(DISTINCT user_id) FROM commission_transactions WHERE created_at > NOW() - INTERVAL '30 days') as active_users,
                (SELECT COUNT(*) FROM tips WHERE created_at > NOW() - INTERVAL '30 days') as total_tips,
                (SELECT * FROM top_creator) as top_creator
        `;

        const result = await pool.query(query);
        return result.rows[0];
    }

    // Get financial health metrics
    static async getFinancialHealth() {
        const query = `
            WITH revenue_metrics AS (
                SELECT 
                    SUM(commission_amount) FILTER (WHERE status = 'collected') as collected_revenue,
                    SUM(commission_amount) FILTER (WHERE status = 'pending') as pending_revenue,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count
                FROM commission_transactions
            ),
            tax_metrics AS (
                SELECT 
                    SUM(tax_amount) FILTER (WHERE status = 'pending') as pending_tax,
                    SUM(tax_amount) FILTER (WHERE status = 'paid') as paid_tax,
                    SUM(tax_amount) FILTER (WHERE status = 'remitted') as remitted_tax
                FROM tax_transactions
            ),
            payout_metrics AS (
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_payouts,
                    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_payout_amount
                FROM withdrawals
            )
            SELECT 
                COALESCE(revenue_metrics.collected_revenue, 0) as collected_revenue,
                COALESCE(revenue_metrics.pending_revenue, 0) as pending_revenue,
                COALESCE(revenue_metrics.pending_count, 0) as pending_transactions,
                COALESCE(tax_metrics.pending_tax, 0) as pending_tax_liability,
                COALESCE(tax_metrics.paid_tax, 0) as paid_tax,
                COALESCE(tax_metrics.remitted_tax, 0) as remitted_tax,
                COALESCE(payout_metrics.pending_payouts, 0) as pending_payouts,
                COALESCE(payout_metrics.pending_payout_amount, 0) as pending_payout_amount,
                CASE 
                    WHEN COALESCE(revenue_metrics.collected_revenue, 0) > 0 
                    THEN (COALESCE(payout_metrics.pending_payout_amount, 0) / revenue_metrics.collected_revenue * 100)
                    ELSE 0
                END as payout_ratio
            FROM revenue_metrics, tax_metrics, payout_metrics
        `;

        const result = await pool.query(query);
        return result.rows[0];
    }
}

module.exports = ReportsModel;