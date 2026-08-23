// src/modules/wallet/wallet.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const { calculateWithdrawalFee, tokensToKES } = require('../../utils/currency');

class WalletModel {
    // Request withdrawal
    static async requestWithdrawal(userId, amount, method, accountDetails) {
        // Check if user has enough tokens
        const balanceCheck = await pool.query(
            'SELECT token_balance FROM users WHERE id = $1',
            [userId]
        );
        
        if (balanceCheck.rows.length === 0) {
            throw new AppError('User not found', 404);
        }
        
        const balance = parseInt(balanceCheck.rows[0].token_balance);
        
        if (balance < amount) {
            throw new AppError('Insufficient token balance', 400);
        }

        // Check minimum withdrawal amount (e.g., 500 tokens minimum)
        const MIN_WITHDRAWAL = 500;
        if (amount < MIN_WITHDRAWAL) {
            throw new AppError(`Minimum withdrawal is ${MIN_WITHDRAWAL} tokens`, 400);
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Calculate KES equivalent and fees
            const kesAmount = tokensToKES(amount);
            const { fee, netAmount } = calculateWithdrawalFee(kesAmount);

            // Create withdrawal request
            const query = `
                INSERT INTO withdrawals (
                    user_id, amount, token_amount, method, account_details,
                    metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;
            
            const result = await client.query(query, [
                userId,
                kesAmount,
                amount,
                method,
                accountDetails,
                { fee, net_amount: netAmount }
            ]);

            await client.query('COMMIT');
            
            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get user's withdrawals
    static async getUserWithdrawals(userId, limit = 50, offset = 0) {
        const query = `
            SELECT *
            FROM withdrawals
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM withdrawals WHERE user_id = $1',
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        
        return {
            withdrawals: result.rows,
            total
        };
    }

    // Get single withdrawal
    static async getWithdrawal(withdrawalId, userId = null) {
        let query = 'SELECT * FROM withdrawals WHERE id = $1';
        const params = [withdrawalId];
        
        if (userId) {
            query += ' AND user_id = $2';
            params.push(userId);
        }
        
        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            throw new AppError('Withdrawal not found', 404);
        }
        
        return result.rows[0];
    }

    // Admin: Get all withdrawal requests
    static async getAllWithdrawals(status = null, limit = 50, offset = 0) {
        let query = 'SELECT * FROM withdrawals';
        const params = [];
        
        if (status) {
            query += ' WHERE status = $1';
            params.push(status);
        }
        
        query += ' ORDER BY created_at ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM withdrawals';
        if (status) {
            countQuery += ' WHERE status = $1';
        }
        
        const countResult = await pool.query(countQuery, status ? [status] : []);
        const total = parseInt(countResult.rows[0].count);
        
        return {
            withdrawals: result.rows,
            total
        };
    }

    // Admin: Approve withdrawal
    static async approveWithdrawal(withdrawalId, adminId, notes = null) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Get withdrawal details
           const withdrawal = await client.query(
    'SELECT * FROM withdrawals WHERE id = $1 AND status = $2',
    [withdrawalId, 'pending']
);
            
            if (withdrawal.rows.length === 0) {
                throw new AppError('Withdrawal not found or already processed', 404);
            }

            const w = withdrawal.rows[0];

            // Create token transaction
            const transactionResult = await client.query(
                `INSERT INTO token_transactions (
                    user_id, type, amount, balance_before, balance_after,
                    reference_id, reference_type, metadata
                ) VALUES ($1, 'withdrawal', $2, 
                    (SELECT token_balance FROM users WHERE id = $1),
                    (SELECT token_balance - $2 FROM users WHERE id = $1),
                    $3, 'withdrawal', $4
                ) RETURNING *`,
                [w.user_id, w.token_amount, withdrawalId, { approved_by: adminId }]
            );

            // Update withdrawal
            const result = await client.query(
                `UPDATE withdrawals 
                 SET status = 'approved',
                     approved_by = $1,
                     approved_at = CURRENT_TIMESTAMP,
                     transaction_id = $2,
                     notes = COALESCE($3, notes)
                 WHERE id = $4
                 RETURNING *`,
                [adminId, transactionResult.rows[0].id, notes, withdrawalId]
            );

            await client.query('COMMIT');
            
            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Admin: Process withdrawal (mark as processing)
    static async processWithdrawal(withdrawalId, adminId) {
        const result = await pool.query(
            `UPDATE withdrawals 
             SET status = 'processing',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'approved'
             RETURNING *`,
            [withdrawalId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Withdrawal not found or not in approved state', 404);
        }
        
        return result.rows[0];
    }

    // Admin: Complete withdrawal
    static async completeWithdrawal(withdrawalId, adminId, transactionReference) {
        const result = await pool.query(
            `UPDATE withdrawals 
             SET status = 'completed',
                 completed_at = CURRENT_TIMESTAMP,
                 transaction_reference = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND status = 'processing'
             RETURNING *`,
            [transactionReference, withdrawalId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Withdrawal not found or not in processing state', 404);
        }
        
        return result.rows[0];
    }

    // Admin: Reject withdrawal
    static async rejectWithdrawal(withdrawalId, adminId, reason) {
        const result = await pool.query(
            `UPDATE withdrawals 
             SET status = 'rejected',
                 rejection_reason = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND status = 'pending'
             RETURNING *`,
            [reason, withdrawalId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Withdrawal not found or not in pending state', 404);
        }
        
        return result.rows[0];
    }

    // Cancel withdrawal (user action)
    static async cancelWithdrawal(withdrawalId, userId) {
        const result = await pool.query(
            `UPDATE withdrawals 
             SET status = 'cancelled',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2 AND status = 'pending'
             RETURNING *`,
            [withdrawalId, userId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Withdrawal not found or cannot be cancelled', 404);
        }
        
        return result.rows[0];
    }

    // Get withdrawal statistics
    static async getWithdrawalStats(period = 'month') {
        const interval = period === 'week' ? '7 days' : '30 days';
        
        const query = `
            SELECT
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_completed_amount,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_withdrawal_amount
            FROM withdrawals
            WHERE created_at > NOW() - INTERVAL '${interval}'
        `;
        
        const result = await pool.query(query);
        return result.rows[0];
    }
}

module.exports = WalletModel;