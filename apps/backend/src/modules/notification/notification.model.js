const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');

class NotificationModel {
    // Create a notification
   static async create(notificationData) {
    const {
        userId,
        type,
        actorId,
        actorName,
        actorAvatarUrl,
        content,
        referenceId,
        referenceType,
        metadata
    } = notificationData;

    // Check if metadata column exists and handle accordingly
    let query = `
        INSERT INTO notifications (
            user_id, type, actor_id, actor_name, actor_avatar_url,
            content, reference_id, reference_type, is_read, created_at, updated_at
    `;
    
    let values = [
        userId, type, actorId, actorName, actorAvatarUrl,
        content, referenceId, referenceType, false, new Date(), new Date()
    ];
    
    let paramCount = 11;
    
    // Add metadata if provided
    if (metadata) {
        query += `, metadata`;
        values.push(metadata);
        paramCount++;
    }
    
    query += `) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11`;
    
    if (metadata) {
        query += `, $${paramCount}`;
    }
    
    query += `) RETURNING *`;

    const result = await pool.query(query, values);
    return result.rows[0];
}

    // Get user's notifications with pagination
   static async getUserNotifications(userId, limit = 50, offset = 0, filter = 'all') {
    let query = `
        SELECT 
            n.*,
            CASE 
                WHEN n.type = 'like' THEN 'liked your post'
                WHEN n.type = 'comment' THEN 'commented on your post'
                WHEN n.type = 'follow' THEN 'started following you'
                WHEN n.type = 'tip' THEN 'sent you a tip'
                WHEN n.type = 'verified' THEN 'Your account has been verified'
                WHEN n.type = 'mention' THEN 'mentioned you in a post'
                WHEN n.type = 'repost' THEN 'reposted your post'
                WHEN n.type = 'new_post' THEN 'created a new post'
                WHEN n.type = 'new_message' THEN 'sent you a message'
                WHEN n.type = 'new_group_message' THEN 'sent a message in group'
                WHEN n.type = 'comment_reply' THEN 'replied to your comment'
                WHEN n.type = 'message_reaction' THEN 'reacted to your message'
                WHEN n.type = 'added_to_group' THEN 'added you to a group'
                ELSE n.content
            END as message
        FROM notifications n
        WHERE n.user_id = $1
    `;

    const values = [userId];
    let paramCount = 2;

    if (filter !== 'all') {
        query += ` AND n.type = $${paramCount}`;
        values.push(filter);
        paramCount++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
    const countValues = [userId];
    
    if (filter !== 'all') {
        countQuery += ' AND type = $2';
        countValues.push(filter);
    }

    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].count);

    // Get unread count
    const unreadResult = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
    );
    const unreadCount = parseInt(unreadResult.rows[0].count);

    return {
        notifications: result.rows,
        total,
        unreadCount,
        hasMore: offset + limit < total
    };
}

    // Get unread count only
    static async getUnreadCount(userId) {
        const result = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
            [userId]
        );
        return parseInt(result.rows[0].count);
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        const query = `
            UPDATE notifications 
            SET is_read = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [notificationId, userId]);

        if (result.rows.length === 0) {
            throw new AppError('Notification not found', 404);
        }

        return result.rows[0];
    }

    // Mark all notifications as read
    static async markAllAsRead(userId) {
        const query = `
            UPDATE notifications 
            SET is_read = true, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = false
            RETURNING *
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    // Delete notification
    static async deleteNotification(notificationId, userId) {
        const query = `
            DELETE FROM notifications 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;

        const result = await pool.query(query, [notificationId, userId]);

        if (result.rows.length === 0) {
            throw new AppError('Notification not found', 404);
        }

        return result.rows[0];
    }

    // Delete all notifications for a user
    static async deleteAllNotifications(userId) {
        const query = 'DELETE FROM notifications WHERE user_id = $1 RETURNING id';
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    // Create notification for like
    static async createLikeNotification(actorId, postId, postOwnerId) {
        // Get actor details
        const actorResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [actorId]
        );

        if (actorResult.rows.length === 0) return null;

        const actor = actorResult.rows[0];

        return this.create({
            userId: postOwnerId,
            type: 'like',
            actorId: actorId,
            actorName: actor.full_name || actor.username,
            actorAvatarUrl: actor.avatar_url,
            content: `${actor.full_name || actor.username} liked your post`,
            referenceId: postId,
            referenceType: 'post'
        });
    }

    // Create notification for comment
    static async createCommentNotification(actorId, postId, postOwnerId, commentContent) {
        const actorResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [actorId]
        );

        if (actorResult.rows.length === 0) return null;

        const actor = actorResult.rows[0];
        const truncatedComment = commentContent.length > 50 
            ? commentContent.substring(0, 50) + '...' 
            : commentContent;

        return this.create({
            userId: postOwnerId,
            type: 'comment',
            actorId: actorId,
            actorName: actor.full_name || actor.username,
            actorAvatarUrl: actor.avatar_url,
            content: `${actor.full_name || actor.username} commented: "${truncatedComment}"`,
            referenceId: postId,
            referenceType: 'post'
        });
    }

    // Create notification for follow
    static async createFollowNotification(actorId, followerId) {
        const actorResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [actorId]
        );

        if (actorResult.rows.length === 0) return null;

        const actor = actorResult.rows[0];

        return this.create({
            userId: followerId,
            type: 'follow',
            actorId: actorId,
            actorName: actor.full_name || actor.username,
            actorAvatarUrl: actor.avatar_url,
            content: `${actor.full_name || actor.username} started following you`,
            referenceId: actorId,
            referenceType: 'user'
        });
    }

    // Create notification for tip
    static async createTipNotification(actorId, receiverId, amount) {
        const actorResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [actorId]
        );

        if (actorResult.rows.length === 0) return null;

        const actor = actorResult.rows[0];

        return this.create({
            userId: receiverId,
            type: 'tip',
            actorId: actorId,
            actorName: actor.full_name || actor.username,
            actorAvatarUrl: actor.avatar_url,
            content: `${actor.full_name || actor.username} sent you ${amount} tokens`,
            referenceId: actorId,
            referenceType: 'tip'
        });
    }

    // Create notification for verification
    static async createVerificationNotification(userId) {
        return this.create({
            userId: userId,
            type: 'verified',
            actorId: null,
            actorName: 'Thutha',
            actorAvatarUrl: null,
            content: 'Your account has been verified!',
            referenceId: userId,
            referenceType: 'user'
        });
    }

    // Create notification for mention
    static async createMentionNotification(actorId, postId, mentionedUserId) {
        const actorResult = await pool.query(
            'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
            [actorId]
        );

        if (actorResult.rows.length === 0) return null;

        const actor = actorResult.rows[0];

        return this.create({
            userId: mentionedUserId,
            type: 'mention',
            actorId: actorId,
            actorName: actor.full_name || actor.username,
            actorAvatarUrl: actor.avatar_url,
            content: `${actor.full_name || actor.username} mentioned you in a post`,
            referenceId: postId,
            referenceType: 'post'
        });
    }

    // Get notification stats
    static async getStats(userId) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN type = 'like' THEN 1 END) as likes,
                COUNT(CASE WHEN type = 'comment' THEN 1 END) as comments,
                COUNT(CASE WHEN type = 'follow' THEN 1 END) as follows,
                COUNT(CASE WHEN type = 'tip' THEN 1 END) as tips,
                COUNT(CASE WHEN type = 'mention' THEN 1 END) as mentions,
                COUNT(CASE WHEN is_read = false THEN 1 END) as unread
            FROM notifications
            WHERE user_id = $1
        `, [userId]);

        return result.rows[0];
    }
    // Add to your NotificationModel class

// Create notification for new post (for followers)
static async createNewPostNotification(actorId, postId, followerId, postContent) {
    const actorResult = await pool.query(
        'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
        [actorId]
    );

    if (actorResult.rows.length === 0) return null;

    const actor = actorResult.rows[0];
    const truncatedContent = postContent && postContent.length > 100 
        ? postContent.substring(0, 100) + '...' 
        : postContent || 'New post with media';

    return this.create({
        userId: followerId,
        type: 'new_post',
        actorId: actorId,
        actorName: actor.full_name || actor.username,
        actorAvatarUrl: actor.avatar_url,
        content: `${actor.full_name || actor.username} created a new post: ${truncatedContent}`,
        referenceId: postId,
        referenceType: 'post'
    });
}

// Create notification for comment reply
static async createCommentReplyNotification(actorId, parentCommentId, parentCommentOwnerId, replyContent) {
    const actorResult = await pool.query(
        'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
        [actorId]
    );

    if (actorResult.rows.length === 0) return null;

    const actor = actorResult.rows[0];
    const truncatedReply = replyContent.length > 50 
        ? replyContent.substring(0, 50) + '...' 
        : replyContent;

    return this.create({
        userId: parentCommentOwnerId,
        type: 'comment_reply',
        actorId: actorId,
        actorName: actor.full_name || actor.username,
        actorAvatarUrl: actor.avatar_url,
        content: `${actor.full_name || actor.username} replied to your comment: "${truncatedReply}"`,
        referenceId: parentCommentId,
        referenceType: 'comment'
    });
}

// Create bulk notifications for followers
static async createBulkNewPostNotifications(actorId, postId, followerIds, postContent) {
    if (!followerIds || followerIds.length === 0) return [];
    
    const actorResult = await pool.query(
        'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
        [actorId]
    );

    if (actorResult.rows.length === 0) return [];

    const actor = actorResult.rows[0];
    const truncatedContent = postContent && postContent.length > 100 
        ? postContent.substring(0, 100) + '...' 
        : postContent || 'New post with media';

    // Create notifications for all followers in one query (more efficient)
    const values = [];
    const placeholders = [];
    
    followerIds.forEach((followerId, index) => {
        const offset = index * 8;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
        values.push(
            followerId,
            'new_post',
            actorId,
            actor.full_name || actor.username,
            actor.avatar_url,
            `${actor.full_name || actor.username} created a new post: ${truncatedContent}`,
            postId,
            'post'
        );
    });

    const query = `
        INSERT INTO notifications (
            user_id, type, actor_id, actor_name, actor_avatar_url,
            content, reference_id, reference_type
        ) VALUES ${placeholders.join(', ')}
        RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows;
}
}

module.exports = NotificationModel;