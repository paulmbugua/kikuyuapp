const express = require('express');
const router = express.Router();
const ruganoController = require('./rugano.controller');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');

// Public routes (with optional auth)
router.get('/live', ruganoController.getLiveSpaces);
router.get('/upcoming', ruganoController.getUpcomingSpaces);
router.get('/:spaceId', optionalAuth, ruganoController.getSpaceDetails);

// Protected routes
router.use(protect);

// Space management
router.post('/', ruganoController.createSpace);
router.post('/:spaceId/start', ruganoController.startSpace);
router.post('/:spaceId/end', ruganoController.endSpace);
router.post('/:spaceId/join', ruganoController.joinSpace);
router.post('/:spaceId/leave', ruganoController.leaveSpace);

// Interaction
router.post('/:spaceId/raise-hand', ruganoController.raiseHand);
router.post('/:spaceId/lower-hand', ruganoController.lowerHand);
router.post('/:spaceId/approve-speaker/:participantId', ruganoController.approveSpeaker);
router.post('/:spaceId/mute/:participantId', ruganoController.toggleMute);
router.post('/:spaceId/remove/:participantId', ruganoController.removeParticipant);
router.get('/active/me', ruganoController.getUserActiveSpaces);

// Chat
router.get('/:spaceId/messages', ruganoController.getMessages);
router.post('/:spaceId/messages', ruganoController.sendMessage);

module.exports = router;