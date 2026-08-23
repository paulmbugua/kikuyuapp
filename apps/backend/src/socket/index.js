// src/socket/index.js
const socketIO = require('socket.io');
const config = require('../config/env');
const { authenticateSocket } = require('./auth');
const { setupChatHandlers, deliverQueuedNotifications } = require('./handlers/chat');
const { setupCallHandlers } = require('./handlers/call');
const { setupPresenceHandlers } = require('./handlers/presence');
const { setupVoiceSpaceHandlers } = require('./handlers/voiceSpace');
const pool = require('../config/db');
const logger = require('../utils/logger');

let io;

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling']
    });

    // Authentication middleware
    io.use(authenticateSocket);

    // Connection handler
    io.on('connection', async (socket) => {
        const userId = socket.user.id;
        const username = socket.user.username;
        
        console.log(`🔌 Socket connected: ${socket.id} (User: ${userId} - ${username})`);

        try {
            // Update user presence to online
            await pool.query(
                `INSERT INTO user_presence (user_id, status, socket_id, last_seen_at)
                 VALUES ($1::UUID, 'online', $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) 
                 DO UPDATE SET status = 'online', socket_id = $2, last_seen_at = CURRENT_TIMESTAMP`,
                [userId, socket.id]
            );

            // Join user's personal room
            socket.join(`user:${userId}`);

            // Broadcast to all connected users that this user is online
            socket.broadcast.emit('presence:updated', {
                type: 'presence:updated',
                user_id: userId,
                username: username,
                status: 'online',
                last_seen_at: new Date().toISOString()
            });

            // Deliver any queued notifications for this user
            await deliverQueuedNotifications(io, socket, userId);

            // Get user's unread notification count
            const unreadCountResult = await pool.query(
                `SELECT COUNT(*) as unread_count 
                 FROM notifications 
                 WHERE user_id = $1::UUID AND is_read = false`,
                [userId]
            );
            const unreadCount = parseInt(unreadCountResult.rows[0].unread_count);
            
            if (unreadCount > 0) {
                socket.emit('notification:badge_update', {
                    unread_count: unreadCount,
                    type: 'all'
                });
            }

            // Get unread message count
            const unreadMessagesResult = await pool.query(
                `SELECT COUNT(*) as unread_count
                 FROM messages m
                 JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
                 WHERE cp.user_id = $1::UUID 
                   AND m.user_id != $1::UUID 
                   AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
                   AND m.is_deleted = false`,
                [userId]
            );
            const unreadMessages = parseInt(unreadMessagesResult.rows[0].unread_count);
            
            if (unreadMessages > 0) {
                socket.emit('chat:unread_count', {
                    unread_count: unreadMessages
                });
            }

            // Setup handlers
            setupChatHandlers(io, socket);
            setupCallHandlers(io, socket);
            setupPresenceHandlers(io, socket);
            setupVoiceSpaceHandlers(io, socket);

        } catch (error) {
            console.error('Socket connection error:', error);
            socket.emit('error', { message: 'Failed to establish connection' });
        }

        // Handle disconnection
        socket.on('disconnect', async () => {
            console.log(`🔌 Socket disconnected: ${socket.id} (User: ${userId} - ${username})`);

            try {
                // Check if user has other active sockets before marking offline
                const otherSockets = await io.fetchSockets();
                const userOtherSockets = otherSockets.filter(s => 
                    s.user?.id === userId && s.id !== socket.id
                );

                if (userOtherSockets.length === 0) {
                    // No other active connections, mark as offline
                    await pool.query(
                        `UPDATE user_presence 
                         SET status = 'offline', last_seen_at = CURRENT_TIMESTAMP, socket_id = NULL
                         WHERE user_id = $1::UUID`,
                        [userId]
                    );

                    // Broadcast to all connected users that this user is offline
                    socket.broadcast.emit('presence:updated', {
                        type: 'presence:updated',
                        user_id: userId,
                        username: username,
                        status: 'offline',
                        last_seen_at: new Date().toISOString()
                    });
                } else {
                    // User still has other active connections
                    console.log(`User ${userId} has ${userOtherSockets.length} other active connections`);
                    
                    // Update socket_id to one of the remaining connections
                    await pool.query(
                        `UPDATE user_presence 
                         SET socket_id = $1
                         WHERE user_id = $2::UUID`,
                        [userOtherSockets[0].id, userId]
                    );
                }

            } catch (error) {
                console.error('Socket disconnect error:', error);
            }
        });

        // Handle reconnection
        socket.on('reconnect', async () => {
            console.log(`🔄 Socket reconnected: ${socket.id} (User: ${userId} - ${username})`);
            
            try {
                // Update presence back to online
                await pool.query(
                    `UPDATE user_presence 
                     SET status = 'online', socket_id = $1, last_seen_at = CURRENT_TIMESTAMP
                     WHERE user_id = $2::UUID`,
                    [socket.id, userId]
                );

                // Broadcast status change
                socket.broadcast.emit('presence:updated', {
                    type: 'presence:updated',
                    user_id: userId,
                    username: username,
                    status: 'online',
                    last_seen_at: new Date().toISOString()
                });

                // Deliver any queued notifications
                await deliverQueuedNotifications(io, socket, userId);

            } catch (error) {
                console.error('Socket reconnection error:', error);
            }
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error('Socket error:', error);
            socket.emit('error', { message: 'Connection error occurred' });
        });
    });

    // Periodic cleanup of stale connections (every 5 minutes)
    setInterval(async () => {
        try {
            const staleTimeout = 5 * 60 * 1000; // 5 minutes
            const staleTime = new Date(Date.now() - staleTimeout);
            
            const staleConnections = await pool.query(
                `SELECT user_id, socket_id 
                 FROM user_presence 
                 WHERE status = 'online' 
                   AND last_seen_at < $1`,
                [staleTime]
            );
            
            for (const stale of staleConnections.rows) {
                console.log(`Cleaning up stale connection for user ${stale.user_id}`);
                
                await pool.query(
                    `UPDATE user_presence 
                     SET status = 'offline', last_seen_at = CURRENT_TIMESTAMP, socket_id = NULL
                     WHERE user_id = $1::UUID`,
                    [stale.user_id]
                );
                
                // Notify other users
                io.emit('presence:updated', {
                    type: 'presence:updated',
                    user_id: stale.user_id,
                    status: 'offline',
                    last_seen_at: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Stale connection cleanup error:', error);
        }
    }, 5 * 60 * 1000);

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Helper function to emit notification to specific user
const emitToUser = async (userId, event, data) => {
    try {
        const sockets = await io.fetchSockets();
        const userSockets = sockets.filter(socket => socket.user?.id === userId);
        
        if (userSockets.length > 0) {
            userSockets.forEach(socket => {
                socket.emit(event, data);
            });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error emitting to user:', error);
        return false;
    }
};

// Helper function to emit to all user's devices
const emitToUserDevices = async (userId, event, data) => {
    try {
        const sockets = await io.fetchSockets();
        const userSockets = sockets.filter(socket => socket.user?.id === userId);
        
        userSockets.forEach(socket => {
            socket.emit(event, data);
        });
        
        return userSockets.length > 0;
    } catch (error) {
        console.error('Error emitting to user devices:', error);
        return false;
    }
};

// Helper function to check if user is online
const isUserOnline = async (userId) => {
    try {
        const result = await pool.query(
            'SELECT status FROM user_presence WHERE user_id = $1::UUID',
            [userId]
        );
        return result.rows[0]?.status === 'online';
    } catch (error) {
        console.error('Error checking user online status:', error);
        return false;
    }
};

// Helper function to get all online users
const getOnlineUsers = async () => {
    try {
        const result = await pool.query(
            'SELECT user_id, status, last_seen_at FROM user_presence WHERE status = \'online\''
        );
        return result.rows;
    } catch (error) {
        console.error('Error getting online users:', error);
        return [];
    }
};

module.exports = {
    initializeSocket,
    getIO,
    emitToUser,
    emitToUserDevices,
    isUserOnline,
    getOnlineUsers
};