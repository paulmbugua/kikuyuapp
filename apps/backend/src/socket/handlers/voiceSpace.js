const pool = require('../../config/db');
const logger = require('../../utils/logger');

// Store active voice space participants
const voiceSpaceRooms = new Map(); // spaceId -> Map of socketId -> user info
const voiceSpaceParticipants = new Map(); // spaceId -> Set of userIds

const setupVoiceSpaceHandlers = (io, socket) => {
    const userId = socket.user.id;
    const username = socket.user.username;
    const fullName = socket.user.full_name;
    const avatarUrl = socket.user.avatar_url;

    // Join a voice space
    socket.on('voice-space:join', async (data) => {
        try {
            const { spaceId } = data;

            // Check if user is already in the space
            if (!voiceSpaceRooms.has(spaceId)) {
                voiceSpaceRooms.set(spaceId, new Map());
                voiceSpaceParticipants.set(spaceId, new Set());
            }

            const roomParticipants = voiceSpaceRooms.get(spaceId);
            
            // Add user to room
            roomParticipants.set(socket.id, {
                userId,
                username,
                fullName,
                avatarUrl,
                role: data.role || 'listener',
                isMuted: true,
                hasHandRaised: false,
                joinedAt: new Date().toISOString()
            });
            
            voiceSpaceParticipants.get(spaceId).add(userId);
            
            // Join socket room
            socket.join(`voice-space:${spaceId}`);
            
            // Store spaceId on socket for cleanup
            socket.voiceSpaceId = spaceId;
            
            // Notify all participants about new user
            io.to(`voice-space:${spaceId}`).emit('voice-space:user-joined', {
                userId,
                username,
                fullName,
                avatarUrl,
                role: data.role || 'listener',
                joinedAt: new Date().toISOString()
            });
            
            // Send current participants list to new user
            const participants = Array.from(roomParticipants.values()).map(p => ({
                userId: p.userId,
                username: p.username,
                fullName: p.fullName,
                avatarUrl: p.avatarUrl,
                role: p.role,
                isMuted: p.isMuted,
                hasHandRaised: p.hasHandRaised
            }));
            
            socket.emit('voice-space:participants', {
                spaceId,
                participants
            });
            
            logger.info(`User ${username} joined voice space ${spaceId}`);
            
        } catch (error) {
            logger.error('Voice space join error:', error);
            socket.emit('error', { message: 'Failed to join voice space' });
        }
    });

    // Leave voice space
    socket.on('voice-space:leave', async (data) => {
        try {
            const { spaceId } = data;
            
            if (voiceSpaceRooms.has(spaceId)) {
                const roomParticipants = voiceSpaceRooms.get(spaceId);
                const userInfo = roomParticipants.get(socket.id);
                
                if (userInfo) {
                    roomParticipants.delete(socket.id);
                    voiceSpaceParticipants.get(spaceId)?.delete(userId);
                    
                    // Notify others
                    io.to(`voice-space:${spaceId}`).emit('voice-space:user-left', {
                        userId,
                        username,
                        leftAt: new Date().toISOString()
                    });
                    
                    // Clean up empty rooms
                    if (roomParticipants.size === 0) {
                        voiceSpaceRooms.delete(spaceId);
                        voiceSpaceParticipants.delete(spaceId);
                    }
                }
            }
            
            socket.leave(`voice-space:${spaceId}`);
            delete socket.voiceSpaceId;
            
            logger.info(`User ${username} left voice space ${spaceId}`);
            
        } catch (error) {
            logger.error('Voice space leave error:', error);
        }
    });

    // Raise hand
    socket.on('voice-space:raise-hand', async (data) => {
        try {
            const { spaceId } = data;
            
            if (voiceSpaceRooms.has(spaceId)) {
                const roomParticipants = voiceSpaceRooms.get(spaceId);
                const userInfo = roomParticipants.get(socket.id);
                
                if (userInfo && userInfo.role === 'listener') {
                    userInfo.hasHandRaised = true;
                    roomParticipants.set(socket.id, userInfo);
                    
                    // Update in database
                    await pool.query(
                        `UPDATE voice_space_participants 
                         SET has_hand_raised = true 
                         WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
                        [spaceId, userId]
                    );
                    
                    // Notify host and speakers
                    io.to(`voice-space:${spaceId}`).emit('voice-space:hand-raised', {
                        userId,
                        username,
                        fullName,
                        raisedAt: new Date().toISOString()
                    });
                }
            }
            
        } catch (error) {
            logger.error('Voice space raise hand error:', error);
        }
    });

    // Lower hand
    socket.on('voice-space:lower-hand', async (data) => {
        try {
            const { spaceId } = data;
            
            if (voiceSpaceRooms.has(spaceId)) {
                const roomParticipants = voiceSpaceRooms.get(spaceId);
                const userInfo = roomParticipants.get(socket.id);
                
                if (userInfo) {
                    userInfo.hasHandRaised = false;
                    roomParticipants.set(socket.id, userInfo);
                    
                    await pool.query(
                        `UPDATE voice_space_participants 
                         SET has_hand_raised = false 
                         WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
                        [spaceId, userId]
                    );
                    
                    io.to(`voice-space:${spaceId}`).emit('voice-space:hand-lowered', {
                        userId,
                        username
                    });
                }
            }
            
        } catch (error) {
            logger.error('Voice space lower hand error:', error);
        }
    });

    // Approve speaker (host only)
    socket.on('voice-space:approve-speaker', async (data) => {
        try {
            const { spaceId, targetUserId } = data;
            
            // Check if user is host
            const roomParticipants = voiceSpaceRooms.get(spaceId);
            const hostInfo = roomParticipants.get(socket.id);
            
            if (hostInfo && hostInfo.role === 'host') {
                // Find target user's socket
                let targetSocketId = null;
                for (const [sid, info] of roomParticipants) {
                    if (info.userId === targetUserId) {
                        targetSocketId = sid;
                        break;
                    }
                }
                
                if (targetSocketId) {
                    const targetInfo = roomParticipants.get(targetSocketId);
                    targetInfo.role = 'speaker';
                    targetInfo.hasHandRaised = false;
                    targetInfo.isMuted = false;
                    roomParticipants.set(targetSocketId, targetInfo);
                    
                    await pool.query(
                        `UPDATE voice_space_participants 
                         SET role = 'speaker', has_hand_raised = false, is_muted = false
                         WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
                        [spaceId, targetUserId]
                    );
                    
                    io.to(`voice-space:${spaceId}`).emit('voice-space:speaker-approved', {
                        userId: targetUserId,
                        username: targetInfo.username
                    });
                    
                    // Notify the approved user
                    io.to(targetSocketId).emit('voice-space:become-speaker', {
                        spaceId,
                        message: 'You have been approved to speak!'
                    });
                }
            }
            
        } catch (error) {
            logger.error('Voice space approve speaker error:', error);
        }
    });

    // Mute participant (host only)
    socket.on('voice-space:mute', async (data) => {
        try {
            const { spaceId, targetUserId, isMuted } = data;
            
            const roomParticipants = voiceSpaceRooms.get(spaceId);
            const hostInfo = roomParticipants.get(socket.id);
            
            if (hostInfo && hostInfo.role === 'host') {
                let targetSocketId = null;
                for (const [sid, info] of roomParticipants) {
                    if (info.userId === targetUserId) {
                        targetSocketId = sid;
                        break;
                    }
                }
                
                if (targetSocketId) {
                    const targetInfo = roomParticipants.get(targetSocketId);
                    targetInfo.isMuted = isMuted;
                    roomParticipants.set(targetSocketId, targetInfo);
                    
                    await pool.query(
                        `UPDATE voice_space_participants 
                         SET is_muted = $1
                         WHERE space_id = $2 AND user_id = $3 AND left_at IS NULL`,
                        [isMuted, spaceId, targetUserId]
                    );
                    
                    io.to(`voice-space:${spaceId}`).emit('voice-space:muted', {
                        userId: targetUserId,
                        isMuted,
                        mutedBy: userId
                    });
                    
                    io.to(targetSocketId).emit('voice-space:you-were-muted', {
                        isMuted
                    });
                }
            }
            
        } catch (error) {
            logger.error('Voice space mute error:', error);
        }
    });

    // Remove participant (host only)
    socket.on('voice-space:remove', async (data) => {
        try {
            const { spaceId, targetUserId } = data;
            
            const roomParticipants = voiceSpaceRooms.get(spaceId);
            const hostInfo = roomParticipants.get(socket.id);
            
            if (hostInfo && hostInfo.role === 'host') {
                let targetSocketId = null;
                for (const [sid, info] of roomParticipants) {
                    if (info.userId === targetUserId) {
                        targetSocketId = sid;
                        break;
                    }
                }
                
                if (targetSocketId) {
                    roomParticipants.delete(targetSocketId);
                    voiceSpaceParticipants.get(spaceId)?.delete(targetUserId);
                    
                    await pool.query(
                        `UPDATE voice_space_participants 
                         SET left_at = CURRENT_TIMESTAMP
                         WHERE space_id = $1 AND user_id = $2 AND left_at IS NULL`,
                        [spaceId, targetUserId]
                    );
                    
                    io.to(`voice-space:${spaceId}`).emit('voice-space:user-removed', {
                        userId: targetUserId,
                        removedBy: userId
                    });
                    
                    io.to(targetSocketId).emit('voice-space:you-were-removed', {
                        spaceId,
                        reason: 'You were removed by the host'
                    });
                    
                    io.to(targetSocketId).socketsLeave(`voice-space:${spaceId}`);
                }
            }
            
        } catch (error) {
            logger.error('Voice space remove error:', error);
        }
    });

    // WebRTC signaling for audio
    socket.on('voice-space:signal', (data) => {
        const { spaceId, signal, targetUserId } = data;
        
        // Forward signal to target user
        const roomParticipants = voiceSpaceRooms.get(spaceId);
        if (roomParticipants) {
            let targetSocketId = null;
            for (const [sid, info] of roomParticipants) {
                if (info.userId === targetUserId) {
                    targetSocketId = sid;
                    break;
                }
            }
            
            if (targetSocketId) {
                io.to(targetSocketId).emit('voice-space:signal', {
                    from: userId,
                    signal,
                    spaceId
                });
            }
        }
    });

    // Send chat message in voice space
    socket.on('voice-space:chat', async (data) => {
        try {
            const { spaceId, message } = data;
            
            // Save to database
            const result = await pool.query(
                `INSERT INTO voice_space_messages (space_id, user_id, message)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [spaceId, userId, message]
            );
            
            const savedMessage = result.rows[0];
            
            // Broadcast to everyone in the space
            io.to(`voice-space:${spaceId}`).emit('voice-space:new-message', {
                id: savedMessage.id,
                userId,
                username,
                fullName,
                avatarUrl,
                message,
                createdAt: savedMessage.created_at
            });
            
        } catch (error) {
            logger.error('Voice space chat error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Get chat history
    socket.on('voice-space:history', async (data) => {
        try {
            const { spaceId, limit = 50 } = data;
            
            const result = await pool.query(
                `SELECT m.*, u.username, u.full_name, u.avatar_url
                 FROM voice_space_messages m
                 JOIN users u ON m.user_id = u.id
                 WHERE m.space_id = $1
                 ORDER BY m.created_at DESC
                 LIMIT $2`,
                [spaceId, limit]
            );
            
            socket.emit('voice-space:history', {
                spaceId,
                messages: result.rows.reverse()
            });
            
        } catch (error) {
            logger.error('Voice space history error:', error);
        }
    });
};

module.exports = {
    setupVoiceSpaceHandlers
};