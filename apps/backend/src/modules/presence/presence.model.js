// src/modules/presence/presence.model.js
const pool = require('../../config/db');

class PresenceModel {
    // Update user presence
    static async updatePresence(userId, status, socketId = null, deviceInfo = null) {
        const query = `
            INSERT INTO user_presence (user_id, status, last_seen_at, last_active_at, socket_id, device_info)
            VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, $4)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                status = $2,
                last_seen_at = CASE WHEN $2 != 'offline' THEN CURRENT_TIMESTAMP ELSE last_seen_at END,
                last_active_at = CURRENT_TIMESTAMP,
                socket_id = COALESCE($3, user_presence.socket_id),
                device_info = COALESCE($4, user_presence.device_info),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pool.query(query, [userId, status, socketId, deviceInfo]);
        return result.rows[0];
    }

    // Set user offline (on disconnect)
    static async setOffline(userId) {
        const query = `
            UPDATE user_presence 
            SET status = 'offline',
                last_seen_at = CURRENT_TIMESTAMP,
                socket_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }

    // Get user presence
    static async getUserPresence(userId) {
        const query = `
            SELECT 
                user_id,
                status,
                last_seen_at,
                last_active_at,
                EXTRACT(EPOCH FROM (NOW() - last_seen_at)) as seconds_since_last_seen
            FROM user_presence
            WHERE user_id = $1
        `;

        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return {
                user_id: userId,
                status: 'offline',
                last_seen_at: null,
                last_active_at: null,
                seconds_since_last_seen: null
            };
        }

        return result.rows[0];
    }

    // Get presence for multiple users
    static async getUsersPresence(userIds) {
        if (userIds.length === 0) return [];

        const query = `
            SELECT 
                user_id,
                status,
                last_seen_at,
                EXTRACT(EPOCH FROM (NOW() - last_seen_at)) as seconds_since_last_seen
            FROM user_presence
            WHERE user_id = ANY($1::uuid[])
        `;

        const result = await pool.query(query, [userIds]);
        
        // Create map for quick lookup
        const presenceMap = {};
        result.rows.forEach(p => {
            presenceMap[p.user_id] = p;
        });

        // Return in same order as input
        return userIds.map(id => 
            presenceMap[id] || {
                user_id: id,
                status: 'offline',
                last_seen_at: null,
                seconds_since_last_seen: null
            }
        );
    }

    // Get online followers
    static async getOnlineFollowers(userId) {
        const query = `
            SELECT 
                u.id, u.username, u.full_name, u.avatar_url,
                p.status, p.last_active_at
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            JOIN user_presence p ON u.id = p.user_id
            WHERE f.following_id = $1 
                AND f.status = 'accepted'
                AND p.status != 'offline'
            ORDER BY p.last_active_at DESC
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    // Update last active timestamp (for "seen recently")
    static async updateLastActive(userId) {
        const query = `
            UPDATE user_presence 
            SET last_active_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING last_active_at
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }

    // Clean up stale presence records (run periodically)
    static async cleanupStalePresence() {
        const query = `
            UPDATE user_presence 
            SET status = 'offline',
                socket_id = NULL
            WHERE updated_at < NOW() - INTERVAL '5 minutes'
                AND status != 'offline'
            RETURNING COUNT(*) as updated_count
        `;

        const result = await pool.query(query);
        return result.rows[0].updated_count;
    }
}

module.exports = PresenceModel;