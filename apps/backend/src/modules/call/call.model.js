// src/modules/call/call.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class CallModel {
    // Initiate a call
    static async initiate(callerId, receiverId, type) {
        // Check if users exist and are not blocked
        const blockCheck = await pool.query(
            `SELECT 1 FROM follows 
             WHERE (follower_id = $1 AND following_id = $2 AND status = 'blocked')
                OR (follower_id = $2 AND following_id = $1 AND status = 'blocked')`,
            [callerId, receiverId]
        );

        if (blockCheck.rows.length > 0) {
            throw new AppError('Cannot call this user', 403);
        }

        // Check if receiver is online
        const presenceCheck = await pool.query(
            'SELECT status FROM user_presence WHERE user_id = $1',
            [receiverId]
        );

        const query = `
            INSERT INTO calls (caller_id, receiver_id, type, status)
            VALUES ($1, $2, $3, 'initiated')
            RETURNING *
        `;

        const result = await pool.query(query, [callerId, receiverId, type]);
        const call = result.rows[0];

        // Add caller as participant
        await pool.query(
            `INSERT INTO call_participants (call_id, user_id, joined_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            [call.id, callerId]
        );

        return {
            ...call,
            receiver_online: presenceCheck.rows.length > 0 && presenceCheck.rows[0].status !== 'offline'
        };
    }

    // Accept a call
    static async accept(callId, userId) {
        // Check if user is the receiver
    const callCheck = await pool.query(
    'SELECT * FROM calls WHERE id = $1 AND receiver_id = $2 AND status = $3',
    [callId, userId, 'initiated']
);

        if (callCheck.rows.length === 0) {
            throw new AppError('Call not found or cannot be accepted', 404);
        }

        const query = `
            UPDATE calls 
            SET status = 'connected', started_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [callId]);

        // Add receiver as participant
        await pool.query(
            `INSERT INTO call_participants (call_id, user_id, joined_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            [callId, userId]
        );

        return result.rows[0];
    }

    // Reject a call
    static async reject(callId, userId, reason = 'rejected') {
        const query = `
            UPDATE calls 
            SET status = 'ended',
                ended_at = CURRENT_TIMESTAMP,
                end_reason = $3
            WHERE id = $1 AND receiver_id = $2 AND status = 'initiated'
            RETURNING *
        `;

        const result = await pool.query(query, [callId, userId, reason]);
        
        if (result.rows.length === 0) {
            throw new AppError('Call not found', 404);
        }

        return result.rows[0];
    }

    // End a call
    static async end(callId, userId) {
        // Get call details
        const call = await pool.query(
            'SELECT * FROM calls WHERE id = $1',
            [callId]
        );

        if (call.rows.length === 0) {
            throw new AppError('Call not found', 404);
        }

        const callData = call.rows[0];
        
        // Calculate duration if call was connected
        let duration = null;
        if (callData.started_at) {
            duration = Math.floor((Date.now() - new Date(callData.started_at)) / 1000);
        }

        const query = `
            UPDATE calls 
            SET status = 'ended',
                ended_at = CURRENT_TIMESTAMP,
                duration = $2,
                end_reason = 'user_ended'
            WHERE id = $1 AND (caller_id = $3 OR receiver_id = $3)
            RETURNING *
        `;

        const result = await pool.query(query, [callId, duration, userId]);

        // Update participant left_at
        await pool.query(
            `UPDATE call_participants 
             SET left_at = CURRENT_TIMESTAMP
             WHERE call_id = $1 AND user_id = $2`,
            [callId, userId]
        );

        return result.rows[0];
    }

    // Miss a call (when not answered)
    static async missCall(callId) {
        const query = `
            UPDATE calls 
            SET status = 'ended',
                ended_at = CURRENT_TIMESTAMP,
                end_reason = 'no_answer'
            WHERE id = $1 AND status = 'initiated'
            RETURNING *
        `;

        const result = await pool.query(query, [callId]);
        return result.rows[0];
    }

    // Get call history for user
    static async getHistory(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                c.*,
                caller.username as caller_username,
                caller.full_name as caller_name,
                caller.avatar_url as caller_avatar,
                receiver.username as receiver_username,
                receiver.full_name as receiver_name,
                receiver.avatar_url as receiver_avatar,
                
                -- Determine if user was caller or receiver
                CASE 
                    WHEN c.caller_id = $1 THEN 'outgoing'
                    ELSE 'incoming'
                END as direction
                
            FROM calls c
            JOIN users caller ON c.caller_id = caller.id
            JOIN users receiver ON c.receiver_id = receiver.id
            WHERE c.caller_id = $1 OR c.receiver_id = $1
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    // Get call details
    static async getCall(callId, userId) {
        const query = `
            SELECT 
                c.*,
                caller.username as caller_username,
                caller.full_name as caller_name,
                caller.avatar_url as caller_avatar,
                receiver.username as receiver_username,
                receiver.full_name as receiver_name,
                receiver.avatar_url as receiver_avatar,
                
                -- Participants
                (
                    SELECT json_agg(json_build_object(
                        'user_id', cp.user_id,
                        'username', u.username,
                        'joined_at', cp.joined_at,
                        'left_at', cp.left_at,
                        'is_video_enabled', cp.is_video_enabled,
                        'is_audio_enabled', cp.is_audio_enabled
                    ))
                    FROM call_participants cp
                    JOIN users u ON cp.user_id = u.id
                    WHERE cp.call_id = c.id
                ) as participants
                
            FROM calls c
            JOIN users caller ON c.caller_id = caller.id
            JOIN users receiver ON c.receiver_id = receiver.id
            WHERE c.id = $1 AND (c.caller_id = $2 OR c.receiver_id = $2)
        `;

        const result = await pool.query(query, [callId, userId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Call not found', 404);
        }

        return result.rows[0];
    }

    // Update call quality metrics
    static async updateQuality(callId, metrics) {
        const { quality_score, avg_bitrate, packet_loss, latency } = metrics;

        const query = `
            UPDATE calls 
            SET quality_score = $1,
                avg_bitrate = $2,
                packet_loss = $3,
                latency = $4
            WHERE id = $5
            RETURNING *
        `;

        const result = await pool.query(query, [quality_score, avg_bitrate, packet_loss, latency, callId]);
        return result.rows[0];
    }

    // Get call statistics for user
    static async getUserStats(userId) {
        const query = `
            SELECT
                COUNT(*) as total_calls,
                COUNT(CASE WHEN caller_id = $1 THEN 1 END) as outgoing_calls,
                COUNT(CASE WHEN receiver_id = $1 THEN 1 END) as incoming_calls,
                
                COUNT(CASE WHEN status = 'ended' AND caller_id = $1 THEN 1 END) as completed_outgoing,
                COUNT(CASE WHEN status = 'ended' AND receiver_id = $1 THEN 1 END) as completed_incoming,
                
                COUNT(CASE WHEN end_reason = 'missed' AND receiver_id = $1 THEN 1 END) as missed_calls,
                COUNT(CASE WHEN end_reason = 'rejected' AND receiver_id = $1 THEN 1 END) as rejected_calls,
                
                COALESCE(SUM(duration), 0) as total_duration,
                AVG(CASE WHEN caller_id = $1 THEN duration END) as avg_outgoing_duration,
                AVG(CASE WHEN receiver_id = $1 THEN duration END) as avg_incoming_duration
                
            FROM calls
            WHERE caller_id = $1 OR receiver_id = $1
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }
}

module.exports = CallModel;