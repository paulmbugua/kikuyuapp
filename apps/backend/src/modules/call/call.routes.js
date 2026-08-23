// src/modules/call/call.routes.js
const express = require('express');
const router = express.Router();
const callController = require('./call.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const {
    validateCallId,
    validateRateCall
} = require('./call.validation');

// All call routes are protected
router.use(protect);

router.get('/history', callController.getCallHistory);
router.get('/stats', callController.getCallStats);
router.get('/:callId', validateCallId, validate, callController.getCall);
router.post('/:callId/end', validateCallId, validate, callController.endCall);
router.post('/:callId/rate', validateCallId, validateRateCall, validate, callController.rateCallQuality);

module.exports = router;