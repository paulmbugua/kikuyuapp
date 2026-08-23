// src/modules/rugano/rugano.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class RuganoModel {
    // Create a new voice space
    static async createSpace(hostId, spaceData) {
        const { title, topic, description, isPrivate, scheduledFor, maxParticipants } = spaceData;

        const query = `
            INSERT INTO voice_spaces (
                host_id, title, topic, description, is_private, 
                scheduled_for, max_participants, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
            RETURNING *
        `;

        const values = [
            hostId, title, topic, description, isPrivate || false,
            scheduledFor || null, maxParticipants || 500
        ];

        const result = await pool.query(query, values);
        const space = result.rows[0];

        // Add host as participant
        await pool.query(
            `INSERT INTO voice_space_participants (space_id, user_id, role, is_muted)
             VALUES ($1, $2, 'host', false)`,
            [space.id, hostId]
        );

        return space;
    }

    // Start a live space
    static async startSpace(spaceId, hostId) {
        const check = await pool.query(
            'SELECT host_id FROM voice_spaces WHERE id = $1',
            [spaceId]
        );

        if (check.rows.length === 0) {
            throw new AppError('Space not found', 404);
        }

        if (check.rows[0].host_id !== hostId) {
            throw new AppError('Only the host can start the space', 403);
        }

        const query = `
            UPDATE voice_spaces 
            SET is_live = true, status = 'live', started_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [spaceId]);
        return result.rows[0];
    }

    // End a live space
    static async endSpace(spaceId, hostId) {
        const check = await pool.query(
            'SELECT host_id FROM voice_spaces WHERE id = $1',
            [spaceId]
        );

        if (check.rows.length === 0) {
            throw new AppError('Space not found', 404);
        }

        if (check.rows[0].host_id !== hostId) {
            throw new AppError('Only the host can end the space', 403);
        }

        const query = `
            UPDATE voice_spaces 
            SET is_live = false, status = 'ended', ended_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [spaceId]);
        return result.rows[0];
    }

    // Join a space
    static async joinSpace(spaceId, userId, role = 'listener') {
        const spaceCheck = await pool.query(
            'SELECT id, is_live, status, max_participants FROM voice_spaces WHERE id = $1',
            [spaceId]
        );

        if (spaceCheck.rows.length === 0) {
            throw new AppError('Space not found', 404);
        }

        const space = spaceCheck.rows[0];

        if (space.status !== 'live' && space.status !== 'scheduled') {
            throw new AppError('Space is not available', 400);
        }

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM voice_space_participants WHERE space_id = $1 AND left_at IS NULL',
            [spaceId]
        );

        if (parseInt(countResult.rows[0].count) >= space.max_participants) {
            throw new AppError('Space is full', 400);
        }

        const existing = await pool.query(
            'SELECT id, role FROM voice_space_participants WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL',
            [spaceId, userId]
        );

        if (existing.rows.length > 0) {
            return { alreadyJoined: true, role: existing.rows[0].role };
        }

        const query = `
            INSERT INTO voice_space_participants (space_id, user_id, role, is_muted)
            VALUES ($1, $2, $3, true)
            RETURNING *
        `;

        const result = await pool.query(query, [spaceId, userId, role]);

        await pool.query(
            `UPDATE voice_spaces 
             SET listener_count = (
                 SELECT COUNT(*) FROM voice_space_participants WHERE space_id = $1 AND left_at IS NULL
             )
             WHERE id = $1`,
            [spaceId]
        );

        return result.rows[0];
    }

    // Leave a space
    static async leaveSpace(spaceId, userId) {
        const query = `
            UPDATE voice_space_participants 
            SET left_at = CURRENT_TIMESTAMP
            WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL
            RETURNING *
        `;

        const result = await pool.query(query, [spaceId, userId]);

        await pool.query(
            `UPDATE voice_spaces 
             SET listener_count = (
                 SELECT COUNT(*) FROM voice_space_participants WHERE space_id = $1 AND left_at IS NULL
             )
             WHERE id = $1`,
            [spaceId]
        );

        return result.rows[0];
    }

    // Get live spaces
    static async getLiveSpaces(limit = 20, offset = 0) {
        const query = `
            SELECT 
                vs.id, vs.title, vs.topic, vs.is_live, vs.is_private,
                vs.listener_count, vs.status,
                u.id as host_id, u.username as host_username, u.full_name as host_name, 
                u.avatar_url as host_avatar, u.is_verified as host_verified,
                COALESCE(
                    (SELECT json_agg(jsonb_build_object(
                        'id', p.id,
                        'username', p.username,
                        'avatar_url', p.avatar_url,
                        'role', vsp.role
                    ))
                    FROM voice_space_participants vsp
                    JOIN users p ON vsp.user_id = p.id
                    WHERE vsp.space_id = vs.id AND vsp.left_at IS NULL AND vsp.role IN ('host', 'speaker')
                    LIMIT 5), '[]'::json
                ) as participants
            FROM voice_spaces vs
            JOIN users u ON vs.host_id = u.id
            WHERE vs.is_live = true AND vs.status = 'live'
            ORDER BY vs.started_at DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }

    // Get space details - FIXED VERSION
    static async getSpaceDetails(spaceId, userId = null) {
        const query = `
            SELECT 
                vs.id, vs.title, vs.topic, vs.description, vs.is_live, vs.is_private,
                vs.status, vs.listener_count, vs.started_at, vs.scheduled_for,
                u.id as host_id, u.username as host_username, u.full_name as host_name, 
                u.avatar_url as host_avatar, u.is_verified as host_verified,
                COALESCE(
                    (SELECT json_agg(jsonb_build_object(
                        'id', p.id,
                        'username', p.username,
                        'full_name', p.full_name,
                        'avatar_url', p.avatar_url,
                        'role', vsp.role,
                        'is_muted', vsp.is_muted,
                        'has_hand_raised', vsp.has_hand_raised
                    ))
                    FROM voice_space_participants vsp
                    JOIN users p ON vsp.user_id = p.id
                    WHERE vsp.space_id = vs.id AND vsp.left_at IS NULL
                ), '[]'::json
                ) as participants
            FROM voice_spaces vs
            JOIN users u ON vs.host_id = u.id
            WHERE vs.id = $1
        `;

        const result = await pool.query(query, [spaceId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const space = result.rows[0];
        
        // Add user-specific info
        if (userId) {
            const participant = await pool.query(
                `SELECT role, is_muted, has_hand_raised 
                 FROM voice_space_participants 
                 WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
                [spaceId, userId]
            );
            
            space.is_participant = participant.rows.length > 0;
            space.participant_role = participant.rows[0]?.role || null;
        } else {
            space.is_participant = false;
            space.participant_role = null;
        }
        
        return space;
    }

    // Raise hand
    static async raiseHand(spaceId, userId) {
        await pool.query(
            `UPDATE voice_space_participants 
             SET has_hand_raised = true 
             WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
            [spaceId, userId]
        );

        return { success: true };
    }

    // Lower hand
    static async lowerHand(spaceId, userId) {
        await pool.query(
            `UPDATE voice_space_participants 
             SET has_hand_raised = false 
             WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
            [spaceId, userId]
        );

        return { success: true };
    }

    // Approve speaker (host only)
    static async approveSpeaker(spaceId, userId, hostId) {
        const space = await pool.query(
            'SELECT host_id FROM voice_spaces WHERE id = $1',
            [spaceId]
        );

        if (space.rows[0]?.host_id !== hostId) {
            throw new AppError('Only host can approve speakers', 403);
        }

        const result = await pool.query(
            `UPDATE voice_space_participants 
             SET role = 'speaker', has_hand_raised = false, is_muted = false
             WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL
             RETURNING *`,
            [spaceId, userId]
        );

        return result.rows[0];
    }

    // Send chat message
    static async sendMessage(spaceId, userId, message) {
        const query = `
            INSERT INTO voice_space_messages (space_id, user_id, message)
            VALUES ($1, $2, $3)
            RETURNING *
        `;

        const result = await pool.query(query, [spaceId, userId, message]);
        
        // Get user details for the message
        const userResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [userId]
        );
        
        return {
            ...result.rows[0],
            username: userResult.rows[0]?.username,
            full_name: userResult.rows[0]?.full_name,
            avatar_url: userResult.rows[0]?.avatar_url
        };
    }

    // Get chat messages
    static async getMessages(spaceId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                m.*,
                u.username,
                u.full_name,
                u.avatar_url
            FROM voice_space_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.space_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [spaceId, limit, offset]);
        return result.rows;
    }
}

module.exports = RuganoModel;