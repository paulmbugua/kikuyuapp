// src/modules/promotion/promotion.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const TokenModel = require('../token/token.model');

class PromotionModel {
    // Get all promotion plans
    static async getPlans() {
        const query = `
            SELECT *
            FROM promotion_plans
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
                : 0,
            estimated_reach: plan.target_impressions,
            estimated_engagement: Math.floor(plan.target_impressions * 0.03) // 3% estimated engagement
        }));
    }

    // Get single plan
    static async getPlan(planId) {
        const query = `
            SELECT *
            FROM promotion_plans
            WHERE id = $1 AND is_active = true
        `;
        
        const result = await pool.query(query, [planId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Promotion plan not found', 404);
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

    // Create promotion for content with M-Pesa
    static async createWithMpesa(userId, planId, content, phoneNumber) {
        const plan = await this.getPlan(planId);
        
        // Validate content exists and user owns it
        await this.validateContent(userId, content.contentType, content.contentId);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Calculate end date
            const endsAt = new Date(Date.now() + plan.duration_hours * 60 * 60 * 1000);

            // Create promotion record
            const promotionResult = await client.query(
                `INSERT INTO promoted_content (
                    user_id, plan_id, content_type, content_id,
                    started_at, ends_at, target_impressions,
                    amount_paid, payment_method, audience_targeting
                ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, 'mpesa', $8)
                RETURNING *`,
                [
                    userId, planId, content.contentType, content.contentId,
                    endsAt, plan.target_impressions,
                    plan.price_kes, content.audience_targeting || null
                ]
            );

            // Create M-Pesa transaction
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
                    `PROMO-${userId.slice(0, 8)}`,
                    `Promote ${content.contentType} - ${plan.name}`
                ]
            );

            // Update promotion with M-Pesa transaction ID
            await client.query(
                'UPDATE promoted_content SET mpesa_transaction_id = $1 WHERE id = $2',
                [mpesaResult.rows[0].id, promotionResult.rows[0].id]
            );

            await client.query('COMMIT');

            return {
                promotion: promotionResult.rows[0],
                mpesa_transaction_id: mpesaResult.rows[0].id
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Create promotion for content with tokens
    static async createWithTokens(userId, planId, content) {
        const plan = await this.getPlan(planId);
        
        // Check if user has enough tokens
        const balanceCheck = await pool.query(
            'SELECT token_balance FROM users WHERE id = $1',
            [userId]
        );
        
        if (balanceCheck.rows[0].token_balance < plan.token_price) {
            throw new AppError('Insufficient token balance', 400);
        }

        // Validate content exists and user owns it
        await this.validateContent(userId, content.contentType, content.contentId);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Calculate end date
            const endsAt = new Date(Date.now() + plan.duration_hours * 60 * 60 * 1000);

            // Create promotion record
            const promotionResult = await client.query(
                `INSERT INTO promoted_content (
                    user_id, plan_id, content_type, content_id,
                    started_at, ends_at, target_impressions,
                    token_amount_used, payment_method, audience_targeting
                ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, 'tokens', $8)
                RETURNING *`,
                [
                    userId, planId, content.contentType, content.contentId,
                    endsAt, plan.target_impressions,
                    plan.token_price, content.audience_targeting || null
                ]
            );

            // Create token transaction
            const transaction = await TokenModel.createTransaction(
                userId,
                'promotion_purchase',
                plan.token_price,
                promotionResult.rows[0].id,
                'promotion',
                { 
                    plan_name: plan.name,
                    content_type: content.contentType,
                    content_id: content.contentId,
                    duration_hours: plan.duration_hours
                }
            );

            // Update promotion with transaction ID
            await client.query(
                'UPDATE promoted_content SET transaction_id = $1 WHERE id = $2',
                [transaction.id, promotionResult.rows[0].id]
            );

            await client.query('COMMIT');

            return promotionResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Validate content ownership and existence
    static async validateContent(userId, contentType, contentId) {
        let query;
        switch (contentType) {
            case 'post':
                query = 'SELECT id FROM posts WHERE id = $1 AND user_id = $2';
                break;
            case 'uhoro':
                query = 'SELECT id FROM uhoro_videos WHERE id = $1 AND user_id = $2';
                break;
            case 'profile':
                query = 'SELECT id FROM users WHERE id = $1 AND id = $2';
                break;
            default:
                throw new AppError('Invalid content type', 400);
        }

        const result = await pool.query(query, [contentId, userId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Content not found or you do not own it', 404);
        }
        
        return true;
    }

    // Get user's active promotions
    static async getUserPromotions(userId, status = 'active', limit = 50, offset = 0) {
        let query = `
            SELECT 
                p.*,
                prom.name as plan_name,
                prom.duration_hours,
                prom.target_impressions as planned_impressions,
                
                -- Progress percentage
                CASE 
                    WHEN p.target_impressions > 0 
                    THEN (p.current_impressions::float / p.target_impressions * 100)
                    ELSE 0
                END as progress_percentage,
                
                -- Time remaining
                EXTRACT(EPOCH FROM (p.ends_at - NOW())) / 3600 as hours_remaining,
                
                -- Content preview
                CASE 
                    WHEN p.content_type = 'post' THEN
                        (SELECT json_build_object('content', content, 'media_url', media_url)
                         FROM posts WHERE id = p.content_id)
                    WHEN p.content_type = 'uhoro' THEN
                        (SELECT json_build_object('title', title, 'thumbnail_url', thumbnail_url)
                         FROM uhoro_videos WHERE id = p.content_id)
                    ELSE NULL
                END as content_preview
                
            FROM promoted_content p
            JOIN promotion_plans prom ON p.plan_id = prom.id
            WHERE p.user_id = $1
        `;

        const values = [userId];
        let paramIndex = 2;

        if (status === 'active') {
            query += ` AND p.is_active = true AND p.ends_at > NOW()`;
        } else if (status === 'completed') {
            query += ` AND (p.ends_at <= NOW() OR p.is_active = false)`;
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM promoted_content WHERE user_id = $1';
        if (status === 'active') {
            countQuery += ' AND is_active = true AND ends_at > NOW()';
        } else if (status === 'completed') {
            countQuery += ' AND (ends_at <= NOW() OR is_active = false)';
        }

        const countResult = await pool.query(countQuery, [userId]);
        const total = parseInt(countResult.rows[0].count);

        return {
            promotions: result.rows,
            total
        };
    }

    // Track impression
    static async trackImpression(promotionId, userId = null, req = null) {
        const query = `
            INSERT INTO promotion_impressions (
                promotion_id, user_id, ip_address, user_agent, device_type
            ) VALUES ($1, $2, $3, $4, $5)
        `;

        const deviceType = this.detectDeviceType(req?.headers['user-agent']);
        
        await pool.query(query, [
            promotionId,
            userId,
            req?.ip,
            req?.headers['user-agent'],
            deviceType
        ]);

        // Check if promotion should be marked as complete
        await this.checkPromotionCompletion(promotionId);
    }

    // Track click
    static async trackClick(promotionId, userId = null, req = null) {
        const query = `
            INSERT INTO promotion_clicks (
                promotion_id, user_id, ip_address, user_agent, device_type
            ) VALUES ($1, $2, $3, $4, $5)
        `;

        await pool.query(query, [
            promotionId,
            userId,
            req?.ip,
            req?.headers['user-agent'],
            this.detectDeviceType(req?.headers['user-agent'])
        ]);

        // Update click-through rate
        await pool.query(
            `UPDATE promoted_content 
             SET ctr = (current_clicks + 1)::float / NULLIF(current_impressions, 0) * 100
             WHERE id = $1`,
            [promotionId]
        );
    }

    // Get promotion analytics
    static async getAnalytics(promotionId, userId) {
        // Check ownership
        const ownership = await pool.query(
            'SELECT user_id FROM promoted_content WHERE id = $1',
            [promotionId]
        );

        if (ownership.rows.length === 0 || ownership.rows[0].user_id !== userId) {
            throw new AppError('Promotion not found or access denied', 404);
        }

        const query = `
            WITH daily_stats AS (
                SELECT 
                    date,
                    impressions,
                    clicks,
                    unique_viewers
                FROM promotion_daily_stats
                WHERE promotion_id = $1
                ORDER BY date DESC
            ),
            demographics AS (
                SELECT 
                    device_type,
                    COUNT(*) as count
                FROM promotion_impressions
                WHERE promotion_id = $1
                GROUP BY device_type
            ),
            hourly_distribution AS (
                SELECT 
                    EXTRACT(HOUR FROM viewed_at) as hour,
                    COUNT(*) as impressions
                FROM promotion_impressions
                WHERE promotion_id = $1
                GROUP BY hour
                ORDER BY hour
            )
            SELECT 
                (SELECT json_agg(daily_stats) FROM daily_stats) as daily,
                (SELECT json_agg(demographics) FROM demographics) as devices,
                (SELECT json_agg(hourly_distribution) FROM hourly_distribution) as hourly,
                (
                    SELECT 
                        json_build_object(
                            'total_impressions', current_impressions,
                            'total_clicks', current_clicks,
                            'ctr', ctr,
                            'engagement_rate', engagement_rate,
                            'spent', amount_paid,
                            'impressions_remaining', GREATEST(target_impressions - current_impressions, 0),
                            'hours_remaining', EXTRACT(EPOCH FROM (ends_at - NOW())) / 3600
                        )
                    FROM promoted_content
                    WHERE id = $1
                ) as summary
        `;

        const result = await pool.query(query, [promotionId]);
        return result.rows[0];
    }

    // Check if promotion should be marked complete
    static async checkPromotionCompletion(promotionId) {
        await pool.query(
            `UPDATE promoted_content 
             SET is_active = false 
             WHERE id = $1 
                AND (current_impressions >= target_impressions OR ends_at <= NOW())`,
            [promotionId]
        );
    }

    // Detect device type from user agent
    static detectDeviceType(userAgent) {
        if (!userAgent) return 'unknown';
        
        if (userAgent.includes('Mobile')) return 'mobile';
        if (userAgent.includes('Tablet')) return 'tablet';
        if (userAgent.includes('TV')) return 'tv';
        return 'desktop';
    }

    // Get all active promotions (for feed)
    static async getActivePromotions(limit = 10) {
        const query = `
            SELECT 
                p.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                CASE 
                    WHEN p.content_type = 'post' THEN
                        (SELECT json_build_object('content', content, 'media_url', media_url)
                         FROM posts WHERE id = p.content_id)
                    WHEN p.content_type = 'uhoro' THEN
                        (SELECT json_build_object('title', title, 'video_url', video_url, 'thumbnail_url', thumbnail_url)
                         FROM uhoro_videos WHERE id = p.content_id)
                    ELSE NULL
                END as content_data
            FROM promoted_content p
            JOIN users u ON p.user_id = u.id
            WHERE p.is_active = true 
                AND p.ends_at > NOW()
                AND p.current_impressions < p.target_impressions
            ORDER BY p.created_at DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    // Cancel promotion
    static async cancelPromotion(promotionId, userId) {
        const query = `
            UPDATE promoted_content 
            SET is_active = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2 AND is_active = true
            RETURNING *
        `;

        const result = await pool.query(query, [promotionId, userId]);

        if (result.rows.length === 0) {
            throw new AppError('Promotion not found or already ended', 404);
        }

        return result.rows[0];
    }

    // Admin: Get all promotions
    static async getAllPromotions(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                p.*,
                u.username,
                u.email,
                prom.name as plan_name
            FROM promoted_content p
            JOIN users u ON p.user_id = u.id
            JOIN promotion_plans prom ON p.plan_id = prom.id
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        if (filters.user_id) {
            conditions.push(`p.user_id = $${values.length + 1}`);
            values.push(filters.user_id);
        }

        if (filters.status === 'active') {
            conditions.push(`p.is_active = true AND p.ends_at > NOW()`);
        } else if (filters.status === 'completed') {
            conditions.push(`(p.ends_at <= NOW() OR p.is_active = false)`);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM promoted_content p';
        if (filters.user_id) {
            countQuery += ' WHERE user_id = $1';
        }
        const countResult = await pool.query(
            countQuery, 
            filters.user_id ? [filters.user_id] : []
        );
        const total = parseInt(countResult.rows[0].count);

        return {
            promotions: result.rows,
            total
        };
    }

    // Get promotion statistics
    static async getStats() {
        const query = `
            SELECT
                COUNT(*) as total_promotions,
                COUNT(CASE WHEN is_active AND ends_at > NOW() THEN 1 END) as active_promotions,
                COALESCE(SUM(amount_paid), 0) as total_revenue,
                COALESCE(SUM(current_impressions), 0) as total_impressions,
                COALESCE(SUM(current_clicks), 0) as total_clicks,
                AVG(ctr) as avg_ctr,
                COUNT(DISTINCT user_id) as unique_advertisers
            FROM promoted_content
            WHERE created_at > NOW() - INTERVAL '30 days'
        `;

        const result = await pool.query(query);
        
        // Get performance by plan
        const planPerformance = await pool.query(`
            SELECT 
                prom.name,
                COUNT(p.id) as usage_count,
                AVG(p.ctr) as avg_ctr,
                SUM(p.current_impressions) as total_impressions
            FROM promoted_content p
            JOIN promotion_plans prom ON p.plan_id = prom.id
            GROUP BY prom.id, prom.name
            ORDER BY usage_count DESC
        `);

        return {
            summary: result.rows[0],
            plan_performance: planPerformance.rows
        };
    }
    // Add these missing methods to your promotion.model.js

// Get all active promotions (for feed)
static async getActivePromotions(limit = 10) {
    const query = `
        SELECT 
            p.*,
            u.username, 
            u.full_name, 
            u.avatar_url, 
            u.is_verified,
            prom.name as plan_name,
            CASE 
                WHEN p.content_type = 'post' THEN
                    (SELECT json_build_object('content', content, 'media_url', media_url, 'created_at', created_at)
                     FROM posts WHERE id = p.content_id AND is_active = true)
                WHEN p.content_type = 'uhoro' THEN
                    (SELECT json_build_object('title', title, 'video_url', video_url, 'thumbnail_url', thumbnail_url, 'created_at', created_at)
                     FROM uhoro_videos WHERE id = p.content_id AND is_active = true)
                WHEN p.content_type = 'profile' THEN
                    (SELECT json_build_object('bio', bio, 'avatar_url', avatar_url, 'cover_url', cover_url)
                     FROM users WHERE id = p.content_id)
                ELSE NULL
            END as content_data
        FROM promoted_content p
        JOIN users u ON p.user_id = u.id
        JOIN promotion_plans prom ON p.plan_id = prom.id
        WHERE p.is_active = true 
            AND p.ends_at > NOW()
            AND p.current_impressions < p.target_impressions
        ORDER BY p.created_at DESC
        LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
}

// Cancel promotion
static async cancelPromotion(promotionId, userId) {
    const query = `
        UPDATE promoted_content 
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND is_active = true
        RETURNING *
    `;

    const result = await pool.query(query, [promotionId, userId]);

    if (result.rows.length === 0) {
        throw new AppError('Promotion not found or already ended', 404);
    }

    return result.rows[0];
}

// Admin: Get all promotions
static async getAllPromotions(filters = {}, limit = 50, offset = 0) {
    let query = `
        SELECT 
            p.*,
            u.username,
            u.email,
            prom.name as plan_name
        FROM promoted_content p
        JOIN users u ON p.user_id = u.id
        JOIN promotion_plans prom ON p.plan_id = prom.id
        WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (filters.user_id) {
        query += ` AND p.user_id = $${paramCount}`;
        values.push(filters.user_id);
        paramCount++;
    }

    if (filters.status === 'active') {
        query += ` AND p.is_active = true AND p.ends_at > NOW()`;
    } else if (filters.status === 'completed') {
        query += ` AND (p.ends_at <= NOW() OR p.is_active = false)`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM promoted_content p WHERE 1=1';
    if (filters.user_id) {
        countQuery += ` AND user_id = $1`;
    }
    const countResult = await pool.query(
        countQuery, 
        filters.user_id ? [filters.user_id] : []
    );
    const total = parseInt(countResult.rows[0].count);

    return {
        promotions: result.rows,
        total
    };
}

// Get promotion statistics
static async getStats() {
    const query = `
        SELECT
            COUNT(*) as total_promotions,
            COUNT(CASE WHEN is_active AND ends_at > NOW() THEN 1 END) as active_promotions,
            COALESCE(SUM(amount_paid), 0) as total_revenue,
            COALESCE(SUM(current_impressions), 0) as total_impressions,
            COALESCE(SUM(current_clicks), 0) as total_clicks,
            AVG(ctr) as avg_ctr,
            COUNT(DISTINCT user_id) as unique_advertisers
        FROM promoted_content
        WHERE created_at > NOW() - INTERVAL '30 days'
    `;

    const result = await pool.query(query);
    
    // Get performance by plan
    const planPerformance = await pool.query(`
        SELECT 
            prom.name,
            COUNT(p.id) as usage_count,
            AVG(p.ctr) as avg_ctr,
            SUM(p.current_impressions) as total_impressions
        FROM promoted_content p
        JOIN promotion_plans prom ON p.plan_id = prom.id
        GROUP BY prom.id, prom.name
        ORDER BY usage_count DESC
    `);

    return {
        summary: result.rows[0],
        plan_performance: planPerformance.rows
    };
}
}

module.exports = PromotionModel;