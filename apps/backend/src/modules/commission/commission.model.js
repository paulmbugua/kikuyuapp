// src/modules/commission/commission.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class CommissionModel {
    // Get all commission configs
    static async getConfigs(activeOnly = true) {
        const query = `
            SELECT *
            FROM commission_configs
            WHERE ($1 = false OR is_active = true)
            ORDER BY transaction_type, percentage DESC
        `;
        
        const result = await pool.query(query, [activeOnly]);
        return result.rows;
    }

    // Get commission config by type
    static async getConfigByType(transactionType) {
        const query = `
            SELECT *
            FROM commission_configs
            WHERE transaction_type = $1 
                AND is_active = true
                AND (effective_to IS NULL OR effective_to > NOW())
            ORDER BY effective_from DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query, [transactionType]);
        return result.rows[0] || null;
    }

    // Create commission config (admin)
    static async createConfig(data, createdBy) {
        const {
            name, description, transaction_type, percentage,
            fixed_amount, min_amount, max_amount,
            applies_to_creator, applies_to_user,
            effective_from, effective_to
        } = data;

        const query = `
            INSERT INTO commission_configs (
                name, description, transaction_type, percentage,
                fixed_amount, min_amount, max_amount,
                applies_to_creator, applies_to_user,
                effective_from, effective_to, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;

        const result = await pool.query(query, [
            name, description, transaction_type, percentage,
            fixed_amount || 0, min_amount || 0, max_amount,
            applies_to_creator, applies_to_user,
            effective_from || new Date(), effective_to,
            createdBy
        ]);

        return result.rows[0];
    }

    // Update commission config (admin)
    static async updateConfig(configId, data) {
        const allowedFields = [
            'name', 'description', 'percentage', 'fixed_amount',
            'min_amount', 'max_amount', 'is_active',
            'applies_to_creator', 'applies_to_user',
            'effective_from', 'effective_to'
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
            UPDATE commission_configs 
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            throw new AppError('Commission config not found', 404);
        }

        return result.rows[0];
    }

    // Get commission transactions
    static async getTransactions(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                ct.*,
                u_sender.username as sender_username,
                u_receiver.username as receiver_username
            FROM commission_transactions ct
            LEFT JOIN users u_sender ON ct.user_id = u_sender.id
            LEFT JOIN users u_receiver ON ct.creator_id = u_receiver.id
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        if (filters.user_id) {
            conditions.push(`(ct.user_id = $${values.length + 1} OR ct.creator_id = $${values.length + 1})`);
            values.push(filters.user_id);
        }

        if (filters.transaction_type) {
            conditions.push(`ct.transaction_type = $${values.length + 1}`);
            values.push(filters.transaction_type);
        }

        if (filters.status) {
            conditions.push(`ct.status = $${values.length + 1}`);
            values.push(filters.status);
        }

        if (filters.start_date) {
            conditions.push(`ct.created_at >= $${values.length + 1}`);
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            conditions.push(`ct.created_at <= $${values.length + 1}`);
            values.push(filters.end_date);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        query += ` ORDER BY ct.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM commission_transactions ct WHERE 1=1';
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

    // Get commission summary by type
    static async getSummary(period = '30d') {
        const interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

        const query = `
            SELECT 
                transaction_type,
                COUNT(*) as transaction_count,
                SUM(original_amount) as total_original,
                SUM(commission_amount) as total_commission,
                AVG(commission_percentage) as avg_percentage,
                SUM(commission_amount) * 100.0 / NULLIF(SUM(original_amount), 0) as effective_rate
            FROM commission_transactions
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY transaction_type
            ORDER BY total_commission DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Get daily commission totals
    static async getDailyTotals(days = 30) {
        const query = `
            SELECT 
                DATE(created_at) as date,
                transaction_type,
                COUNT(*) as transactions,
                SUM(commission_amount) as daily_commission
            FROM commission_transactions
            WHERE created_at > NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at), transaction_type
            ORDER BY date DESC, transaction_type
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    // Calculate commission for an amount
    static calculateCommission(amount, config) {
        if (!config) {
            return {
                amount,
                commission: 0,
                net: amount,
                applied_config: null
            };
        }

        let commission = amount * (config.percentage / 100) + (config.fixed_amount || 0);

        // Apply min/max limits
        if (config.min_amount && commission < config.min_amount) {
            commission = config.min_amount;
        }

        if (config.max_amount && commission > config.max_amount) {
            commission = config.max_amount;
        }

        return {
            original_amount: amount,
            commission,
            net: amount - commission,
            applied_config: {
                id: config.id,
                name: config.name,
                percentage: config.percentage,
                fixed: config.fixed_amount
            }
        };
    }

    // Get total platform commission earnings
    static async getTotalEarnings() {
        const query = `
            SELECT 
                COALESCE(SUM(commission_amount), 0) as total_commission,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_commission,
                COALESCE(SUM(CASE WHEN status = 'collected' THEN commission_amount ELSE 0 END), 0) as collected_commission,
                COUNT(*) as total_transactions,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT creator_id) as unique_creators
            FROM commission_transactions
        `;

        const result = await pool.query(query);
        return result.rows[0];
    }
}

module.exports = CommissionModel;