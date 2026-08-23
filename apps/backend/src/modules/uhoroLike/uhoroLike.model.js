// src/modules/uhoroLike/uhoroLike.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class UhoroLikeModel {
    // Like a video
    static async like(userId, videoId) {
        // Check if video exists and is active
        const videoCheck = await pool.query(
            "SELECT id, user_id FROM uhoro_videos WHERE id = $1 AND is_active = true AND moderation_status = 'approved'",
            [videoId]
        );

        if (videoCheck.rows.length === 0) {
            throw new AppError('Video not found', 404);
        }

        const video = videoCheck.rows[0];

        // Check if already liked
        const existingLike = await pool.query(
            'SELECT id FROM uhoro_likes WHERE user_id = $1 AND video_id = $2',
            [userId, videoId]
        );

        if (existingLike.rows.length > 0) {
            throw new AppError('Video already liked', 400);
        }

        // Create like
        const query = `
            INSERT INTO uhoro_likes (user_id, video_id)
            VALUES ($1, $2)
            RETURNING id
        `;

        const result = await pool.query(query, [userId, videoId]);

        // Create notification for video owner
        if (video.user_id !== userId) {
            // Will implement in Step 7
        }

        return {
            liked: true,
            likeId: result.rows[0].id
        };
    }

    // Unlike a video
    static async unlike(userId, videoId) {
        const query = `
            DELETE FROM uhoro_likes 
            WHERE user_id = $1 AND video_id = $2
            RETURNING id
        `;

        const result = await pool.query(query, [userId, videoId]);

        if (result.rows.length === 0) {
            throw new AppError('Like not found', 404);
        }

        return { unliked: true };
    }

    // Get users who liked a video
    static async getLikers(videoId, limit = 50, offset = 0) {
        const query = `
            SELECT 
                u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
                l.created_at as liked_at
            FROM uhoro_likes l
            JOIN users u ON l.user_id = u.id
            WHERE l.video_id = $1
            ORDER BY l.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [videoId, limit, offset]);
        return result.rows;
    }

    // Check if user liked video
    static async hasLiked(userId, videoId) {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $1 AND video_id = $2) as liked',
            [userId, videoId]
        );

        return result.rows[0].liked;
    }

    // Get user's liked videos
    static async getUserLikedVideos(userId, limit = 20, offset = 0) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                true as is_liked
            FROM uhoro_likes l
            JOIN uhoro_videos v ON l.video_id = v.id
            JOIN users u ON v.user_id = u.id
            WHERE l.user_id = $1 AND v.is_active = true
            ORDER BY l.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }
}

module.exports = UhoroLikeModel;