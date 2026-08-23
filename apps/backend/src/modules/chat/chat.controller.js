// src/modules/chat/chat.controller.js
const ChatModel = require('./chat.model');
const PresenceModel = require('../presence/presence.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');
const NotificationModel = require('../notification/notification.model');
const logger = require('../../utils/logger');

// Create a new conversation
const createConversation = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { participants, type, name } = req.body;

    if (!participants || participants.length === 0) {
        throw new AppError('At least one participant is required', 400);
    }

    const conversation = await ChatModel.createConversation(userId, participants, type || 'direct', name);

    ResponseHandler.created(res, { conversation }, 'Conversation created successfully');
});

// Get user's conversations
const getConversations = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const conversations = await ChatModel.getUserConversations(userId, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, conversations, page, limit, null);
});

// Get single conversation
const getConversation = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await ChatModel.getConversation(conversationId, userId);

    ResponseHandler.success(res, { conversation });
});

// Get messages in conversation
const getMessages = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { limit = 50, before } = req.query;

    const messages = await ChatModel.getMessages(conversationId, userId, parseInt(limit), before);

    ResponseHandler.success(res, { 
        messages,
        has_more: messages.length === parseInt(limit)
    });
});

// Helper function to send message notifications
// src/modules/chat/chat.controller.js

// Update the sendMessageNotifications function - remove the push notification part
const sendMessageNotifications = async (conversationId, message, senderId, conversationType, participants) => {
    try {
        // Don't send notifications for non-text messages or system messages
        if (message.type !== 'text') return;

        // Get conversation details
        const convResult = await pool.query(
            `SELECT c.type, c.name 
             FROM conversations c 
             WHERE c.id = $1::UUID`,
            [conversationId]
        );

        if (convResult.rows.length === 0) return;
        const conversation = convResult.rows[0];

        // Get sender details
        const senderResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1::UUID',
            [senderId]
        );

        if (senderResult.rows.length === 0) return;
        const sender = senderResult.rows[0];
        const senderName = sender.full_name || sender.username;

        // Get all participants except sender
        let recipientIds = participants;
        if (!recipientIds) {
            const participantsResult = await pool.query(
                `SELECT cp.user_id 
                 FROM conversation_participants cp
                 WHERE cp.conversation_id = $1::UUID 
                   AND cp.user_id != $2::UUID
                   AND cp.left_at IS NULL`,
                [conversationId, senderId]
            );
            recipientIds = participantsResult.rows.map(row => row.user_id);
        }

        if (!recipientIds || recipientIds.length === 0) return;

        // Check which recipients have muted the conversation
        const mutedResult = await pool.query(
            `SELECT user_id 
             FROM conversation_participants 
             WHERE conversation_id = $1::UUID 
               AND is_muted = true
               AND user_id = ANY($2::UUID[])`,
            [conversationId, recipientIds]
        );
        const mutedUserIds = new Set(mutedResult.rows.map(row => row.user_id));

        // Create notification content based on conversation type
        let notificationContent = `${senderName} sent you a message`;
        let notificationType = 'new_message';
        
        if (conversation.type === 'group') {
            const groupName = conversation.name || 'Group';
            notificationContent = `${senderName} sent a message in ${groupName}`;
            notificationType = 'new_group_message';
        }

        // Truncate message preview
        const messagePreview = message.content && message.content.length > 50 
            ? message.content.substring(0, 50) + '...' 
            : message.content || '';

        // Create notifications for each recipient (except muted users)
        const notificationPromises = recipientIds
            .filter(recipientId => !mutedUserIds.has(recipientId))
            .map(async (recipientId) => {
                try {
                    return await NotificationModel.create({
                        userId: recipientId,
                        type: notificationType,
                        actorId: senderId,
                        actorName: senderName,
                        actorAvatarUrl: sender.avatar_url,
                        content: notificationContent,
                        referenceId: conversationId,
                        referenceType: 'conversation',
                        metadata: JSON.stringify({
                            message_id: message.id,
                            message_preview: messagePreview,
                            conversation_id: conversationId,
                            conversation_type: conversation.type,
                            conversation_name: conversation.name || null
                        })
                    });
                } catch (error) {
                    logger.error('Failed to create notification for user:', recipientId, error);
                    return null;
                }
            });

        // REMOVE the push notification section that's causing the error
        // The code that queries for push_notification_token should be removed
        
        const results = await Promise.all(notificationPromises);
        const successfulNotifications = results.filter(r => r !== null);
        
        logger.debug(`Created ${successfulNotifications.length} notifications for message ${message.id}`);

    } catch (error) {
        logger.error('Error sending message notifications:', error);
        // Don't throw - notification failure shouldn't break message sending
    }
};

// Send a message (HTTP fallback for when socket is unavailable)
const sendMessage = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { content, type = 'text', replyToId, forwardedFromId } = req.body;

    if (!content && type === 'text') {
        throw new AppError('Message content is required', 400);
    }

    const messageData = {
        content,
        type,
        replyToId,
        forwardedFromId
    };

    const message = await ChatModel.sendMessage(conversationId, userId, messageData);
    
    // Send notifications for new message (don't await - do in background)
    sendMessageNotifications(conversationId, message, userId, null, null).catch(console.error);

    ResponseHandler.created(res, { message }, 'Message sent successfully');
});

// Mark messages as read - FIXED: handle missing messageId
const markAsRead = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { messageId } = req.body || {};

    const result = await ChatModel.markAsRead(conversationId, userId, messageId || null);

    ResponseHandler.success(res, result);
});

// Delete message
const deleteMessage = catchAsync(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { forEveryone = false } = req.body;

    const result = await ChatModel.deleteMessage(messageId, userId, forEveryone);

    ResponseHandler.success(res, result, 'Message deleted successfully');
});

// Add reaction
const addReaction = catchAsync(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { reaction } = req.body;

    if (!reaction) {
        throw new AppError('Reaction is required', 400);
    }

    const result = await ChatModel.addReaction(messageId, userId, reaction);

    ResponseHandler.success(res, result);
});

// Pin conversation
const pinConversation = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await ChatModel.togglePin(conversationId, userId, true);

    ResponseHandler.success(res, result, 'Conversation pinned');
});

// Unpin conversation
const unpinConversation = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await ChatModel.togglePin(conversationId, userId, false);

    ResponseHandler.success(res, result, 'Conversation unpinned');
});

// Mute conversation
const muteConversation = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await ChatModel.toggleMute(conversationId, userId, true);

    ResponseHandler.success(res, result, 'Conversation muted');
});

// Unmute conversation
const unmuteConversation = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await ChatModel.toggleMute(conversationId, userId, false);

    ResponseHandler.success(res, result, 'Conversation unmuted');
});

// Leave conversation
const leaveConversation = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await ChatModel.leaveConversation(conversationId, userId);

    ResponseHandler.success(res, result, 'Left conversation');
});

// Add participants to group
const addParticipants = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { participants } = req.body;

    if (!participants || participants.length === 0) {
        throw new AppError('At least one participant is required', 400);
    }

    const result = await ChatModel.addParticipants(conversationId, userId, participants);
    
    // Send notifications to new participants
    if (result && participants.length > 0) {
        // Get conversation details
        const convResult = await pool.query(
            `SELECT c.name, c.type 
             FROM conversations c 
             WHERE c.id = $1::UUID`,
            [conversationId]
        );
        
        if (convResult.rows.length > 0) {
            const conversation = convResult.rows[0];
            const groupName = conversation.name || 'Group';
            
            // Get adder details
            const adderResult = await pool.query(
                'SELECT username, full_name FROM users WHERE id = $1::UUID',
                [userId]
            );
            
            if (adderResult.rows.length > 0) {
                const adder = adderResult.rows[0];
                const adderName = adder.full_name || adder.username;
                
                // Notify each new participant
                const notificationPromises = participants.map(participantId =>
                    NotificationModel.create({
                        userId: participantId,
                        type: 'added_to_group',
                        actorId: userId,
                        actorName: adderName,
                        actorAvatarUrl: null,
                        content: `${adderName} added you to ${groupName}`,
                        referenceId: conversationId,
                        referenceType: 'conversation',
                        metadata: JSON.stringify({
                            conversation_id: conversationId,
                            conversation_name: groupName
                        })
                    })
                );
                
                await Promise.all(notificationPromises).catch(console.error);
            }
        }
    }

    ResponseHandler.success(res, result, 'Participants added');
});

// Search messages
const searchMessages = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { q, limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    if (!q) {
        throw new AppError('Search query is required', 400);
    }

    const messages = await ChatModel.searchMessages(userId, q, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, messages, page, limit, null);
});

// Get unread message count
const getUnreadCount = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const result = await pool.query(
        `SELECT COUNT(*) as unread_count
         FROM messages m
         JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
         WHERE cp.user_id = $1::UUID 
           AND m.user_id != $1::UUID 
           AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
           AND m.is_deleted = false`,
        [userId]
    );

    ResponseHandler.success(res, { unread_count: parseInt(result.rows[0].unread_count) });
});

// Get or create direct conversation
const getOrCreateDirectConversation = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    // Check if conversation exists
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
        [userId, otherUserId]
    );

    if (existing.rows.length > 0) {
        const conversation = await ChatModel.getConversation(existing.rows[0].id, userId);
        return ResponseHandler.success(res, { conversation });
    }

    // Create new conversation
    const conversation = await ChatModel.createConversation(userId, [otherUserId], 'direct', null);
    ResponseHandler.created(res, { conversation }, 'Conversation created successfully');
});

// Search users for chat - NEW ENDPOINT
const searchUsers = catchAsync(async (req, res) => {
    const { q } = req.query;
    const currentUserId = req.user.id;

    if (!q || q.trim().length === 0) {
        return ResponseHandler.success(res, { users: [] });
    }

    const searchTerm = `%${q.toLowerCase()}%`;

    const query = `
        SELECT 
            u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as followers_count
        FROM users u
        WHERE u.is_active = true
            AND u.id != $1::UUID
            AND (LOWER(u.username) LIKE $2 OR LOWER(u.full_name) LIKE $2)
        ORDER BY u.username ASC
        LIMIT 20
    `;

    const result = await pool.query(query, [currentUserId, searchTerm]);

    // Check follow status
    for (const user of result.rows) {
        const followCheck = await pool.query(
            `SELECT EXISTS(
                SELECT 1 FROM follows 
                WHERE follower_id = $1::UUID AND following_id = $2::UUID AND status = 'accepted'
            ) as is_following`,
            [currentUserId, user.id]
        );
        user.is_following = followCheck.rows[0].is_following;
    }

    ResponseHandler.success(res, { users: result.rows });
});

module.exports = {
    createConversation,
    getConversations,
    getConversation,
    getMessages,
    sendMessage,
    markAsRead,
    deleteMessage,
    addReaction,
    pinConversation,
    unpinConversation,
    muteConversation,
    unmuteConversation,
    leaveConversation,
    addParticipants,
    searchMessages,
    getUnreadCount,
    getOrCreateDirectConversation,
    searchUsers
};