// src/modules/call/call.validation.js
const { body, param, query } = require('express-validator');

const validateCallId = [
    param('callId')
        .isUUID(4)
        .withMessage('Invalid call ID format')
];

const validateRateCall = [
    body('quality_score')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Quality score must be between 1 and 5'),
    body('avg_bitrate')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Average bitrate must be a positive integer'),
    body('packet_loss')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Packet loss must be between 0 and 100'),
    body('latency')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Latency must be a positive integer')
];

module.exports = {
    validateCallId,
    validateRateCall
};