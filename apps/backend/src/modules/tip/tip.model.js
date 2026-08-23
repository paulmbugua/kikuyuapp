// src/modules/tip/tip.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const TokenModel = require('../token/token.model');

class TipModel {
    // Send a tip
    static async send(senderId, tipData) {
        const {
            receiverId,
            amount,
            contentType,
            contentId,
            message,
            isAnonymous = false,
            isPublic = true
        } = tipData;

        // Check if sender has enough tokens
        const balanceCheck = await pool.query(
            'SELECT token_balance FROM users WHERE id = $1',
            [senderId]
        );
        
        if (balanceCheck.rows.length === 0) {
            throw new AppError('Sender not found', 404);
        }
        
        if (balanceCheck.rows[0].token_balance < amount) {
            throw new AppError('Insufficient token balance', 400);
        }

        // Check if receiver exists
        const receiverCheck = await pool.query(
            'SELECT id, username FROM users WHERE id = $1 AND is_active = true',
            [receiverId]
        );
        
        if (receiverCheck.rows.length === 0) {
            throw new AppError('Receiver not found', 404);
        }

        // Check if trying to tip self
        if (senderId === receiverId) {
            throw new AppError('You cannot tip yourself', 400);
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Create tip record
            const tipResult = await client.query(
                `INSERT INTO tips (
                    sender_id, receiver_id, amount, tokens_equivalent,
                    content_type, content_id, message, is_anonymous, is_public
                ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)
                RETURNING *`,
                [senderId, receiverId, amount, contentType, contentId, message, isAnonymous, isPublic]
            );
            
            const tip = tipResult.rows[0];

            // Create sender transaction (debit)
            const senderTransaction = await TokenModel.createTransaction(
                senderId,
                'tip_sent',
                amount,
                tip.id,
                'tip',
                { receiver_id: receiverId, is_anonymous: isAnonymous }
            );

            // Create receiver transaction (credit)
            const receiverTransaction = await TokenModel.createTransaction(
                receiverId,
                'tip_received',
                amount,
                tip.id,
                'tip',
                { sender_id: senderId, is_anonymous: isAnonymous }
            );

            // Update tip with transaction IDs
            await client.query(
                'UPDATE tips SET transaction_id = $1 WHERE id = $2',
                [senderTransaction.id, tip.id]
            );

            // Update content tip counts if content exists
            if (contentType && contentId) {
                await this.updateContentTipCount(client, contentType, contentId, amount);
            }

            await client.query('COMMIT');

            // Get complete tip details
            return this.getTipById(tip.id, senderId);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get tip by ID
    static async getTipById(tipId, currentUserId = null) {
        const query = `
            SELECT 
                t.*,
                -- Sender details (if not anonymous or current user is sender/receiver)
                CASE 
                    WHEN NOT t.is_anonymous OR $1 = t.sender_id OR $1 = t.receiver_id THEN
                        json_build_object(
                            'id', s.id,
                            'username', s.username,
                            'full_name', s.full_name,
                            'avatar_url', s.avatar_url,
                            'is_verified', s.is_verified
                        )
                    ELSE
                        json_build_object('is_anonymous', true)
                END as sender,
                
                -- Receiver details
                json_build_object(
                    'id', r.id,
                    'username', r.username,
                    'full_name', r.full_name,
                    'avatar_url', r.avatar_url,
                    'is_verified', r.is_verified
                ) as receiver,
                
                -- Content details if applicable
                CASE 
                    WHEN t.content_type = 'post' THEN
                        (SELECT json_build_object('id', id, 'content', content) FROM posts WHERE id = t.content_id)
                    WHEN t.content_type = 'uhoro' THEN
                        (SELECT json_build_object('id', id, 'title', title) FROM uhoro_videos WHERE id = t.content_id)
                    ELSE NULL
                END as content
                
            FROM tips t
            JOIN users s ON t.sender_id = s.id
            JOIN users r ON t.receiver_id = r.id
            WHERE t.id = $1
        `;
        
        const result = await pool.query(query, [tipId, currentUserId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Tip not found', 404);
        }
        
        return result.rows[0];
    }

    // Get tips sent by user
    static async getSentTips(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                t.*,
                json_build_object(
                    'id', r.id,
                    'username', r.username,
                    'full_name', r.full_name,
                    'avatar_url', r.avatar_url,
                    'is_verified', r.is_verified
                ) as receiver,
                t.created_at
                
            FROM tips t
            JOIN users r ON t.receiver_id = r.id
            WHERE t.sender_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM tips WHERE sender_id = $1',
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        
        return {
            tips: result.rows,
            total
        };
    }

    // Get tips received by user
    static async getReceivedTips(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                t.*,
                CASE 
                    WHEN t.is_anonymous THEN json_build_object('is_anonymous', true)
                    ELSE json_build_object(
                        'id', s.id,
                        'username', s.username,
                        'full_name', s.full_name,
                        'avatar_url', s.avatar_url,
                        'is_verified', s.is_verified
                    )
                END as sender,
                t.created_at
                
            FROM tips t
            JOIN users s ON t.sender_id = s.id
            WHERE t.receiver_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM tips WHERE receiver_id = $1',
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        
        return {
            tips: result.rows,
            total
        };
    }

    // Get tips for specific content
    static async getContentTips(contentType, contentId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                t.*,
                CASE 
                    WHEN t.is_anonymous THEN json_build_object('is_anonymous', true)
                    ELSE json_build_object(
                        'id', s.id,
                        'username', s.username,
                        'full_name', s.full_name,
                        'avatar_url', s.avatar_url,
                        'is_verified', s.is_verified
                    )
                END as sender,
                t.created_at
                
            FROM tips t
            JOIN users s ON t.sender_id = s.id
            WHERE t.content_type = $1 AND t.content_id = $2
            ORDER BY t.amount DESC, t.created_at DESC
            LIMIT $3 OFFSET $4
        `;
        
        const result = await pool.query(query, [contentType, contentId, limit, offset]);
        
        // Get total amount
        const sumResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM tips WHERE content_type = $1 AND content_id = $2',
            [contentType, contentId]
        );
        
        return {
            tips: result.rows,
            total_amount: parseInt(sumResult.rows[0].total)
        };
    }

    // Update content tip count
    static async updateContentTipCount(client, contentType, contentId, amount) {
        switch (contentType) {
            case 'post':
                await client.query(
                    'UPDATE posts SET tips_count = COALESCE(tips_count, 0) + $1 WHERE id = $2',
                    [amount, contentId]
                );
                break;
            case 'uhoro':
                await client.query(
                    'UPDATE uhoro_videos SET tips_count = COALESCE(tips_count, 0) + $1 WHERE id = $2',
                    [amount, contentId]
                );
                break;
        }
    }

    // Get tip leaderboard
    static async getLeaderboard(period = 'weekly', limit = 100) {
        const query = `
            SELECT 
                u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
                l.total_received,
                l.rank_received,
                l.total_sent,
                l.rank_sent
            FROM tip_leaderboard l
            JOIN users u ON l.user_id = u.id
            WHERE l.period = $1
            ORDER BY l.rank_received NULLS LAST
            LIMIT $2
        `;
        
        const result = await pool.query(query, [period, limit]);
        return result.rows;
    }

    // Get tip statistics
    static async getStats(userId = null) {
        if (userId) {
            // User-specific stats
            const query = `
                SELECT
                    COALESCE(SUM(CASE WHEN sender_id = $1 THEN amount END), 0) as total_sent,
                    COUNT(CASE WHEN sender_id = $1 THEN 1 END) as tips_sent_count,
                    COALESCE(SUM(CASE WHEN receiver_id = $1 THEN amount END), 0) as total_received,
                    COUNT(CASE WHEN receiver_id = $1 THEN 1 END) as tips_received_count,
                    COALESCE(AVG(CASE WHEN receiver_id = $1 THEN amount END), 0) as average_tip_received,
                    MAX(CASE WHEN receiver_id = $1 THEN amount END) as largest_tip_received,
                    MAX(CASE WHEN sender_id = $1 THEN created_at END) as last_tip_sent,
                    MAX(CASE WHEN receiver_id = $1 THEN created_at END) as last_tip_received
                FROM tips
                WHERE sender_id = $1 OR receiver_id = $1
            `;
            
            const result = await pool.query(query, [userId]);
            return result.rows[0];
        } else {
            // Global stats
            const query = `
                SELECT
                    COUNT(*) as total_tips,
                    COALESCE(SUM(amount), 0) as total_tokens_tipped,
                    AVG(amount) as average_tip_amount,
                    COUNT(DISTINCT sender_id) as unique_senders,
                    COUNT(DISTINCT receiver_id) as unique_receivers,
                    MAX(amount) as largest_tip,
                    COUNT(DISTINCT DATE(created_at)) as active_days
                FROM tips
                WHERE created_at > NOW() - INTERVAL '30 days'
            `;
            
            const result = await pool.query(query);
            return result.rows[0];
        }
    }

    // Admin: Get pending tips (for moderation if needed)
    static async getPendingModeration(limit = 50, offset = 0) {
        const query = `
            SELECT 
                t.*,
                json_build_object(
                    'id', s.id,
                    'username', s.username,
                    'full_name', s.full_name
                ) as sender,
                json_build_object(
                    'id', r.id,
                    'username', r.username,
                    'full_name', r.full_name
                ) as receiver
            FROM tips t
            JOIN users s ON t.sender_id = s.id
            JOIN users r ON t.receiver_id = r.id
            WHERE t.status = 'pending'
            ORDER BY t.created_at ASC
            LIMIT $1 OFFSET $2
        `;
        
        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }
}

module.exports = TipModel;