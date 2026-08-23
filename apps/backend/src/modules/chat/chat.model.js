// src/modules/chat/chat.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class ChatModel {
    // Create a new conversation (direct or group)
    static async createConversation(userId, participants, type = 'direct', name = null) {
        try {
            // For direct chats, check if conversation already exists
            if (type === 'direct' && participants.length === 1) {
                const existing = await pool.query(
                    `SELECT c.id 
                     FROM conversations c
                     JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
                     JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
                     WHERE c.type = 'direct'
                        AND cp1.user_id = $1::UUID
                        AND cp2.user_id = $2::UUID
                        AND cp1.left_at IS NULL
                        AND cp2.left_at IS NULL`,
                    [userId, participants[0]]
                );
                
                if (existing.rows.length > 0) {
                    return this.getConversation(existing.rows[0].id, userId);
                }
            }
            
            await pool.query('BEGIN');
            
            // Create conversation
            const convResult = await pool.query(
                `INSERT INTO conversations (type, name, created_by)
                 VALUES ($1, $2, $3::UUID)
                 RETURNING *`,
                [type, name, userId]
            );
            
            const conversation = convResult.rows[0];
            
            // Add all participants (including creator)
            const allParticipants = [userId, ...participants];
            
            for (const participantId of allParticipants) {
                await pool.query(
                    `INSERT INTO conversation_participants (conversation_id, user_id, role)
                     VALUES ($1::UUID, $2::UUID, $3)`,
                    [conversation.id, participantId, participantId === userId ? 'admin' : 'member']
                );
            }
            
            await pool.query('COMMIT');
            
            return this.getConversation(conversation.id, userId);
            
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    }

    // Get conversation by ID
    static async getConversation(conversationId, userId) {
        const query = `
            SELECT 
                c.*,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'user_id', u.id,
                        'username', u.username,
                        'full_name', u.full_name,
                        'avatar_url', u.avatar_url,
                        'is_verified', u.is_verified,
                        'role', cp.role,
                        'last_read_at', cp.last_read_at,
                        'is_muted', cp.is_muted,
                        'is_pinned', cp.is_pinned
                    ))
                    FROM conversation_participants cp
                    JOIN users u ON cp.user_id = u.id
                    WHERE cp.conversation_id = c.id AND cp.left_at IS NULL),
                    '[]'::json
                ) as participants,
                
                (
                    SELECT json_build_object(
                        'role', cp.role,
                        'last_read_at', cp.last_read_at,
                        'is_muted', cp.is_muted,
                        'is_pinned', cp.is_pinned
                    )
                    FROM conversation_participants cp
                    WHERE cp.conversation_id = c.id AND cp.user_id = $2::UUID
                ) as my_info,
                
                (
                    SELECT json_build_object(
                        'id', m.id,
                        'content', m.content,
                        'type', m.type,
                        'user_id', m.user_id,
                        'username', u.username,
                        'created_at', m.created_at,
                        'is_read', m.is_read
                    )
                    FROM messages m
                    JOIN users u ON m.user_id = u.id
                    WHERE m.conversation_id = c.id AND m.is_deleted = false
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) as last_message
                
            FROM conversations c
            WHERE c.id = $1::UUID AND c.is_active = true
        `;
        
        const result = await pool.query(query, [conversationId, userId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Conversation not found', 404);
        }
        
        const conversation = result.rows[0];
        
        // Get unread count separately
        const unreadResult = await pool.query(
            `SELECT COUNT(*) as unread_count 
             FROM messages m 
             WHERE m.conversation_id = $1::UUID 
               AND m.user_id != $2::UUID 
               AND m.created_at > COALESCE(
                   (SELECT last_read_at FROM conversation_participants 
                    WHERE conversation_id = $1::UUID AND user_id = $2::UUID), 
                   '1970-01-01'
               )
               AND m.is_deleted = false`,
            [conversationId, userId]
        );
        conversation.unread_count = parseInt(unreadResult.rows[0].unread_count);
        
        return conversation;
    }

    // Get user's conversations
    static async getUserConversations(userId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                c.*,
                CASE 
                    WHEN c.type = 'direct' THEN
                        (
                            SELECT json_build_object(
                                'id', u.id,
                                'username', u.username,
                                'full_name', u.full_name,
                                'avatar_url', u.avatar_url,
                                'is_verified', u.is_verified
                            )
                            FROM conversation_participants cp
                            JOIN users u ON cp.user_id = u.id
                            WHERE cp.conversation_id = c.id 
                                AND cp.user_id != $1::UUID
                                AND cp.left_at IS NULL
                            LIMIT 1
                        )
                    ELSE NULL
                END as other_user,
                
                (
                    SELECT json_build_object(
                        'id', m.id,
                        'content', m.content,
                        'type', m.type,
                        'user_id', m.user_id,
                        'username', u.username,
                        'created_at', m.created_at,
                        'is_read', m.is_read
                    )
                    FROM messages m
                    JOIN users u ON m.user_id = u.id
                    WHERE m.conversation_id = c.id AND m.is_deleted = false
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) as last_message,
                
                cp.is_pinned,
                cp.is_muted
                
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = $1::UUID AND cp.left_at IS NULL AND c.is_active = true
            ORDER BY 
                cp.is_pinned DESC,
                COALESCE(c.last_message_at, c.created_at) DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Add unread count for each conversation
        for (const conv of result.rows) {
            const unreadResult = await pool.query(
                `SELECT COUNT(*) as unread_count 
                 FROM messages m 
                 WHERE m.conversation_id = $1::UUID 
                   AND m.user_id != $2::UUID 
                   AND m.created_at > COALESCE(
                       (SELECT last_read_at FROM conversation_participants 
                        WHERE conversation_id = $1::UUID AND user_id = $2::UUID), 
                       '1970-01-01'
                   )
                   AND m.is_deleted = false`,
                [conv.id, userId]
            );
            conv.unread_count = parseInt(unreadResult.rows[0].unread_count);
        }
        
        return result.rows;
    }

    // Get messages in a conversation - ADD THIS MISSING METHOD
    static async getMessages(conversationId, userId, limit = 50, before = null) {
        // Check if user is participant
        const participantCheck = await pool.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1::UUID AND user_id = $2::UUID AND left_at IS NULL',
            [conversationId, userId]
        );

        if (participantCheck.rows.length === 0) {
            throw new AppError('You are not a participant in this conversation', 403);
        }

        let query = `
            SELECT 
                m.*,
                u.username, u.full_name, u.avatar_url, u.is_verified
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.conversation_id = $1::UUID 
                AND m.is_deleted = false
            ORDER BY m.created_at ASC
            LIMIT $2
        `;

        const values = [conversationId, limit];

        const result = await pool.query(query, values);
        return result.rows;
    }

    // Send a message
    static async sendMessage(conversationId, userId, messageData) {
        const {
            type = 'text',
            content,
            mediaUrl,
            mediaType,
            mediaPublicId,
            mediaSize,
            mediaDuration,
            thumbnailUrl,
            replyToId,
            forwardedFromId
        } = messageData;

        // Check if user is participant
        const participantCheck = await pool.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1::UUID AND user_id = $2::UUID AND left_at IS NULL',
            [conversationId, userId]
        );

        if (participantCheck.rows.length === 0) {
            throw new AppError('You are not a participant in this conversation', 403);
        }

        try {
            await pool.query('BEGIN');

            // Insert message
            const messageResult = await pool.query(
                `INSERT INTO messages (
                    conversation_id, user_id, type, content,
                    media_url, media_type, media_public_id, media_size, media_duration,
                    thumbnail_url, reply_to_id, forwarded_from_id
                ) VALUES ($1::UUID, $2::UUID, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *`,
                [
                    conversationId, userId, type, content,
                    mediaUrl, mediaType, mediaPublicId, mediaSize, mediaDuration,
                    thumbnailUrl, replyToId, forwardedFromId
                ]
            );

            const message = messageResult.rows[0];

            // Create delivery records for all participants
            await pool.query(
                `INSERT INTO message_delivery (message_id, user_id)
                 SELECT $1::UUID, user_id
                 FROM conversation_participants
                 WHERE conversation_id = $2::UUID AND user_id != $3::UUID AND left_at IS NULL`,
                [message.id, conversationId, userId]
            );

            // Update conversation last_message_at
            await pool.query(
                `UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1::UUID`,
                [conversationId]
            );

            await pool.query('COMMIT');

            // Get full message with user details
            return this.getMessage(message.id, userId);

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    }

    // Get single message
    static async getMessage(messageId, userId) {
        const query = `
            SELECT 
                m.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                (
                    SELECT json_build_object(
                        'status', md.status,
                        'delivered_at', md.delivered_at,
                        'read_at', md.read_at
                    )
                    FROM message_delivery md
                    WHERE md.message_id = m.id AND md.user_id = $2::UUID
                ) as delivery_status
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = $1::UUID AND m.is_deleted = false
        `;

        const result = await pool.query(query, [messageId, userId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Message not found', 404);
        }

        return result.rows[0];
    }

    // Mark messages as read
    static async markAsRead(conversationId, userId, messageId = null) {
        try {
            await pool.query('BEGIN');

            // Update last_read_at for participant
            await pool.query(
                `UPDATE conversation_participants 
                 SET last_read_at = CURRENT_TIMESTAMP,
                     last_read_message_id = COALESCE($1::UUID, last_read_message_id)
                 WHERE conversation_id = $2::UUID AND user_id = $3::UUID`,
                [messageId, conversationId, userId]
            );

            // Mark messages as read in delivery table
            await pool.query(
                `UPDATE message_delivery md
                 SET status = 'read',
                     read_at = CURRENT_TIMESTAMP
                 FROM messages m
                 WHERE md.message_id = m.id
                     AND m.conversation_id = $1::UUID
                     AND md.user_id = $2::UUID
                     AND md.status != 'read'`,
                [conversationId, userId]
            );

            await pool.query('COMMIT');

            // Get unread count
            const result = await pool.query(
                `SELECT COUNT(*) as unread_count 
                 FROM messages m 
                 WHERE m.conversation_id = $1::UUID 
                   AND m.user_id != $2::UUID 
                   AND m.created_at > COALESCE(
                       (SELECT last_read_at FROM conversation_participants 
                        WHERE conversation_id = $1::UUID AND user_id = $2::UUID), 
                       '1970-01-01'
                   )
                   AND m.is_deleted = false`,
                [conversationId, userId]
            );

            return {
                unread_count: parseInt(result.rows[0].unread_count)
            };

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    }

    // Delete message
    static async deleteMessage(messageId, userId, forEveryone = false) {
        const message = await this.getMessage(messageId, userId);

        if (!message) {
            throw new AppError('Message not found', 404);
        }

        if (forEveryone) {
            if (message.user_id !== userId) {
                throw new AppError('You can only delete your own messages for everyone', 403);
            }

            await pool.query(
                `UPDATE messages 
                 SET is_deleted = true,
                     deleted_for_everyone = true,
                     deleted_at = CURRENT_TIMESTAMP,
                     content = NULL,
                     media_url = NULL,
                     media_public_id = NULL
                 WHERE id = $1::UUID`,
                [messageId]
            );

            return { deleted_for_everyone: true };
        }

        return { deleted_for_self: true };
    }

    // Add reaction
    static async addReaction(messageId, userId, reaction) {
        const existing = await pool.query(
            'SELECT 1 FROM message_reactions WHERE message_id = $1::UUID AND user_id = $2::UUID AND reaction = $3',
            [messageId, userId, reaction]
        );

        if (existing.rows.length > 0) {
            await pool.query(
                'DELETE FROM message_reactions WHERE message_id = $1::UUID AND user_id = $2::UUID AND reaction = $3',
                [messageId, userId, reaction]
            );
            return { action: 'removed', reaction };
        }

        await pool.query(
            'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES ($1::UUID, $2::UUID, $3)',
            [messageId, userId, reaction]
        );

        return { action: 'added', reaction };
    }

    // Pin conversation
    static async togglePin(conversationId, userId, isPinned) {
        const result = await pool.query(
            `UPDATE conversation_participants 
             SET is_pinned = $1,
                 pinned_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE conversation_id = $2::UUID AND user_id = $3::UUID
             RETURNING is_pinned`,
            [isPinned, conversationId, userId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Conversation participant not found', 404);
        }

        return { is_pinned: result.rows[0].is_pinned };
    }

    // Mute conversation
    static async toggleMute(conversationId, userId, isMuted) {
        const result = await pool.query(
            `UPDATE conversation_participants 
             SET is_muted = $1
             WHERE conversation_id = $2::UUID AND user_id = $3::UUID
             RETURNING is_muted`,
            [isMuted, conversationId, userId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Conversation participant not found', 404);
        }

        return { is_muted: result.rows[0].is_muted };
    }

    // Leave conversation
    static async leaveConversation(conversationId, userId) {
        const result = await pool.query(
            `UPDATE conversation_participants 
             SET left_at = CURRENT_TIMESTAMP
             WHERE conversation_id = $1::UUID AND user_id = $2::UUID
             RETURNING *`,
            [conversationId, userId]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Conversation participant not found', 404);
        }

        return { left: true };
    }

    // Add this method to your ChatModel class
static async setTyping(conversationId, userId, isTyping) {
    try {
        // Optional: Store typing status in Redis or memory
        // This is just a placeholder - you can implement Redis storage
        // or skip it entirely as it's not critical functionality
        
        // For now, just return true
        return true;
    } catch (error) {
        logger.error('Error setting typing status:', error);
        return false;
    }
}
}

module.exports = ChatModel;