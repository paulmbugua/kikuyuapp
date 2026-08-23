// src/socket/handlers/presence.js
const PresenceModel = require('../../modules/presence/presence.model');
const logger = require('../../utils/logger');

const setupPresenceHandlers = (io, socket) => {
    const userId = socket.user.id;

    // Update status
    socket.on('presence:status', async (data) => {
        try {
            const { status } = data; // 'online', 'away', 'busy'

            await PresenceModel.updatePresence(userId, status, socket.id);

            // Notify followers
            const followers = await PresenceModel.getOnlineFollowers(userId);
            
            followers.forEach(follower => {
                io.to(`user:${follower.id}`).emit('presence:updated', {
                    user_id: userId,
                    status: status,
                    updated_at: new Date().toISOString()
                });
            });
        } catch (error) {
            logger.error('Presence status error:', error);
            socket.emit('error', { message: 'Failed to update status' });
        }
    });

    // Get user's presence
    socket.on('presence:get', async (data) => {
        try {
            const { userId: targetUserId } = data;
            const presence = await PresenceModel.getUserPresence(targetUserId);
            
            socket.emit('presence:result', {
                user_id: targetUserId,
                presence: presence
            });
        } catch (error) {
            logger.error('Presence get error:', error);
        }
    });

    // Get presence for multiple users
    socket.on('presence:getMany', async (data) => {
        try {
            const { userIds } = data;
            
            if (!userIds || userIds.length === 0) {
                socket.emit('presence:many', { presences: [] });
                return;
            }
            
            const presences = await PresenceModel.getUsersPresence(userIds);
            
            socket.emit('presence:many', {
                presences: presences
            });
        } catch (error) {
            logger.error('Presence getMany error:', error);
            socket.emit('presence:many', { presences: [] });
        }
    });

    // Heartbeat (update last active)
    socket.on('presence:heartbeat', async () => {
        try {
            await PresenceModel.updateLastActive(userId);
        } catch (error) {
            logger.error('Presence heartbeat error:', error);
        }
    });

    // Get online followers
    socket.on('presence:followers', async () => {
        try {
            const followers = await PresenceModel.getOnlineFollowers(userId);
            socket.emit('presence:followers', { followers: followers });
        } catch (error) {
            logger.error('Presence followers error:', error);
        }
    });
};

module.exports = {
    setupPresenceHandlers
};