// src/modules/tax/tax.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const TaxCalculator = require('../../utils/taxCalculator');

class TaxModel {
    // Get all tax configs
    static async getConfigs(activeOnly = true) {
        const query = `
            SELECT *
            FROM tax_configs
            WHERE ($1 = false OR is_active = true)
            ORDER BY tax_type, percentage DESC
        `;
        
        const result = await pool.query(query, [activeOnly]);
        return result.rows;
    }

    // Get tax config by type
    static async getConfigByType(taxType, country = 'KE') {
        const query = `
            SELECT *
            FROM tax_configs
            WHERE tax_type = $1 
                AND country = $2
                AND is_active = true
                AND (effective_to IS NULL OR effective_to > NOW())
            ORDER BY effective_from DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query, [taxType, country]);
        return result.rows[0] || null;
    }

    // Create tax config (admin)
    static async createConfig(data, createdBy) {
        const {
            name, description, tax_type, country, region,
            percentage, applies_to, threshold, is_compound,
            effective_from, effective_to, statutory_reference
        } = data;

        const query = `
            INSERT INTO tax_configs (
                name, description, tax_type, country, region,
                percentage, applies_to, threshold, is_compound,
                effective_from, effective_to, statutory_reference, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const result = await pool.query(query, [
            name, description, tax_type, country, region,
            percentage, applies_to, threshold || 0, is_compound || false,
            effective_from || new Date(), effective_to,
            statutory_reference, createdBy
        ]);

        return result.rows[0];
    }

    // Update tax config (admin)
    static async updateConfig(configId, data) {
        const allowedFields = [
            'name', 'description', 'percentage', 'is_active',
            'applies_to', 'threshold', 'is_compound',
            'effective_from', 'effective_to', 'statutory_reference'
        ];

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.keys(data).forEach(key => {
            if (allowedFields.includes(key)) {
                setClause.push(`${key} = $${paramIndex}`);
                values.push(data[key]);
                paramIndex++;
            }
        });

        if (setClause.length === 0) {
            throw new AppError('No valid fields to update', 400);
        }

        values.push(configId);
        const query = `
            UPDATE tax_configs 
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            throw new AppError('Tax config not found', 404);
        }

        return result.rows[0];
    }

    // Get tax transactions
    static async getTransactions(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                tt.*,
                tc.name as tax_name,
                u_payer.username as payer_username,
                u_recipient.username as recipient_username
            FROM tax_transactions tt
            LEFT JOIN tax_configs tc ON tt.tax_config_id = tc.id
            LEFT JOIN users u_payer ON tt.payer_id = u_payer.id
            LEFT JOIN users u_recipient ON tt.recipient_id = u_recipient.id
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        if (filters.user_id) {
            conditions.push(`(tt.payer_id = $${values.length + 1} OR tt.recipient_id = $${values.length + 1})`);
            values.push(filters.user_id);
        }

        if (filters.tax_type) {
            conditions.push(`tt.tax_type = $${values.length + 1}`);
            values.push(filters.tax_type);
        }

        if (filters.status) {
            conditions.push(`tt.status = $${values.length + 1}`);
            values.push(filters.status);
        }

        if (filters.start_date) {
            conditions.push(`tt.created_at >= $${values.length + 1}`);
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            conditions.push(`tt.created_at <= $${values.length + 1}`);
            values.push(filters.end_date);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        query += ` ORDER BY tt.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM tax_transactions tt WHERE 1=1';
        if (conditions.length > 0) {
            countQuery += ' AND ' + conditions.join(' AND ');
        }
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].count);

        return {
            transactions: result.rows,
            total
        };
    }

    // Get tax summary by type
    static async getSummary(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

        const query = `
            SELECT 
                tax_type,
                country,
                COUNT(*) as transaction_count,
                SUM(taxable_amount) as total_taxable,
                SUM(tax_amount) as total_tax,
                AVG(tax_percentage) as avg_rate
            FROM tax_transactions
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY tax_type, country
            ORDER BY total_tax DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Update user tax information
    static async updateUserTaxInfo(userId, taxInfo) {
        const { kRA_pin, tax_residency, tax_id, business_registration, tax_exempt } = taxInfo;

        const query = `
            UPDATE users 
            SET kRA_pin = COALESCE($1, kRA_pin),
                tax_residency = COALESCE($2, tax_residency),
                tax_id = COALESCE($3, tax_id),
                business_registration = COALESCE($4, business_registration),
                tax_exempt = COALESCE($5, tax_exempt)
            WHERE id = $6
            RETURNING id, kRA_pin, tax_residency, tax_exempt
        `;

        const result = await pool.query(query, [
            kRA_pin, tax_residency, tax_id, business_registration, tax_exempt, userId
        ]);

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        return result.rows[0];
    }

    // Generate tax report for KRA filing
    static async generateTaxReport(reportType, periodStart, periodEnd) {
        // Get all relevant tax transactions
        const query = `
            SELECT 
                tt.*,
                u_payer.kRA_pin as payer_pin,
                u_payer.username as payer_name,
                u_recipient.kRA_pin as recipient_pin,
                u_recipient.username as recipient_name
            FROM tax_transactions tt
            LEFT JOIN users u_payer ON tt.payer_id = u_payer.id
            LEFT JOIN users u_recipient ON tt.recipient_id = u_recipient.id
            WHERE tt.tax_type = $1
                AND tt.created_at::date BETWEEN $2 AND $3
                AND tt.status != 'exempt'
            ORDER BY tt.created_at ASC
        `;

        const transactions = await pool.query(query, [reportType, periodStart, periodEnd]);

        // Format for KRA
        const report = TaxCalculator.formatForKRA(transactions.rows, {
            start: periodStart,
            end: periodEnd
        });

        // Save report to database
        const reportResult = await pool.query(
            `INSERT INTO tax_reports (
                report_type, period_start, period_end,
                total_transactions, total_amount, total_tax,
                report_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                reportType, periodStart, periodEnd,
                report.total_transactions,
                report.transactions.reduce((sum, t) => sum + t.amount, 0),
                report.summary.vat.amount + report.summary.withholding.amount + report.summary.dst.amount,
                report
            ]
        );

        return reportResult.rows[0];
    }

    // Mark tax report as filed
    static async markReportAsFiled(reportId, staffId, filingReference) {
        const query = `
            UPDATE tax_reports 
            SET is_filed = true,
                filing_date = CURRENT_DATE,
                filing_reference = $1,
                filed_by = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;

        const result = await pool.query(query, [filingReference, staffId, reportId]);

        if (result.rows.length === 0) {
            throw new AppError('Tax report not found', 404);
        }

        return result.rows[0];
    }

    // Get tax liability summary
    static async getTaxLiability() {
        const query = `
            SELECT 
                tax_type,
                country,
                SUM(CASE WHEN status = 'pending' THEN tax_amount ELSE 0 END) as pending_tax,
                SUM(CASE WHEN status = 'paid' THEN tax_amount ELSE 0 END) as paid_tax,
                SUM(CASE WHEN status = 'remitted' THEN tax_amount ELSE 0 END) as remitted_tax,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count
            FROM tax_transactions
            GROUP BY tax_type, country
            ORDER BY pending_tax DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get creator tax summary for a specific user
    static async getCreatorTaxSummary(userId) {
        const query = `
            SELECT 
                COALESCE(SUM(tax_amount) FILTER (WHERE tax_type = 'withholding'), 0) as total_withholding_tax,
                COALESCE(SUM(tax_amount) FILTER (WHERE tax_type = 'income'), 0) as total_income_tax,
                COUNT(*) FILTER (WHERE tax_type = 'withholding') as withholding_transactions,
                COUNT(*) FILTER (WHERE tax_type = 'income') as income_transactions,
                MAX(created_at) FILTER (WHERE tax_type = 'withholding') as last_withholding_date,
                MAX(created_at) FILTER (WHERE tax_type = 'income') as last_income_date
            FROM tax_transactions
            WHERE recipient_id = $1
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }
}

module.exports = TaxModel;