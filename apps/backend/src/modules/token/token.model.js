// src/modules/token/token.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const { calculateBonus } = require('../../utils/currency');

class TokenModel {
    // Get user token balance
    static async getBalance(userId) {
        const result = await pool.query(
            'SELECT token_balance FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }
        
        return {
            user_id: userId,
            balance: parseInt(result.rows[0].token_balance),
            formatted: new Intl.NumberFormat().format(result.rows[0].token_balance) + ' tokens'
        };
    }

    // Create token transaction
    static async createTransaction(userId, type, amount, referenceId = null, referenceType = null, metadata = {}) {
        // Get current balance
        const balanceResult = await pool.query(
            'SELECT token_balance FROM users WHERE id = $1',
            [userId]
        );
        
        if (balanceResult.rows.length === 0) {
            throw new AppError('User not found', 404);
        }
        
        const balanceBefore = parseInt(balanceResult.rows[0].token_balance);
        let balanceAfter;
        
        // Calculate new balance based on transaction type
        if (type.includes('sent') || type === 'withdrawal') {
            if (balanceBefore < amount) {
                throw new AppError('Insufficient token balance', 400);
            }
            balanceAfter = balanceBefore - amount;
        } else {
            balanceAfter = balanceBefore + amount;
        }
        
        const query = `
            INSERT INTO token_transactions (
                user_id, type, amount, balance_before, balance_after,
                reference_id, reference_type, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            userId, type, amount, balanceBefore, balanceAfter,
            referenceId, referenceType, metadata
        ]);
        
        return result.rows[0];
    }

    // Get transaction history
    static async getHistory(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                t.*,
                CASE 
                    WHEN t.reference_type = 'tip' AND t.type = 'tip_sent' THEN
                        (SELECT json_build_object(
                            'username', u.username,
                            'full_name', u.full_name,
                            'avatar_url', u.avatar_url
                        ) FROM tips ti
                        JOIN users u ON ti.receiver_id = u.id
                        WHERE ti.id = t.reference_id)
                    WHEN t.reference_type = 'tip' AND t.type = 'tip_received' THEN
                        (SELECT json_build_object(
                            'username', u.username,
                            'full_name', u.full_name,
                            'avatar_url', u.avatar_url
                        ) FROM tips ti
                        JOIN users u ON ti.sender_id = u.id
                        WHERE ti.id = t.reference_id)
                    ELSE NULL
                END as related_user
                
            FROM token_transactions t
            WHERE t.user_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM token_transactions WHERE user_id = $1',
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        
        return {
            transactions: result.rows,
            total,
            balance: await this.getBalance(userId)
        };
    }

    // Get all token packages
    static async getPackages() {
        const result = await pool.query(
            'SELECT * FROM token_packages WHERE is_active = true ORDER BY sort_order'
        );
        
        // Calculate bonuses for display
        return result.rows.map(pkg => ({
            ...pkg,
            bonus_tokens: Math.floor(pkg.token_amount * (pkg.bonus_percentage / 100)),
            total_tokens: pkg.token_amount + Math.floor(pkg.token_amount * (pkg.bonus_percentage / 100))
        }));
    }

    // Get single package
    static async getPackage(packageId) {
        const result = await pool.query(
            'SELECT * FROM token_packages WHERE id = $1 AND is_active = true',
            [packageId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Token package not found', 404);
        }
        
        const pkg = result.rows[0];
        return {
            ...pkg,
            bonus_tokens: Math.floor(pkg.token_amount * (pkg.bonus_percentage / 100)),
            total_tokens: pkg.token_amount + Math.floor(pkg.token_amount * (pkg.bonus_percentage / 100))
        };
    }

    // Process token purchase (after M-Pesa success)
    static async processPurchase(userId, mpesaTransaction) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get package details
            const packageResult = await client.query(
                'SELECT * FROM token_packages WHERE id = $1',
                [mpesaTransaction.package_id]
            );
            
            if (packageResult.rows.length === 0) {
                throw new AppError('Token package not found', 404);
            }
            
            const pkg = packageResult.rows[0];
            const bonus = Math.floor(pkg.token_amount * (pkg.bonus_percentage / 100));
            const totalTokens = pkg.token_amount + bonus;
            
            // Create token transaction
            const transaction = await this.createTransaction(
                userId,
                'purchase',
                totalTokens,
                mpesaTransaction.id,
                'mpesa_purchase',
                {
                    package_id: pkg.id,
                    package_name: pkg.name,
                    base_amount: pkg.token_amount,
                    bonus_percentage: pkg.bonus_percentage,
                    bonus_tokens: bonus,
                    amount_paid: mpesaTransaction.amount,
                    mpesa_receipt: mpesaTransaction.mpesa_receipt_number
                }
            );
            
            // Update M-Pesa transaction with token transaction ID
            await client.query(
                'UPDATE mpesa_transactions SET transaction_id = $1 WHERE id = $2',
                [transaction.id, mpesaTransaction.id]
            );
            
            await client.query('COMMIT');
            
            return {
                transaction,
                tokens_added: totalTokens,
                new_balance: transaction.balance_after
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Admin: Create custom token package
    static async createPackage(data) {
        const { name, description, token_amount, price_kes, bonus_percentage, is_popular, sort_order } = data;
        
        const query = `
            INSERT INTO token_packages (
                name, description, token_amount, price_kes, bonus_percentage, is_popular, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            name, description, token_amount, price_kes, bonus_percentage, is_popular, sort_order
        ]);
        
        return result.rows[0];
    }

    // Admin: Update token package
    static async updatePackage(packageId, data) {
        const allowedFields = ['name', 'description', 'token_amount', 'price_kes', 'bonus_percentage', 'is_popular', 'is_active', 'sort_order'];
        
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
        
        values.push(packageId);
        const query = `
            UPDATE token_packages 
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            throw new AppError('Package not found', 404);
        }
        
        return result.rows[0];
    }

    // Get token statistics for user
    static async getUserStats(userId) {
        const query = `
            SELECT
                COUNT(CASE WHEN type = 'purchase' THEN 1 END) as total_purchases,
                SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END) as total_purchased,
                COUNT(CASE WHEN type = 'tip_sent' THEN 1 END) as tips_sent_count,
                SUM(CASE WHEN type = 'tip_sent' THEN amount ELSE 0 END) as total_tips_sent,
                COUNT(CASE WHEN type = 'tip_received' THEN 1 END) as tips_received_count,
                SUM(CASE WHEN type = 'tip_received' THEN amount ELSE 0 END) as total_tips_received,
                MAX(CASE WHEN type = 'purchase' THEN created_at END) as last_purchase_date
            FROM token_transactions
            WHERE user_id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }
}

module.exports = TokenModel;