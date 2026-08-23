// src/modules/chat/chat.validation.js
const { body, param, query } = require('express-validator');

const validateConversationId = [
    param('conversationId')
        .isUUID(4)
        .withMessage('Invalid conversation ID format')
];

const validateMessageId = [
    param('messageId')
        .isUUID(4)
        .withMessage('Invalid message ID format')
];

const validateCreateConversation = [
    body('participants')
        .isArray()
        .withMessage('Participants must be an array')
        .notEmpty()
        .withMessage('At least one participant is required'),
    body('participants.*')
        .isUUID(4)
        .withMessage('Invalid participant ID format'),
    body('type')
        .optional()
        .isIn(['direct', 'group'])
        .withMessage('Type must be either direct or group'),
    body('name')
        .optional()
        .isString()
        .withMessage('Name must be a string')
        .isLength({ max: 255 })
        .withMessage('Name cannot exceed 255 characters')
];

const validateSendMessage = [
    body('type')
        .optional()
        .isIn(['text', 'image', 'video', 'audio', 'file'])
        .withMessage('Invalid message type'),
    body('content')
        .optional()
        .isString()
        .withMessage('Content must be a string')
        .isLength({ max: 5000 })
        .withMessage('Content cannot exceed 5000 characters'),
    body('replyToId')
        .optional()
        .isUUID(4)
        .withMessage('Invalid reply message ID'),
    body('forwardedFromId')
        .optional()
        .isUUID(4)
        .withMessage('Invalid forwarded message ID')
];

const validateAddReaction = [
    body('reaction')
        .notEmpty()
        .withMessage('Reaction is required')
        .isString()
        .withMessage('Reaction must be a string')
        .isLength({ max: 50 })
        .withMessage('Reaction cannot exceed 50 characters')
];

const validateAddParticipants = [
    body('participants')
        .isArray()
        .withMessage('Participants must be an array')
        .notEmpty()
        .withMessage('At least one participant is required'),
    body('participants.*')
        .isUUID(4)
        .withMessage('Invalid participant ID format')
];

module.exports = {
    validateConversationId,
    validateMessageId,
    validateCreateConversation,
    validateSendMessage,
    validateAddReaction,
    validateAddParticipants
};