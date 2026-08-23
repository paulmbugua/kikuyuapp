// src/socket/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const pool = require('../config/db');

const authenticateSocket = async (socket, next) => {
    try {
        // Get token from multiple possible locations
        let token = socket.handshake.auth.token || 
                   socket.handshake.query.token ||
                   socket.handshake.headers.authorization?.split(' ')[1];

        // Also check cookies if available
        if (!token && socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'token' || name === 'accessToken') {
                    token = value;
                    break;
                }
            }
        }

        if (!token) {
            console.log('No token provided for socket connection');
            return next(new Error('Authentication required'));
        }

        console.log('Socket authentication - Token received');

        try {
            // Verify JWT
            const decoded = jwt.verify(token, config.jwt.secret);
            console.log('Token verified for user:', decoded.id);
            
            // Get user from database
            let user;
            
            if (decoded.isStaff) {
                const result = await pool.query(
                    'SELECT id, username, email, full_name, avatar_url FROM staff WHERE id = $1 AND is_active = true',
                    [decoded.id]
                );
                user = result.rows[0];
                if (user) user.isStaff = true;
            } else {
                const result = await pool.query(
                    'SELECT id, username, email, full_name, avatar_url FROM users WHERE id = $1 AND is_active = true',
                    [decoded.id]
                );
                user = result.rows[0];
                if (user) user.isStaff = false;
            }

            if (!user) {
                console.log('User not found in database:', decoded.id);
                return next(new Error('User not found'));
            }

            // Attach user to socket
            socket.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                isStaff: user.isStaff || false
            };

            console.log('Socket authenticated for user:', socket.user.username);
            next();

        } catch (jwtError) {
            console.error('JWT verification error:', jwtError.message);
            return next(new Error('Invalid token'));
        }

    } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
    }
};

module.exports = {
    authenticateSocket
};