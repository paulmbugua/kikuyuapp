// src/modules/uhoroComment/uhoroComment.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class UhoroCommentModel {
    // Create comment
    static async create(videoId, userId, content, parentId = null) {
        // Check if video exists and allows comments
        const videoCheck = await pool.query(
            'SELECT id, user_id, allows_comments FROM uhoro_videos WHERE id = $1 AND is_active = true',
            [videoId]
        );

        if (videoCheck.rows.length === 0) {
            throw new AppError('Video not found', 404);
        }

        const video = videoCheck.rows[0];

        if (!video.allows_comments) {
            throw new AppError('Comments are disabled for this video', 403);
        }

        // If parentId is provided, check if it exists
        if (parentId) {
            const parentCheck = await pool.query(
                'SELECT id FROM uhoro_comments WHERE id = $1 AND video_id = $2 AND is_active = true',
                [parentId, videoId]
            );

            if (parentCheck.rows.length === 0) {
                throw new AppError('Parent comment not found', 404);
            }
        }

        const query = `
            INSERT INTO uhoro_comments (video_id, user_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await pool.query(query, [videoId, userId, content, parentId]);
        const comment = result.rows[0];

        // Create notification for video owner
        if (video.user_id !== userId) {
            // Will implement in Step 7
        }

        // If reply, notify parent comment owner
        if (parentId) {
            const parentComment = await this.findById(parentId);
            if (parentComment.user_id !== userId) {
                // Will implement in Step 7
            }
        }

        return this.findById(comment.id, userId);
    }

    // Get comment by ID
    static async findById(commentId, currentUserId = null) {
        const query = `
            SELECT 
                c.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                CASE 
                    WHEN $2 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_comment_likes WHERE user_id = $2 AND comment_id = c.id)
                    ELSE false
                END as is_liked
                
            FROM uhoro_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = $1 AND c.is_active = true
        `;

        const result = await pool.query(query, [commentId, currentUserId]);
        return result.rows[0];
    }

    // Get comments for a video
    static async getVideoComments(videoId, currentUserId = null, sort = 'popular', limit = 50, offset = 0) {
        const query = `
            SELECT 
                c.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                CASE 
                    WHEN $2 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_comment_likes WHERE user_id = $2 AND comment_id = c.id)
                    ELSE false
                END as is_liked
                
            FROM uhoro_comments c
            JOIN users u ON c.user_id = u.id
            WHERE 
                c.video_id = $1 
                AND c.parent_id IS NULL
                AND c.is_active = true
            ORDER BY ${sort === 'recent' ? 'c.created_at DESC' : sort === 'oldest' ? 'c.created_at ASC' : 'c.likes_count DESC, c.created_at DESC'}
            LIMIT $3 OFFSET $4
        `;

        const result = await pool.query(query, [videoId, currentUserId, limit, offset]);
        return result.rows;
    }

    // Get replies to a comment
    static async getReplies(commentId, currentUserId = null, limit = 50, offset = 0) {
        const query = `
            SELECT 
                c.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                CASE 
                    WHEN $2 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_comment_likes WHERE user_id = $2 AND comment_id = c.id)
                    ELSE false
                END as is_liked
                
            FROM uhoro_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.parent_id = $1 AND c.is_active = true
            ORDER BY c.created_at ASC
            LIMIT $3 OFFSET $4
        `;

        const result = await pool.query(query, [commentId, currentUserId, limit, offset]);
        return result.rows;
    }

    // Update comment
    static async update(commentId, userId, content) {
        const query = `
            UPDATE uhoro_comments 
            SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3 AND is_active = true
            RETURNING id
        `;

        const result = await pool.query(query, [content, commentId, userId]);

        if (result.rows.length === 0) {
            throw new AppError('Comment not found or you do not have permission to edit it', 404);
        }

        return this.findById(commentId, userId);
    }

    // Delete comment
    static async delete(commentId, userId) {
        const query = `
            UPDATE uhoro_comments 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;

        const result = await pool.query(query, [commentId, userId]);

        if (result.rows.length === 0) {
            throw new AppError('Comment not found or you do not have permission to delete it', 404);
        }

        return result.rows[0];
    }

    // Like a comment
    static async likeComment(userId, commentId) {
        // Check if comment exists
        const commentCheck = await pool.query(
            'SELECT id, user_id FROM uhoro_comments WHERE id = $1 AND is_active = true',
            [commentId]
        );

        if (commentCheck.rows.length === 0) {
            throw new AppError('Comment not found', 404);
        }

        const comment = commentCheck.rows[0];

        // Check if already liked
        const existingLike = await pool.query(
            'SELECT id FROM uhoro_comment_likes WHERE user_id = $1 AND comment_id = $2',
            [userId, commentId]
        );

        if (existingLike.rows.length > 0) {
            throw new AppError('Comment already liked', 400);
        }

        // Create like
        const query = `
            INSERT INTO uhoro_comment_likes (user_id, comment_id)
            VALUES ($1, $2)
            RETURNING id
        `;

        const result = await pool.query(query, [userId, commentId]);

        // Update comment likes count
        await pool.query(
            'UPDATE uhoro_comments SET likes_count = likes_count + 1 WHERE id = $1',
            [commentId]
        );

        // Create notification
        if (comment.user_id !== userId) {
            // Will implement in Step 7
        }

        return {
            liked: true,
            likeId: result.rows[0].id
        };
    }

    // Unlike a comment
    static async unlikeComment(userId, commentId) {
        const query = `
            DELETE FROM uhoro_comment_likes 
            WHERE user_id = $1 AND comment_id = $2
            RETURNING id
        `;

        const result = await pool.query(query, [userId, commentId]);

        if (result.rows.length === 0) {
            throw new AppError('Like not found', 404);
        }

        // Update comment likes count
        await pool.query(
            'UPDATE uhoro_comments SET likes_count = likes_count - 1 WHERE id = $1',
            [commentId]
        );

        return { unliked: true };
    }
}

module.exports = UhoroCommentModel;