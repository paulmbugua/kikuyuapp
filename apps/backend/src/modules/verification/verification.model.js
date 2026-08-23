// src/modules/verification/verification.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const TokenModel = require('../token/token.model');

class VerificationModel {
    // Get all verification plans
    static async getPlans() {
        const query = `
            SELECT *
            FROM verification_plans
            WHERE is_active = true
            ORDER BY sort_order, price_kes ASC
        `;
        
        const result = await pool.query(query);
        
        // Calculate prices with discounts
        return result.rows.map(plan => ({
            ...plan,
            discounted_price: plan.discount_percentage > 0 
                ? plan.price_kes * (1 - plan.discount_percentage / 100)
                : plan.price_kes,
            savings: plan.discount_percentage > 0
                ? plan.price_kes * (plan.discount_percentage / 100)
                : 0
        }));
    }

    // Get single plan
    static async getPlan(planId) {
        const query = `
            SELECT *
            FROM verification_plans
            WHERE id = $1 AND is_active = true
        `;
        
        const result = await pool.query(query, [planId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Verification plan not found', 404);
        }
        
        const plan = result.rows[0];
        return {
            ...plan,
            discounted_price: plan.discount_percentage > 0 
                ? plan.price_kes * (1 - plan.discount_percentage / 100)
                : plan.price_kes,
            savings: plan.discount_percentage > 0
                ? plan.price_kes * (plan.discount_percentage / 100)
                : 0
        };
    }

    // Purchase verification with M-Pesa
    static async purchaseWithMpesa(userId, planId, phoneNumber) {
        const plan = await this.getPlan(planId);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Calculate expiry date
            const expiresAt = plan.duration_months 
                ? new Date(Date.now() + plan.duration_months * 30 * 24 * 60 * 60 * 1000)
                : null;

            // Create verification record
            const verificationResult = await client.query(
                `INSERT INTO user_verifications (
                    user_id, plan_id, started_at, expires_at, 
                    is_lifetime, amount_paid, payment_method
                ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, 'mpesa')
                RETURNING *`,
                [userId, planId, expiresAt, !plan.duration_months, plan.price_kes]
            );

            // Create M-Pesa transaction record
            const mpesaResult = await client.query(
                `INSERT INTO mpesa_transactions (
                    user_id, amount, phone_number, account_reference, 
                    transaction_desc, status
                ) VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING id`,
                [
                    userId, 
                    plan.price_kes, 
                    phoneNumber,
                    `VERIFY-${userId.slice(0, 8)}`,
                    `Verification badge purchase - ${plan.name}`
                ]
            );

            // Update verification with M-Pesa transaction ID
            await client.query(
                'UPDATE user_verifications SET mpesa_transaction_id = $1 WHERE id = $2',
                [mpesaResult.rows[0].id, verificationResult.rows[0].id]
            );

            await client.query('COMMIT');

            // Log verification history
            await this.logHistory(
                userId, 
                planId, 
                'purchased',
                { method: 'mpesa', amount: plan.price_kes }
            );

            return {
                verification: verificationResult.rows[0],
                mpesa_transaction_id: mpesaResult.rows[0].id
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Purchase verification with tokens
    static async purchaseWithTokens(userId, planId) {
        const plan = await this.getPlan(planId);
        
        // Check if user has enough tokens
        const balanceCheck = await pool.query(
            'SELECT token_balance FROM users WHERE id = $1',
            [userId]
        );
        
        if (balanceCheck.rows[0].token_balance < plan.token_price) {
            throw new AppError('Insufficient token balance', 400);
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Calculate expiry date
            const expiresAt = plan.duration_months 
                ? new Date(Date.now() + plan.duration_months * 30 * 24 * 60 * 60 * 1000)
                : null;

            // Create verification record
            const verificationResult = await client.query(
                `INSERT INTO user_verifications (
                    user_id, plan_id, started_at, expires_at, 
                    is_lifetime, token_amount_used, payment_method
                ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, 'tokens')
                RETURNING *`,
                [userId, planId, expiresAt, !plan.duration_months, plan.token_price]
            );

            // Create token transaction
            const transaction = await TokenModel.createTransaction(
                userId,
                'verification_purchase',
                plan.token_price,
                verificationResult.rows[0].id,
                'verification',
                { plan_name: plan.name }
            );

            // Update verification with transaction ID
            await client.query(
                'UPDATE user_verifications SET transaction_id = $1 WHERE id = $2',
                [transaction.id, verificationResult.rows[0].id]
            );

            await client.query('COMMIT');

            // Log verification history
            await this.logHistory(
                userId, 
                planId, 
                'purchased',
                { method: 'tokens', tokens: plan.token_price }
            );

            return verificationResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get user's verification status
    static async getUserVerification(userId) {
        const query = `
            SELECT 
                uv.*,
                vp.name as plan_name,
                vp.duration_months,
                vp.features,
                vp.price_kes
            FROM user_verifications uv
            JOIN verification_plans vp ON uv.plan_id = vp.id
            WHERE uv.user_id = $1 AND uv.is_active = true
            ORDER BY uv.created_at DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const verification = result.rows[0];
        
        // Calculate days remaining
        if (verification.expires_at && !verification.is_lifetime) {
            const daysRemaining = Math.ceil(
                (new Date(verification.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
            );
            verification.days_remaining = daysRemaining;
        }
        
        return verification;
    }

    // Get user's verification history
    static async getHistory(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                vh.*,
                vp.name as plan_name
            FROM verification_history vh
            LEFT JOIN verification_plans vp ON vh.plan_id = vp.id
            WHERE vh.user_id = $1
            ORDER BY vh.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM verification_history WHERE user_id = $1',
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        
        return {
            history: result.rows,
            total
        };
    }

    // Auto-renew verification
    static async autoRenew(userId) {
        const verification = await this.getUserVerification(userId);
        
        if (!verification || !verification.auto_renew) {
            throw new AppError('No active auto-renewable verification found', 404);
        }
        
        if (verification.is_lifetime) {
            throw new AppError('Lifetime verification cannot be renewed', 400);
        }

        // Purchase new verification with same plan
        return this.purchaseWithTokens(userId, verification.plan_id);
    }

    // Cancel auto-renew
    static async cancelAutoRenew(userId) {
        const query = `
            UPDATE user_verifications
            SET auto_renew = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_active = true
            RETURNING *
        `;
        
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            throw new AppError('No active verification found', 404);
        }
        
        return result.rows[0];
    }

    // Admin: Grant verification (free)
    static async grantVerification(userId, staffId, planId, reason) {
        const plan = await this.getPlan(planId);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Calculate expiry date
            const expiresAt = plan.duration_months 
                ? new Date(Date.now() + plan.duration_months * 30 * 24 * 60 * 60 * 1000)
                : null;

            // Create verification record
            const verificationResult = await client.query(
                `INSERT INTO user_verifications (
                    user_id, plan_id, started_at, expires_at, 
                    is_lifetime, granted_by, payment_method
                ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, 'granted')
                RETURNING *`,
                [userId, planId, expiresAt, !plan.duration_months, staffId]
            );

            // Log verification history
            await this.logHistory(
                userId, 
                planId, 
                'granted',
                { granted_by: staffId, reason }
            );

            await client.query('COMMIT');

            return verificationResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Admin: Revoke verification
    static async revokeVerification(userId, staffId, reason) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Update verification
            const result = await client.query(
                `UPDATE user_verifications
                 SET is_active = false,
                     revoked_by = $1,
                     revoked_at = CURRENT_TIMESTAMP,
                     revocation_reason = $2
                 WHERE user_id = $3 AND is_active = true
                 RETURNING *`,
                [staffId, reason, userId]
            );

            if (result.rows.length === 0) {
                throw new AppError('No active verification found for user', 404);
            }

            // Log verification history
            await this.logHistory(
                userId,
                result.rows[0].plan_id,
                'revoked',
                { revoked_by: staffId, reason }
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

    // Log verification history
    static async logHistory(userId, planId, action, metadata = {}) {
        const query = `
            INSERT INTO verification_history (
                user_id, plan_id, action, metadata
            ) VALUES ($1, $2, $3, $4)
        `;
        
        await pool.query(query, [userId, planId, action, JSON.stringify(metadata)]);
    }

    // Get verification statistics
    static async getStats() {
        const query = `
            SELECT
                COUNT(DISTINCT user_id) as total_verified_users,
                COUNT(CASE WHEN is_lifetime THEN 1 END) as lifetime_verifications,
                COUNT(CASE WHEN expires_at < NOW() + INTERVAL '7 days' AND expires_at > NOW() THEN 1 END) as expiring_soon,
                COUNT(CASE WHEN auto_renew THEN 1 END) as auto_renew_enabled,
                COALESCE(SUM(amount_paid), 0) as total_revenue,
                AVG(amount_paid) as average_payment
            FROM user_verifications
            WHERE is_active = true
        `;
        
        const result = await pool.query(query);
        
        // Get popular plans
        const plansQuery = `
            SELECT 
                vp.name,
                COUNT(uv.id) as subscriber_count
            FROM verification_plans vp
            LEFT JOIN user_verifications uv ON vp.id = uv.plan_id AND uv.is_active = true
            GROUP BY vp.id, vp.name
            ORDER BY subscriber_count DESC
        `;
        
        const plansResult = await pool.query(plansQuery);
        
        return {
            summary: result.rows[0],
            popular_plans: plansResult.rows
        };
    }
}

module.exports = VerificationModel;