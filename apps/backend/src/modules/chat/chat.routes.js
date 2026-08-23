// src/modules/chat/chat.routes.js
const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validateConversationId,
    validateMessageId,
    validateCreateConversation,
    validateSendMessage,
    validateAddReaction,
    validateAddParticipants
} = require('./chat.validation');

// All chat routes are protected
router.use(protect);

// User search for chat - NEW ENDPOINT
router.get('/users/search', chatController.searchUsers);

// New endpoint to get or create direct conversation
router.get('/direct/:otherUserId', chatController.getOrCreateDirectConversation);

// Unread count
router.get('/unread/count', chatController.getUnreadCount);

// Conversations
router.post('/conversations', validateCreateConversation, validate, chatController.createConversation);
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:conversationId', validateConversationId, validate, chatController.getConversation);
router.get('/conversations/:conversationId/messages', validateConversationId, validate, chatController.getMessages);
router.post('/conversations/:conversationId/messages', validateConversationId, validateSendMessage, validate, chatController.sendMessage);
router.post('/conversations/:conversationId/read', validateConversationId, validate, chatController.markAsRead);
router.post('/conversations/:conversationId/pin', validateConversationId, validate, chatController.pinConversation);
router.delete('/conversations/:conversationId/pin', validateConversationId, validate, chatController.unpinConversation);
router.post('/conversations/:conversationId/mute', validateConversationId, validate, chatController.muteConversation);
router.delete('/conversations/:conversationId/mute', validateConversationId, validate, chatController.unmuteConversation);
router.delete('/conversations/:conversationId/leave', validateConversationId, validate, chatController.leaveConversation);
router.post('/conversations/:conversationId/participants', validateConversationId, validateAddParticipants, validate, chatController.addParticipants);

// Messages
router.delete('/messages/:messageId', validateMessageId, validate, chatController.deleteMessage);
router.post('/messages/:messageId/reactions', validateMessageId, validateAddReaction, validate, chatController.addReaction);

// Search
router.get('/search', chatController.searchMessages);

module.exports = router;