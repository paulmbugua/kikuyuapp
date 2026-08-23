// src/modules/uhoro/uhoro.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class UhoroModel {
    // Upload new video
    static async create(userId, videoData, metadata) {
        const {
            videoUrl,
            videoPublicId,
            thumbnailUrl,
            thumbnailPublicId,
            title,
            description,
            duration,
            width,
            height,
            fileSize,
            format,
            allowsComments = true,
            allowsDuets = true,
            allowsStitches = true,
            isPrivate = false
        } = videoData;

        const query = `
            INSERT INTO uhoro_videos (
                user_id, video_url, video_public_id, thumbnail_url, thumbnail_public_id,
                title, description, duration, width, height, file_size, format,
                allows_comments, allows_duets, allows_stitches, is_private,
                moderation_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `;

        const values = [
            userId, videoUrl, videoPublicId, thumbnailUrl, thumbnailPublicId,
            title, description, duration, width, height, fileSize, format,
            allowsComments, allowsDuets, allowsStitches, isPrivate,
            'pending' // All videos start as pending moderation
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Get video by ID
    static async findById(videoId, currentUserId = null) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                -- Interaction status
                CASE 
                    WHEN $2 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $2 AND video_id = v.id)
                    ELSE false
                END as is_liked,
                
                -- Follow status
                CASE 
                    WHEN $2 IS NOT NULL AND $2 != v.user_id THEN
                        EXISTS(
                            SELECT 1 FROM follows 
                            WHERE follower_id = $2 AND following_id = v.user_id AND status = 'accepted'
                        )
                    ELSE false
                END as is_following,
                
                -- Check if user has watched
                CASE 
                    WHEN $2 IS NOT NULL THEN
                        EXISTS(SELECT 1 FROM uhoro_views WHERE user_id = $2 AND video_id = v.id)
                    ELSE false
                END as has_watched
                
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            WHERE v.id = $1 AND v.is_active = true AND v.moderation_status = 'approved'
        `;

        const result = await pool.query(query, [videoId, currentUserId]);
        return result.rows[0];
    }

    // Get feed for user (algorithmic feed)
    static async getFeed(userId, limit = 10, offset = 0) {
        const query = `
            WITH user_interactions AS (
                SELECT 
                    video_id,
                    COUNT(*) as interaction_score
                FROM (
                    SELECT video_id FROM uhoro_views WHERE user_id = $1
                    UNION ALL
                    SELECT video_id FROM uhoro_likes WHERE user_id = $1
                    UNION ALL
                    SELECT video_id FROM uhoro_comments WHERE user_id = $1
                ) interactions
                GROUP BY video_id
            ),
            
            followed_users AS (
                SELECT following_id
                FROM follows
                WHERE follower_id = $1 AND status = 'accepted'
            ),
            
            potential_videos AS (
                SELECT 
                    v.*,
                    u.username, u.full_name, u.avatar_url, u.is_verified,
                    
                    -- Calculate relevance score
                    (
                        CASE WHEN v.user_id IN (SELECT following_id FROM followed_users) THEN 100 ELSE 0 END +
                        COALESCE(ui.interaction_score * 10, 0) +
                        v.likes_count * 0.5 +
                        v.views_count * 0.1 +
                        EXTRACT(EPOCH FROM v.created_at) / 86400
                    ) as relevance_score,
                    
                    -- Check if user already interacted
                    EXISTS(SELECT 1 FROM uhoro_views WHERE user_id = $1 AND video_id = v.id) as viewed,
                    EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $1 AND video_id = v.id) as liked
                    
                FROM uhoro_videos v
                JOIN users u ON v.user_id = u.id
                LEFT JOIN user_interactions ui ON v.id = ui.video_id
                WHERE 
                    v.is_active = true 
                    AND v.moderation_status = 'approved'
                    AND v.is_private = false
                    AND v.user_id != $1
                    AND NOT EXISTS (
                        SELECT 1 FROM follows 
                        WHERE follower_id = v.user_id AND following_id = $1 AND status = 'blocked'
                    )
                ORDER BY relevance_score DESC
                LIMIT $2 OFFSET $3
            )
            
            SELECT * FROM potential_videos
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    // Get for you feed (anonymous/personalized)
    static async getForYouFeed(userId = null, limit = 10, offset = 0) {
        if (!userId) {
            // Anonymous feed - popular videos
            return this.getPopularFeed(limit, offset);
        }

        return this.getFeed(userId, limit, offset);
    }

    // Get popular videos
    static async getPopularFeed(limit = 10, offset = 0) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                -- Engagement score
                (v.likes_count * 2 + v.comments_count * 3 + v.shares_count * 4 + v.views_count * 0.1) as popularity_score
                
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            WHERE 
                v.is_active = true 
                AND v.moderation_status = 'approved'
                AND v.is_private = false
                AND v.created_at > NOW() - INTERVAL '7 days'
            ORDER BY popularity_score DESC, v.created_at DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }

    // Get following feed (only from followed users)
    static async getFollowingFeed(userId, limit = 10, offset = 0) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $1 AND video_id = v.id) as is_liked
                
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            WHERE 
                v.is_active = true 
                AND v.moderation_status = 'approved'
                AND v.user_id IN (
                    SELECT following_id 
                    FROM follows 
                    WHERE follower_id = $1 AND status = 'accepted'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM follows 
                    WHERE follower_id = v.user_id AND following_id = $1 AND status = 'blocked'
                )
            ORDER BY v.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    // Get videos by user
    static async findByUser(userId, currentUserId = null, limit = 20, offset = 0) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                CASE 
                    WHEN $2 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $2 AND video_id = v.id)
                    ELSE false
                END as is_liked
                
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            WHERE 
                v.user_id = $1 
                AND v.is_active = true 
                AND v.moderation_status = 'approved'
                AND (
                    v.is_private = false 
                    OR v.user_id = $2
                    OR EXISTS(
                        SELECT 1 FROM follows 
                        WHERE follower_id = $2 AND following_id = $1 AND status = 'accepted'
                    )
                )
            ORDER BY v.created_at DESC
            LIMIT $3 OFFSET $4
        `;

        const result = await pool.query(query, [userId, currentUserId, limit, offset]);
        return result.rows;
    }

    // Update video
    static async update(videoId, userId, updates) {
        const allowedFields = ['title', 'description', 'is_private', 'allows_comments', 'allows_duets', 'allows_stitches'];
        
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key) && updates[key] !== undefined) {
                setClause.push(`${key} = $${paramIndex}`);
                values.push(updates[key]);
                paramIndex++;
            }
        });

        if (setClause.length === 0) {
            throw new AppError('No valid fields to update', 400);
        }

        values.push(videoId, userId);
        const query = `
            UPDATE uhoro_videos 
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            throw new AppError('Video not found or you do not have permission to update it', 404);
        }

        return result.rows[0];
    }

    // Delete video (soft delete)
    static async delete(videoId, userId) {
        const query = `
            UPDATE uhoro_videos 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING id, video_public_id, thumbnail_public_id
        `;

        const result = await pool.query(query, [videoId, userId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Video not found or you do not have permission to delete it', 404);
        }

        return result.rows[0];
    }

    // Search videos
    static async search(query, filters = {}, limit = 20, offset = 0) {
        let sqlQuery = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            WHERE 
                v.is_active = true 
                AND v.moderation_status = 'approved'
                AND v.is_private = false
        `;

        const values = [];
        let paramIndex = 1;

        if (query) {
            sqlQuery += ` AND (
                v.title ILIKE $${paramIndex} 
                OR v.description ILIKE $${paramIndex}
                OR u.username ILIKE $${paramIndex}
            )`;
            values.push(`%${query}%`);
            paramIndex++;
        }

        if (filters.userId) {
            sqlQuery += ` AND v.user_id = $${paramIndex}`;
            values.push(filters.userId);
            paramIndex++;
        }

        if (filters.minLikes) {
            sqlQuery += ` AND v.likes_count >= $${paramIndex}`;
            values.push(filters.minLikes);
            paramIndex++;
        }

        sqlQuery += ` ORDER BY v.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(limit, offset);

        const result = await pool.query(sqlQuery, values);
        return result.rows;
    }

    // Get trending hashtags
    static async getTrendingHashtags(limit = 20) {
        const query = `
            SELECT 
                name,
                videos_count,
                views_count,
                EXTRACT(epoch FROM (NOW() - last_used_at)) / 3600 as hours_since_last_used
            FROM uhoro_hashtags
            WHERE videos_count > 0
            ORDER BY (videos_count * 10 + views_count) DESC, last_used_at DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    // Get videos by hashtag
    static async findByHashtag(hashtag, userId = null, limit = 20, offset = 0) {
        const query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.avatar_url, u.is_verified,
                
                CASE 
                    WHEN $2 IS NOT NULL THEN 
                        EXISTS(SELECT 1 FROM uhoro_likes WHERE user_id = $2 AND video_id = v.id)
                    ELSE false
                END as is_liked
                
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            JOIN uhoro_video_hashtags vh ON v.id = vh.video_id
            JOIN uhoro_hashtags h ON vh.hashtag_id = h.id
            WHERE 
                h.name = LOWER($1)
                AND v.is_active = true
                AND v.moderation_status = 'approved'
                AND v.is_private = false
            ORDER BY v.likes_count DESC, v.created_at DESC
            LIMIT $3 OFFSET $4
        `;

        const result = await pool.query(query, [hashtag, userId, limit, offset]);
        return result.rows;
    }

    // Record video view
    static async recordView(videoId, userId, watchDuration, watchedPercentage, completed) {
        const query = `
            INSERT INTO uhoro_views (video_id, user_id, watch_duration, watched_percentage, completed)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;

        const result = await pool.query(query, [videoId, userId, watchDuration, watchedPercentage, completed]);
        return result.rows[0];
    }

    // Get video analytics
    static async getAnalytics(videoId, userId) {
        // Check ownership
        const videoCheck = await pool.query(
            'SELECT user_id FROM uhoro_videos WHERE id = $1',
            [videoId]
        );

        if (videoCheck.rows.length === 0 || videoCheck.rows[0].user_id !== userId) {
            throw new AppError('Unauthorized to view analytics', 403);
        }

        const query = `
            SELECT
                -- Overview
                (SELECT views_count FROM uhoro_videos WHERE id = $1) as total_views,
                (SELECT likes_count FROM uhoro_videos WHERE id = $1) as total_likes,
                (SELECT comments_count FROM uhoro_videos WHERE id = $1) as total_comments,
                (SELECT shares_count FROM uhoro_videos WHERE id = $1) as total_shares,
                
                -- Average watch time
                (SELECT AVG(watch_duration) FROM uhoro_views WHERE video_id = $1) as avg_watch_duration,
                (SELECT AVG(watched_percentage) FROM uhoro_views WHERE video_id = $1) as avg_watch_percentage,
                (SELECT COUNT(*) FROM uhoro_views WHERE video_id = $1 AND completed = true) as completions,
                
                -- Daily views (last 7 days)
                (
                    SELECT json_agg(json_build_object('date', date, 'views', views))
                    FROM (
                        SELECT 
                            DATE(created_at) as date,
                            COUNT(*) as views
                        FROM uhoro_views
                        WHERE video_id = $1 AND created_at > NOW() - INTERVAL '7 days'
                        GROUP BY DATE(created_at)
                        ORDER BY date DESC
                    ) daily
                ) as daily_views,
                
                -- Audience demographics (if available)
                (
                    SELECT json_agg(json_build_object('country', country, 'count', count))
                    FROM (
                        SELECT u.country, COUNT(*) as count
                        FROM uhoro_views v
                        JOIN users u ON v.user_id = u.id
                        WHERE v.video_id = $1 AND u.country IS NOT NULL
                        GROUP BY u.country
                        ORDER BY count DESC
                        LIMIT 10
                    ) demographics
                ) as demographics
        `;

        const result = await pool.query(query, [videoId]);
        return result.rows[0];
    }

    // Moderate video (staff only)
    static async moderate(videoId, staffId, status, reason = null) {
        const query = `
            UPDATE uhoro_videos 
            SET 
                moderation_status = $1,
                moderation_reason = $2,
                moderated_by = $3,
                moderated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `;

        const result = await pool.query(query, [status, reason, staffId, videoId]);
        
        if (result.rows.length === 0) {
            throw new AppError('Video not found', 404);
        }

        return result.rows[0];
    }
}

module.exports = UhoroModel;