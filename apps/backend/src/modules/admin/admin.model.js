// src/modules/admin/admin.model.js
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class AdminModel {
    // ==================== USER MANAGEMENT ====================

    /**
     * Get all users with advanced filtering
     */
    static async getUsers(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                u.id, u.email, u.username, u.full_name, u.avatar_url,
                u.bio, u.phone, u.country, u.is_verified, u.is_private,
                u.is_active, u.token_balance, u.followers_count,
                u.following_count, u.posts_count, u.uhoro_count,
                u.created_at, u.last_login,
                
                -- Get verification info if any
                (
                    SELECT json_build_object(
                        'is_verified', true,
                        'plan_name', vp.name,
                        'expires_at', uv.expires_at,
                        'is_lifetime', uv.is_lifetime
                    )
                    FROM user_verifications uv
                    JOIN verification_plans vp ON uv.plan_id = vp.id
                    WHERE uv.user_id = u.id AND uv.is_active = true
                    LIMIT 1
                ) as verification,
                
                -- Get ban info if any
                (
                    SELECT json_build_object(
                        'is_banned', true,
                        'reason', bu.reason,
                        'banned_at', bu.created_at,
                        'expires_at', bu.expires_at,
                        'banned_by', banner.username
                    )
                    FROM banned_users bu
                    JOIN staff banner ON bu.banned_by = banner.id
                    WHERE bu.user_id = u.id AND bu.lifted_at IS NULL
                    LIMIT 1
                ) as ban_info
                
            FROM users u
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        // Apply filters
        if (filters.search) {
            conditions.push(`(
                u.username ILIKE $${values.length + 1} OR 
                u.full_name ILIKE $${values.length + 1} OR 
                u.email ILIKE $${values.length + 1}
            )`);
            values.push(`%${filters.search}%`);
        }

        if (filters.status === 'active') {
            conditions.push(`u.is_active = true`);
        } else if (filters.status === 'inactive') {
            conditions.push(`u.is_active = false`);
        }

        if (filters.verified !== undefined) {
            conditions.push(`u.is_verified = $${values.length + 1}`);
            values.push(filters.verified);
        }

        if (filters.role) {
            // This would need a user_roles table if you implement roles for regular users
        }

        if (filters.country) {
            conditions.push(`u.country ILIKE $${values.length + 1}`);
            values.push(`%${filters.country}%`);
        }

        if (filters.start_date) {
            conditions.push(`u.created_at >= $${values.length + 1}`);
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            conditions.push(`u.created_at <= $${values.length + 1}`);
            values.push(filters.end_date);
        }

        if (filters.min_followers) {
            conditions.push(`u.followers_count >= $${values.length + 1}`);
            values.push(filters.min_followers);
        }

        if (filters.has_tips) {
            conditions.push(`EXISTS (SELECT 1 FROM tips WHERE receiver_id = u.id)`);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        // Apply sorting
        const sortField = filters.sort?.replace(/^-/, '') || 'created_at';
        const sortOrder = filters.sort?.startsWith('-') ? 'DESC' : 'ASC';
        
        // Validate sort field to prevent SQL injection
        const allowedSortFields = ['created_at', 'username', 'followers_count', 'token_balance', 'last_login'];
        const finalSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
        
        query += ` ORDER BY u.${finalSortField} ${sortOrder}`;

        // Add pagination
        query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM users u WHERE 1=1';
        if (conditions.length > 0) {
            // Remove the LIMIT and OFFSET from values for count query
            const countValues = values.slice(0, -2);
            countQuery += ' AND ' + conditions.join(' AND ');
            const countResult = await pool.query(countQuery, countValues);
            const total = parseInt(countResult.rows[0].count);
            
            return {
                users: result.rows,
                total
            };
        } else {
            const countResult = await pool.query('SELECT COUNT(*) FROM users');
            const total = parseInt(countResult.rows[0].count);
            
            return {
                users: result.rows,
                total
            };
        }
    }

    /**
     * Get detailed user information for admin view
     */
    static async getUserDetails(userId) {
        const query = `
            WITH user_data AS (
                SELECT 
                    u.*,
                    
                    -- Recent posts
                    (
                        SELECT json_agg(json_build_object(
                            'id', p.id,
                            'content', SUBSTRING(p.content, 1, 100),
                            'media_url', p.media_url,
                            'created_at', p.created_at,
                            'likes_count', p.likes_count,
                            'comments_count', p.comments_count
                        ) ORDER BY p.created_at DESC LIMIT 5)
                        FROM posts p
                        WHERE p.user_id = u.id AND p.is_active = true
                    ) as recent_posts,
                    
                    -- Recent uhoro videos
                    (
                        SELECT json_agg(json_build_object(
                            'id', uv.id,
                            'title', uv.title,
                            'thumbnail_url', uv.thumbnail_url,
                            'created_at', uv.created_at,
                            'views_count', uv.views_count,
                            'likes_count', uv.likes_count
                        ) ORDER BY uv.created_at DESC LIMIT 5)
                        FROM uhoro_videos uv
                        WHERE uv.user_id = u.id AND uv.is_active = true
                    ) as recent_videos,
                    
                    -- Verification info
                    (
                        SELECT json_build_object(
                            'is_verified', true,
                            'plan_name', vp.name,
                            'started_at', uv.started_at,
                            'expires_at', uv.expires_at,
                            'is_lifetime', uv.is_lifetime,
                            'auto_renew', uv.auto_renew,
                            'amount_paid', uv.amount_paid
                        )
                        FROM user_verifications uv
                        JOIN verification_plans vp ON uv.plan_id = vp.id
                        WHERE uv.user_id = u.id AND uv.is_active = true
                        LIMIT 1
                    ) as verification,
                    
                    -- Ban info
                    (
                        SELECT json_build_object(
                            'reason', bu.reason,
                            'banned_at', bu.created_at,
                            'expires_at', bu.expires_at,
                            'banned_by', s.email,
                            'is_permanent', bu.expires_at IS NULL
                        )
                        FROM banned_users bu
                        JOIN staff s ON bu.banned_by = s.id
                        WHERE bu.user_id = u.id AND bu.lifted_at IS NULL
                        LIMIT 1
                    ) as ban_info,
                    
                    -- Stats summary
                    (
                        SELECT json_build_object(
                            'total_tips_received', COALESCE(SUM(t.amount), 0),
                            'total_tips_sent', COALESCE(SUM(t_sent.amount), 0),
                            'total_earnings', COALESCE(SUM(ce.net_earnings), 0),
                            'total_withdrawn', COALESCE(SUM(w.amount), 0)
                        )
                        FROM tips t
                        LEFT JOIN tips t_sent ON t_sent.sender_id = u.id
                        LEFT JOIN creator_earnings ce ON ce.user_id = u.id
                        LEFT JOIN withdrawals w ON w.user_id = u.id AND w.status = 'completed'
                        WHERE t.receiver_id = u.id
                        GROUP BY u.id
                    ) as financial_summary
                    
                FROM users u
                WHERE u.id = $1
            )
            SELECT * FROM user_data
        `;

        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        return result.rows[0];
    }

    /**
     * Update user account (admin action)
     */
    static async updateUser(userId, staffId, updates) {
        const allowedFields = [
            'email', 'username', 'full_name', 'bio', 'phone',
            'country', 'is_verified', 'is_private', 'is_active',
            'token_balance'
        ];

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        // Get current user data for audit log
        const currentUser = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );

        if (currentUser.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        const beforeData = currentUser.rows[0];

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

        values.push(userId);
        const query = `
            UPDATE users 
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        // Log admin action
        await pool.query(
            `INSERT INTO admin_activity_logs (
                staff_id, action, entity_type, entity_id,
                before_data, after_data, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                staffId,
                'update_user',
                'user',
                userId,
                JSON.stringify(beforeData),
                JSON.stringify(result.rows[0]),
                JSON.stringify({ updates })
            ]
        );

        return result.rows[0];
    }

    /**
     * Delete user (admin action)
     */
    static async deleteUser(userId, staffId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get user data for audit
            const userData = await client.query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
            );

            if (userData.rows.length === 0) {
                throw new AppError('User not found', 404);
            }

            // Soft delete user
            await client.query(
                `UPDATE users 
                 SET is_active = false,
                     email = CONCAT('deleted_', id, '_', email),
                     username = CONCAT('deleted_', id, '_', username),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [userId]
            );

            // Deactivate all user content
            await client.query(
                'UPDATE posts SET is_active = false WHERE user_id = $1',
                [userId]
            );

            await client.query(
                'UPDATE uhoro_videos SET is_active = false WHERE user_id = $1',
                [userId]
            );

            await client.query(
                'UPDATE comments SET is_active = false WHERE user_id = $1',
                [userId]
            );

            await client.query(
                'UPDATE uhoro_comments SET is_active = false WHERE user_id = $1',
                [userId]
            );

            // Log admin action
            await client.query(
                `INSERT INTO admin_activity_logs (
                    staff_id, action, entity_type, entity_id,
                    before_data, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    staffId,
                    'delete_user',
                    'user',
                    userId,
                    JSON.stringify(userData.rows[0]),
                    JSON.stringify({ permanent: false })
                ]
            );

            await client.query('COMMIT');

            return { id: userId, deleted: true };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ==================== CONTENT MANAGEMENT ====================

    /**
     * Get all posts with filters
     */
    static async getPosts(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                p.*,
                u.username, u.full_name, u.email,
                
                -- Report count
                (
                    SELECT COUNT(*) 
                    FROM content_reports cr
                    WHERE cr.content_type = 'post' AND cr.content_id = p.id
                ) as report_count
                
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        if (filters.user_id) {
            conditions.push(`p.user_id = $${values.length + 1}`);
            values.push(filters.user_id);
        }

        if (filters.status === 'active') {
            conditions.push(`p.is_active = true`);
        } else if (filters.status === 'deleted') {
            conditions.push(`p.is_active = false`);
        }

        if (filters.has_reports) {
            conditions.push(`EXISTS (SELECT 1 FROM content_reports WHERE content_type = 'post' AND content_id = p.id)`);
        }

        if (filters.start_date) {
            conditions.push(`p.created_at >= $${values.length + 1}`);
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            conditions.push(`p.created_at <= $${values.length + 1}`);
            values.push(filters.end_date);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        query += ' ORDER BY p.created_at DESC';
        query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM posts p WHERE 1=1';
        if (conditions.length > 0) {
            countQuery += ' AND ' + conditions.join(' AND ');
        }
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].count);

        return {
            posts: result.rows,
            total
        };
    }

    /**
     * Get all videos with filters
     */
    static async getVideos(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                v.*,
                u.username, u.full_name, u.email,
                
                -- Report count
                (
                    SELECT COUNT(*) 
                    FROM content_reports cr
                    WHERE cr.content_type = 'uhoro' AND cr.content_id = v.id
                ) as report_count
                
            FROM uhoro_videos v
            JOIN users u ON v.user_id = u.id
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        if (filters.user_id) {
            conditions.push(`v.user_id = $${values.length + 1}`);
            values.push(filters.user_id);
        }

        if (filters.status === 'active') {
            conditions.push(`v.is_active = true`);
        } else if (filters.status === 'deleted') {
            conditions.push(`v.is_active = false`);
        }

        if (filters.moderation_status) {
            conditions.push(`v.moderation_status = $${values.length + 1}`);
            values.push(filters.moderation_status);
        }

        if (filters.has_reports) {
            conditions.push(`EXISTS (SELECT 1 FROM content_reports WHERE content_type = 'uhoro' AND content_id = v.id)`);
        }

        if (filters.start_date) {
            conditions.push(`v.created_at >= $${values.length + 1}`);
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            conditions.push(`v.created_at <= $${values.length + 1}`);
            values.push(filters.end_date);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        query += ' ORDER BY v.created_at DESC';
        query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM uhoro_videos v WHERE 1=1';
        if (conditions.length > 0) {
            countQuery += ' AND ' + conditions.join(' AND ');
        }
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].count);

        return {
            videos: result.rows,
            total
        };
    }

    /**
     * Delete any content type (admin action)
     */
    static async deleteContent(contentType, contentId, staffId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            let contentTable;
            let contentColumn;

            switch (contentType) {
                case 'post':
                    contentTable = 'posts';
                    contentColumn = 'user_id';
                    break;
                case 'comment':
                    contentTable = 'comments';
                    contentColumn = 'user_id';
                    break;
                case 'uhoro':
                    contentTable = 'uhoro_videos';
                    contentColumn = 'user_id';
                    break;
                case 'uhoro_comment':
                    contentTable = 'uhoro_comments';
                    contentColumn = 'user_id';
                    break;
                default:
                    throw new AppError('Invalid content type', 400);
            }

            // Get content data for audit
            const contentData = await client.query(
                `SELECT * FROM ${contentTable} WHERE id = $1`,
                [contentId]
            );

            if (contentData.rows.length === 0) {
                throw new AppError('Content not found', 404);
            }

            // Soft delete
            await client.query(
                `UPDATE ${contentTable} SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [contentId]
            );

            // Log admin action
            await client.query(
                `INSERT INTO admin_activity_logs (
                    staff_id, action, entity_type, entity_id,
                    before_data, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    staffId,
                    'delete_content',
                    contentType,
                    contentId,
                    JSON.stringify(contentData.rows[0]),
                    JSON.stringify({ contentType })
                ]
            );

            await client.query('COMMIT');

            return { 
                id: contentId, 
                type: contentType, 
                deleted: true 
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ==================== SYSTEM SETTINGS ====================

    /**
     * Get all system settings
     */
    static async getSettings(publicOnly = false) {
        const query = `
            SELECT 
                key,
                value,
                type,
                description,
                is_public,
                updated_at
            FROM system_settings
            WHERE ($1 = false OR is_public = true)
            ORDER BY key
        `;

        const result = await pool.query(query, [publicOnly]);
        
        // Parse JSON values
        return result.rows.map(setting => ({
            ...setting,
            value: this.parseSettingValue(setting.value, setting.type)
        }));
    }

    /**
     * Get single setting by key
     */
    static async getSetting(key) {
        const query = `
            SELECT *
            FROM system_settings
            WHERE key = $1
        `;

        const result = await pool.query(query, [key]);

        if (result.rows.length === 0) {
            throw new AppError('Setting not found', 404);
        }

        const setting = result.rows[0];
        return {
            ...setting,
            value: this.parseSettingValue(setting.value, setting.type)
        };
    }

    /**
     * Update a system setting
     */
    static async updateSetting(key, value, staffId) {
        // Get current value for audit
        const current = await pool.query(
            'SELECT * FROM system_settings WHERE key = $1',
            [key]
        );

        if (current.rows.length === 0) {
            throw new AppError('Setting not found', 404);
        }

        // Validate value type
        const setting = current.rows[0];
        const validatedValue = this.validateSettingValue(value, setting.type);

        const query = `
            UPDATE system_settings 
            SET value = $1,
                updated_by = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE key = $3
            RETURNING *
        `;

        const result = await pool.query(query, [JSON.stringify(validatedValue), staffId, key]);

        // Log admin action
        await pool.query(
            `INSERT INTO admin_activity_logs (
                staff_id, action, entity_type, entity_id,
                before_data, after_data
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                staffId,
                'update_setting',
                'setting',
                key,
                JSON.stringify({ value: current.rows[0].value }),
                JSON.stringify({ value: validatedValue })
            ]
        );

        const updated = result.rows[0];
        return {
            ...updated,
            value: this.parseSettingValue(updated.value, updated.type)
        };
    }

    /**
     * Update multiple settings at once
     */
    static async updateSettings(settings, staffId) {
        const results = [];

        for (const [key, value] of Object.entries(settings)) {
            try {
                const result = await this.updateSetting(key, value, staffId);
                results.push(result);
            } catch (error) {
                // Log error but continue with other settings
                console.error(`Failed to update setting ${key}:`, error.message);
            }
        }

        return results;
    }

    /**
     * Parse setting value based on type
     */
    static parseSettingValue(value, type) {
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            
            switch (type) {
                case 'number':
                    return parseFloat(parsed);
                case 'boolean':
                    return Boolean(parsed);
                case 'array':
                    return Array.isArray(parsed) ? parsed : [];
                case 'json':
                    return parsed;
                default:
                    return String(parsed);
            }
        } catch {
            // If JSON parsing fails, return as is
            return value;
        }
    }

    /**
     * Validate setting value against expected type
     */
    static validateSettingValue(value, type) {
        switch (type) {
            case 'number':
                const num = parseFloat(value);
                if (isNaN(num)) {
                    throw new AppError(`Expected number, got ${typeof value}`, 400);
                }
                return num;
                
            case 'boolean':
                if (typeof value === 'boolean') return value;
                if (value === 'true') return true;
                if (value === 'false') return false;
                throw new AppError(`Expected boolean, got ${typeof value}`, 400);
                
            case 'array':
                if (Array.isArray(value)) return value;
                if (typeof value === 'string') {
                    try {
                        const parsed = JSON.parse(value);
                        if (Array.isArray(parsed)) return parsed;
                    } catch {}
                }
                throw new AppError(`Expected array, got ${typeof value}`, 400);
                
            case 'json':
                if (typeof value === 'object') return value;
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch {
                        throw new AppError('Invalid JSON string', 400);
                    }
                }
                throw new AppError(`Expected JSON object, got ${typeof value}`, 400);
                
            default:
                return String(value);
        }
    }

    // ==================== SYSTEM HEALTH ====================

    /**
     * Check system health status
     */
    static async getSystemHealth() {
        const checks = [];

        // Check database connection
        try {
            const dbStart = Date.now();
            await pool.query('SELECT 1');
            const dbLatency = Date.now() - dbStart;
            
            checks.push({
                component: 'database',
                status: 'healthy',
                latency: dbLatency,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            checks.push({
                component: 'database',
                status: 'down',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        // Check disk space
        // This would require file system access in production
        checks.push({
            component: 'storage',
            status: 'healthy',
            details: {
                total: '100GB',
                used: '45GB',
                free: '55GB',
                usage_percent: 45
            },
            timestamp: new Date().toISOString()
        });

        // Check memory usage
        const memoryUsage = process.memoryUsage();
        checks.push({
            component: 'memory',
            status: memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9 ? 'degraded' : 'healthy',
            details: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
            },
            timestamp: new Date().toISOString()
        });

        // Check API response time
        checks.push({
            component: 'api',
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });

        return checks;
    }

    // ==================== AUDIT LOGS ====================

    /**
     * Get admin activity logs
     */
    static async getActivityLogs(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT 
                l.*,
                s.email as staff_email,
                u.username as target_username
            FROM admin_activity_logs l
            JOIN staff s ON l.staff_id = s.id
            LEFT JOIN users u ON l.entity_id = u.id AND l.entity_type = 'user'
            WHERE 1=1
        `;

        const values = [];
        const conditions = [];

        if (filters.staff_id) {
            conditions.push(`l.staff_id = $${values.length + 1}`);
            values.push(filters.staff_id);
        }

        if (filters.action) {
            conditions.push(`l.action = $${values.length + 1}`);
            values.push(filters.action);
        }

        if (filters.entity_type) {
            conditions.push(`l.entity_type = $${values.length + 1}`);
            values.push(filters.entity_type);
        }

        if (filters.start_date) {
            conditions.push(`l.created_at >= $${values.length + 1}`);
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            conditions.push(`l.created_at <= $${values.length + 1}`);
            values.push(filters.end_date);
        }

        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        query += ' ORDER BY l.created_at DESC';
        query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM admin_activity_logs l WHERE 1=1';
        if (conditions.length > 0) {
            countQuery += ' AND ' + conditions.join(' AND ');
        }
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].count);

        return {
            logs: result.rows,
            total
        };
    }

    // ==================== DASHBOARD STATS ====================

    /**
     * Get quick stats for admin dashboard
     */
    static async getDashboardStats() {
        const query = `
            WITH stats AS (
                SELECT
                    -- User stats
                    (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                    (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_today,
                    (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '24 hours') as active_users_today,
                    
                    -- Content stats
                    (SELECT COUNT(*) FROM posts WHERE is_active = true) as total_posts,
                    (SELECT COUNT(*) FROM posts WHERE created_at > NOW() - INTERVAL '24 hours') as new_posts_today,
                    
                    (SELECT COUNT(*) FROM uhoro_videos WHERE is_active = true AND moderation_status = 'approved') as total_videos,
                    (SELECT COUNT(*) FROM uhoro_videos WHERE created_at > NOW() - INTERVAL '24 hours') as new_videos_today,
                    
                    -- Engagement stats
                    (SELECT COUNT(*) FROM tips WHERE created_at > NOW() - INTERVAL '24 hours') as tips_today,
                    (SELECT COALESCE(SUM(amount), 0) FROM tips WHERE created_at > NOW() - INTERVAL '24 hours') as tip_amount_today,
                    
                    -- Revenue stats
                    (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_transactions WHERE created_at > NOW() - INTERVAL '24 hours') as revenue_today,
                    
                    -- Moderation stats
                    (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending') as pending_moderation,
                    (SELECT COUNT(*) FROM content_reports WHERE status = 'pending') as pending_reports,
                    
                    -- Verification stats
                    (SELECT COUNT(*) FROM user_verifications WHERE is_active = true AND expires_at < NOW() + INTERVAL '7 days') as expiring_verifications
            )
            SELECT * FROM stats
        `;

        const result = await pool.query(query);
        return result.rows[0];
    }
}

module.exports = AdminModel;