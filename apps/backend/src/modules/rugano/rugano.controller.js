// src/modules/rugano/rugano.controller.js
const RuganoModel = require('./rugano.model');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { AppError } = require('../../middleware/errorMiddleware');
const pool = require('../../config/db');  // Add this line

// Create a new voice space
const createSpace = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { title, topic, description, isPrivate, scheduledFor, maxParticipants } = req.body;

    if (!title || title.trim().length === 0) {
        throw new AppError('Space title is required', 400);
    }

    const space = await RuganoModel.createSpace(userId, {
        title,
        topic,
        description,
        isPrivate,
        scheduledFor,
        maxParticipants
    });

    ResponseHandler.created(res, { space }, 'Voice space created successfully');
});

// Start a live space
const startSpace = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;

    const space = await RuganoModel.startSpace(spaceId, userId);
    ResponseHandler.success(res, { space }, 'Space started');
});

// End a live space
const endSpace = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;

    const space = await RuganoModel.endSpace(spaceId, userId);
    ResponseHandler.success(res, { space }, 'Space ended');
});

// Join a space
const joinSpace = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;

    const participant = await RuganoModel.joinSpace(spaceId, userId);
    ResponseHandler.success(res, { participant }, 'Joined space');
});

// Leave a space
const leaveSpace = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;

    await RuganoModel.leaveSpace(spaceId, userId);
    ResponseHandler.success(res, null, 'Left space');
});

// Get live spaces
const getLiveSpaces = catchAsync(async (req, res) => {
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const spaces = await RuganoModel.getLiveSpaces(parseInt(limit), parseInt(offset));
    ResponseHandler.success(res, { spaces });
});

// Get space details
const getSpaceDetails = catchAsync(async (req, res) => {
    const { spaceId } = req.params;
    const userId = req.user?.id;

    const space = await RuganoModel.getSpaceDetails(spaceId, userId);

    if (!space) {
        throw new AppError('Space not found', 404);
    }

    ResponseHandler.success(res, { space });
});

// Raise hand
const raiseHand = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;

    await RuganoModel.raiseHand(spaceId, userId);
    ResponseHandler.success(res, null, 'Hand raised');
});

// Lower hand
const lowerHand = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;

    await RuganoModel.lowerHand(spaceId, userId);
    ResponseHandler.success(res, null, 'Hand lowered');
});

// Approve speaker (host only)
const approveSpeaker = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId, participantId } = req.params;

    const result = await RuganoModel.approveSpeaker(spaceId, participantId, userId);
    ResponseHandler.success(res, { result }, 'Speaker approved');
});

// Send chat message
const sendMessage = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        throw new AppError('Message cannot be empty', 400);
    }

    const result = await RuganoModel.sendMessage(spaceId, userId, message);
    ResponseHandler.created(res, { message: result }, 'Message sent');
});
// Add these methods to your rugano.controller.js

// Get upcoming spaces
const getUpcomingSpaces = catchAsync(async (req, res) => {
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            vs.id, vs.title, vs.topic, vs.scheduled_for,
            u.id as host_id, u.username as host_username, u.full_name as host_name, 
            u.avatar_url as host_avatar
        FROM voice_spaces vs
        JOIN users u ON vs.host_id = u.id
        WHERE vs.status = 'scheduled' AND vs.scheduled_for > NOW()
        ORDER BY vs.scheduled_for ASC
        LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [parseInt(limit), parseInt(offset)]);
    ResponseHandler.success(res, { spaces: result.rows });
});

// Toggle mute for participant (host only)
const toggleMute = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId, participantId } = req.params;
    const { isMuted } = req.body;

    // Verify host
    const space = await pool.query(
        'SELECT host_id FROM voice_spaces WHERE id = $1',
        [spaceId]
    );

    if (space.rows[0]?.host_id !== userId) {
        throw new AppError('Only host can mute participants', 403);
    }

    const result = await pool.query(
        `UPDATE voice_space_participants 
         SET is_muted = $1
         WHERE space_id = $2 AND user_id = $3 AND left_at IS NULL
         RETURNING *`,
        [isMuted, spaceId, participantId]
    );

    ResponseHandler.success(res, { participant: result.rows[0] }, isMuted ? 'Participant muted' : 'Participant unmuted');
});

// Remove participant (host only)
const removeParticipant = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { spaceId, participantId } = req.params;

    // Verify host
    const space = await pool.query(
        'SELECT host_id FROM voice_spaces WHERE id = $1',
        [spaceId]
    );

    if (space.rows[0]?.host_id !== userId) {
        throw new AppError('Only host can remove participants', 403);
    }

    const result = await pool.query(
        `UPDATE voice_space_participants 
         SET left_at = CURRENT_TIMESTAMP
         WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL
         RETURNING *`,
        [spaceId, participantId]
    );

    ResponseHandler.success(res, null, 'Participant removed');
});

// Get user's active spaces
const getUserActiveSpaces = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            vs.id, vs.title, vs.topic, vs.is_live, vs.listener_count,
            vsp.role,
            u.username as host_username
        FROM voice_space_participants vsp
        JOIN voice_spaces vs ON vsp.space_id = vs.id
        JOIN users u ON vs.host_id = u.id
        WHERE vsp.user_id = $1 AND vsp.left_at IS NULL AND vs.is_live = true
    `;

    const result = await pool.query(query, [userId]);
    ResponseHandler.success(res, { spaces: result.rows });
});
// Get chat messages
const getMessages = catchAsync(async (req, res) => {
    const { spaceId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const messages = await RuganoModel.getMessages(spaceId, parseInt(limit), parseInt(offset));
    ResponseHandler.success(res, { messages });
});

module.exports = {
    createSpace,
    startSpace,
    endSpace,
    joinSpace,
    leaveSpace,
    getLiveSpaces,
    getUpcomingSpaces,  // Add this
    getSpaceDetails,
    raiseHand,
    lowerHand,
    approveSpeaker,
    toggleMute,         // Add this
    removeParticipant,  // Add this
    getUserActiveSpaces, // Add this
    sendMessage,
    getMessages
};