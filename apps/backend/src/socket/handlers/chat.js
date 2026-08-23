// src/socket/handlers/chat.js
const ChatModel = require('../../modules/chat/chat.model');
const NotificationModel = require('../../modules/notification/notification.model');
const logger = require('../../utils/logger');
const pool = require('../../config/db');

const setupChatHandlers = (io, socket) => {
    const userId = socket.user.id;

    // Join conversation room
    socket.on('chat:join', async (conversationId) => {
        try {
            if (!conversationId) {
                logger.warn('chat:join called without conversationId');
                return;
            }
            socket.join(`conversation:${conversationId}`);
            logger.debug(`User ${userId} joined conversation ${conversationId}`);
        } catch (error) {
            logger.error('Failed to join conversation:', error);
            socket.emit('error', { message: 'Failed to join conversation' });
        }
    });

    // Leave conversation room
    socket.on('chat:leave', (conversationId) => {
        if (!conversationId) {
            logger.warn('chat:leave called without conversationId');
            return;
        }
        socket.leave(`conversation:${conversationId}`);
        logger.debug(`User ${userId} left conversation ${conversationId}`);
    });

    // Helper function to send real-time notification
    const sendRealTimeNotification = async (recipientId, notification, message) => {
        try {
            // Check if recipient is online
            const isOnline = await checkUserOnline(recipientId);
            
            if (isOnline) {
                // Find recipient's socket ID
                const recipientSockets = await getOnlineUserSockets(recipientId, io);
                
                if (recipientSockets && recipientSockets.length > 0) {
                    // Emit notification to all user's connected devices
                    recipientSockets.forEach(socketId => {
                        io.to(socketId).emit('notification:new', {
                            notification,
                            message_preview: message.content?.substring(0, 100) || '',
                            conversation_id: message.conversation_id
                        });
                    });
                    
                    logger.debug(`Real-time notification sent to user ${recipientId}`);
                }
            }
        } catch (error) {
            logger.error('Error sending real-time notification:', error);
        }
    };

    // Helper function to emit typing notification - FIXED
    const emitTypingNotification = (conversationId, userId, isTyping, username) => {
        try {
            if (!conversationId) {
                logger.warn('emitTypingNotification called without conversationId');
                return;
            }
            
            socket.to(`conversation:${conversationId}`).emit('chat:typing', {
                conversation_id: conversationId,
                user_id: userId,
                is_typing: isTyping,
                username: username || 'User'
            });
        } catch (error) {
            logger.error('Error emitting typing notification:', error);
        }
    };

    // Send message
    socket.on('chat:send', async (data) => {
        try {
            const { conversationId, ...messageData } = data;

            if (!conversationId) {
                socket.emit('error', { message: 'Conversation ID is required' });
                return;
            }

            // Save message to database
            const message = await ChatModel.sendMessage(conversationId, userId, messageData);

            // Get all participants to deliver message
            const conversation = await ChatModel.getConversation(conversationId, userId);
            
            // Get sender details for notification
            const senderResult = await pool.query(
                'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
                [userId]
            );
            const sender = senderResult.rows[0];
            const senderName = sender.full_name || sender.username;

            // Emit message to conversation room
            io.to(`conversation:${conversationId}`).emit('chat:message', {
                conversation_id: conversationId,
                message
            });

            // Create and send notifications to all participants except sender
            if (conversation && conversation.participants) {
                for (const participant of conversation.participants) {
                    if (participant.user_id !== userId) {
                        // Check if participant has muted the conversation
                        const isMuted = participant.is_muted || false;
                        
                        if (!isMuted) {
                            try {
                                // Create notification in database
                                const notificationType = conversation.type === 'group' ? 'new_group_message' : 'new_message';
                                const notificationContent = conversation.type === 'group'
                                    ? `${senderName} sent a message in ${conversation.name || 'Group'}`
                                    : `${senderName} sent you a message`;
                                
                                const notification = await NotificationModel.create({
                                    userId: participant.user_id,
                                    type: notificationType,
                                    actorId: userId,
                                    actorName: senderName,
                                    actorAvatarUrl: sender.avatar_url,
                                    content: notificationContent,
                                    referenceId: conversationId,
                                    referenceType: 'conversation',
                                    metadata: JSON.stringify({
                                        message_id: message.id,
                                        message_preview: (message.content || '').substring(0, 100),
                                        conversation_id: conversationId,
                                        conversation_type: conversation.type,
                                        conversation_name: conversation.name || null
                                    })
                                });
                                
                                // Send real-time notification if user is online
                                await sendRealTimeNotification(participant.user_id, notification, message);
                                
                            } catch (notifError) {
                                logger.error('Failed to create notification for participant:', notifError);
                            }
                        }
                    }
                }
            }

            // Update last message timestamp in conversation
            await pool.query(
                'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
                [conversationId]
            );

        } catch (error) {
            logger.error('Chat send error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Mark messages as read
    socket.on('chat:read', async (data) => {
        try {
            const { conversationId, messageId } = data;

            if (!conversationId) {
                logger.warn('chat:read called without conversationId');
                return;
            }

            const result = await ChatModel.markAsRead(conversationId, userId, messageId);

            // Notify others in conversation
            socket.to(`conversation:${conversationId}`).emit('chat:read', {
                conversation_id: conversationId,
                user_id: userId,
                last_read_at: new Date().toISOString(),
                unread_count: result?.unread_count || 0
            });

            // Clear unread notification badge for this conversation
            socket.emit('notification:badge_update', {
                type: 'chat',
                conversation_id: conversationId,
                unread_count: 0
            });

        } catch (error) {
            logger.error('Chat read error:', error);
        }
    });

    // Typing indicator - FIXED
    socket.on('chat:typing', async (data) => {
        try {
            const { conversationId, isTyping } = data;
            
            // Validate required fields
            if (!conversationId) {
                logger.warn('chat:typing event missing conversationId');
                return;
            }
            
            // Ensure isTyping is boolean
            const typingStatus = typeof isTyping === 'boolean' ? isTyping : false;
            
            // Store typing status if the method exists
            if (ChatModel.setTyping && typeof ChatModel.setTyping === 'function') {
                try {
                    await ChatModel.setTyping(conversationId, userId, typingStatus);
                } catch (modelError) {
                    // Non-critical error, just log it
                    logger.debug('SetTyping method not available or failed:', modelError.message);
                }
            }

            // Notify others in conversation
            emitTypingNotification(conversationId, userId, typingStatus, socket.user?.username);
            
            logger.debug(`User ${userId} typing: ${typingStatus} in conversation ${conversationId}`);

        } catch (error) {
            // Don't throw - just log the error
            logger.error('Chat typing error:', error.message);
        }
    });

    // Add reaction
    socket.on('chat:react', async (data) => {
        try {
            const { messageId, reaction } = data;

            if (!messageId || !reaction) {
                logger.warn('chat:react missing required fields');
                return;
            }

            const result = await ChatModel.addReaction(messageId, userId, reaction);

            // Get message to find conversation and message author
            const message = await ChatModel.getMessage(messageId, userId);
            
            if (message && message.conversation_id) {
                // Broadcast to conversation
                io.to(`conversation:${message.conversation_id}`).emit('chat:reaction', {
                    message_id: messageId,
                    user_id: userId,
                    reaction: result.reaction,
                    action: result.action
                });

                // Notify message author about reaction (if not self)
                if (message.user_id !== userId) {
                    const reactionAuthor = await pool.query(
                        'SELECT username, full_name FROM users WHERE id = $1',
                        [userId]
                    );
                    const authorName = reactionAuthor.rows[0]?.full_name || reactionAuthor.rows[0]?.username || 'Someone';
                    
                    const notification = await NotificationModel.create({
                        userId: message.user_id,
                        type: 'message_reaction',
                        actorId: userId,
                        actorName: authorName,
                        actorAvatarUrl: socket.user?.avatar_url,
                        content: `${authorName} reacted ${result.reaction} to your message`,
                        referenceId: messageId,
                        referenceType: 'message',
                        metadata: JSON.stringify({
                            message_id: messageId,
                            reaction: result.reaction,
                            conversation_id: message.conversation_id
                        })
                    });
                    
                    // Send real-time notification to message author
                    await sendRealTimeNotification(message.user_id, notification, message);
                }
            }

        } catch (error) {
            logger.error('Chat reaction error:', error);
        }
    });

    // Delete message
    socket.on('chat:delete', async (data) => {
        try {
            const { messageId, forEveryone } = data;

            if (!messageId) {
                logger.warn('chat:delete missing messageId');
                return;
            }

            const result = await ChatModel.deleteMessage(messageId, userId, forEveryone || false);

            // Get message to find conversation
            const message = await ChatModel.getMessage(messageId, userId);
            
            if (message && message.conversation_id) {
                // Broadcast deletion
                io.to(`conversation:${message.conversation_id}`).emit('chat:deleted', {
                    message_id: messageId,
                    user_id: userId,
                    for_everyone: forEveryone || false,
                    deleted_at: new Date().toISOString()
                });

                // If deleting for everyone, also delete related notifications
                if (forEveryone) {
                    await pool.query(
                        'DELETE FROM notifications WHERE reference_id = $1 AND reference_type = $2',
                        [messageId, 'message']
                    );
                }
            }

        } catch (error) {
            logger.error('Chat delete error:', error);
        }
    });

    // Get unread message count (real-time)
    socket.on('chat:get_unread_count', async () => {
        try {
            const result = await pool.query(
                `SELECT COUNT(*) as unread_count
                 FROM messages m
                 JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
                 WHERE cp.user_id = $1 
                   AND m.user_id != $1 
                   AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
                   AND m.is_deleted = false`,
                [userId]
            );
            
            socket.emit('chat:unread_count', {
                unread_count: parseInt(result.rows[0].unread_count) || 0
            });
        } catch (error) {
            logger.error('Get unread count error:', error);
        }
    });

    // Mark conversation as read (for all messages)
    socket.on('chat:mark_conversation_read', async (data) => {
        try {
            const { conversationId } = data;
            
            if (!conversationId) {
                logger.warn('chat:mark_conversation_read missing conversationId');
                return;
            }
            
            await pool.query(
                `UPDATE conversation_participants 
                 SET last_read_at = CURRENT_TIMESTAMP
                 WHERE conversation_id = $1 AND user_id = $2`,
                [conversationId, userId]
            );
            
            // Notify others
            socket.to(`conversation:${conversationId}`).emit('chat:conversation_read', {
                conversation_id: conversationId,
                user_id: userId,
                read_at: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('Mark conversation read error:', error);
        }
    });
};

// Helper to check if user is online
const checkUserOnline = async (userId) => {
    try {
        const result = await pool.query(
            'SELECT status FROM user_presence WHERE user_id = $1',
            [userId]
        );
        return result.rows[0]?.status === 'online';
    } catch (error) {
        logger.error('Error checking user online status:', error);
        return false;
    }
};

// Helper to get all online sockets for a user
const getOnlineUserSockets = async (userId, io) => {
    try {
        const sockets = await io.fetchSockets();
        const userSockets = sockets.filter(socket => socket.user?.id === userId);
        return userSockets.map(socket => socket.id);
    } catch (error) {
        logger.error('Error getting online user sockets:', error);
        return [];
    }
};

// Helper to queue offline notifications (for later delivery)
const queueOfflineNotification = async (userId, notification, message) => {
    try {
        // First check if the table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'offline_notifications'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            logger.debug('offline_notifications table does not exist yet, skipping queue');
            return;
        }
        
        // Store in offline_notifications table for when user comes back online
        await pool.query(
            `INSERT INTO offline_notifications (user_id, notification_id, message_preview, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, notification_id) DO NOTHING`,
            [userId, notification.id, (message.content || '').substring(0, 100)]
        );
        
        logger.debug(`Queued offline notification for user ${userId}`);
    } catch (error) {
        logger.error('Error queueing offline notification:', error.message);
        // Don't throw - just log the error
    }
};

// Export function to deliver queued notifications when user comes online
const deliverQueuedNotifications = async (io, socket, userId) => {
    try {
        // First check if the table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'offline_notifications'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            logger.debug('offline_notifications table does not exist yet, skipping delivery');
            return;
        }
        
        const queuedNotifications = await pool.query(
            `SELECT on.*, n.* 
             FROM offline_notifications on
             JOIN notifications n ON on.notification_id = n.id
             WHERE on.user_id = $1 AND on.delivered_at IS NULL
             ORDER BY on.created_at ASC
             LIMIT 50`,
            [userId]
        );
        
        if (queuedNotifications.rows.length > 0) {
            logger.debug(`Found ${queuedNotifications.rows.length} queued notifications for user ${userId}`);
            
            // Deliver notifications one by one
            for (const notification of queuedNotifications.rows) {
                socket.emit('notification:new', {
                    notification,
                    is_offline_delivery: true
                });
            }
            
            // Mark as delivered instead of deleting
            await pool.query(
                `UPDATE offline_notifications 
                 SET delivered_at = CURRENT_TIMESTAMP 
                 WHERE user_id = $1 AND delivered_at IS NULL`,
                [userId]
            );
            
            logger.debug(`Delivered ${queuedNotifications.rows.length} queued notifications to user ${userId}`);
        }
    } catch (error) {
        logger.error('Error delivering queued notifications:', error.message);
        // Don't throw - just log the error
    }
};

module.exports = {
    setupChatHandlers,
    deliverQueuedNotifications
};