// src/socket/handlers/call.js
const CallModel = require('../../modules/call/call.model');
const logger = require('../../utils/logger');

const setupCallHandlers = (io, socket) => {
    const userId = socket.user.id;

    // Initiate call
    socket.on('call:start', async (data) => {
        try {
            const { receiverId, type } = data;

            // Create call record
            const call = await CallModel.initiate(userId, receiverId, type);

            // Join call room
            socket.join(`call:${call.id}`);

            // Notify receiver if online
            const receiverSockets = await io.in(`user:${receiverId}`).fetchSockets();
            
            if (receiverSockets.length > 0) {
                // Receiver is online
                io.to(`user:${receiverId}`).emit('call:incoming', {
                    call_id: call.id,
                    caller: {
                        id: userId,
                        username: socket.user.username,
                        full_name: socket.user.full_name
                    },
                    type: call.type,
                    call: call
                });
            } else {
                // Receiver is offline - create missed call
                await CallModel.missCall(call.id);
                socket.emit('call:offline', {
                    receiver_id: receiverId
                });
            }

            socket.emit('call:initiated', {
                call_id: call.id,
                call: call
            });

        } catch (error) {
            logger.error('Call start error:', error);
            socket.emit('error', { message: 'Failed to start call' });
        }
    });

    // Accept call
    socket.on('call:accept', async (data) => {
        try {
            const { callId } = data;

            const call = await CallModel.accept(callId, userId);

            // Join call room
            socket.join(`call:${callId}`);

            // Notify caller
            io.to(`user:${call.caller_id}`).emit('call:accepted', {
                call_id: callId,
                receiver: {
                    id: userId,
                    username: socket.user.username
                },
                call: call
            });

            // Notify all participants
            io.to(`call:${callId}`).emit('call:connected', {
                call_id: callId,
                participants: [call.caller_id, userId],
                started_at: call.started_at
            });

        } catch (error) {
            logger.error('Call accept error:', error);
            socket.emit('error', { message: 'Failed to accept call' });
        }
    });

    // Reject call
    socket.on('call:reject', async (data) => {
        try {
            const { callId } = data;

            const call = await CallModel.reject(callId, userId);

            // Notify caller
            io.to(`user:${call.caller_id}`).emit('call:rejected', {
                call_id: callId,
                receiver_id: userId,
                reason: 'rejected'
            });

        } catch (error) {
            logger.error('Call reject error:', error);
        }
    });

    // End call
    socket.on('call:end', async (data) => {
        try {
            const { callId } = data;

            const call = await CallModel.end(callId, userId);

            // Notify all participants
            io.to(`call:${callId}`).emit('call:ended', {
                call_id: callId,
                ended_by: userId,
                duration: call.duration,
                ended_at: call.ended_at
            });

            // Leave call room
            socket.leave(`call:${callId}`);

        } catch (error) {
            logger.error('Call end error:', error);
        }
    });

    // Call missed (timeout)
    socket.on('call:missed', async (data) => {
        try {
            const { callId } = data;

            const call = await CallModel.missCall(callId);

            // Notify caller
            io.to(`user:${call.caller_id}`).emit('call:missed', {
                call_id: callId,
                receiver_id: call.receiver_id
            });

        } catch (error) {
            logger.error('Call missed error:', error);
        }
    });

    // WebRTC signaling
    socket.on('call:signal', (data) => {
        const { callId, signal, to } = data;

        // Forward signal to specific user
        io.to(`user:${to}`).emit('call:signal', {
            call_id: callId,
            signal: signal,
            from: userId
        });
    });

    // Toggle audio/video
    socket.on('call:toggle', (data) => {
        const { callId, type, enabled } = data; // type: 'audio' or 'video'

        // Notify all participants
        socket.to(`call:${callId}`).emit('call:toggled', {
            call_id: callId,
            user_id: userId,
            type: type,
            enabled: enabled
        });
    });

    // Call quality metrics
    socket.on('call:quality', async (data) => {
        try {
            const { callId, metrics } = data;

            await CallModel.updateQuality(callId, metrics);

        } catch (error) {
            logger.error('Call quality error:', error);
        }
    });
};

module.exports = {
    setupCallHandlers
};