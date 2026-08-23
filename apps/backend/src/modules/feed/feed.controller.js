// src/modules/feed/feed.controller.js
const FeedModel = require('./feed.model');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');

// Get personalized feed for authenticated user - shows own posts, followed users, and public posts
const getFeed = catchAsync(async (req, res) => {
    const userId = req.user?.id;
    console.log('🔍 Feed request - userId:', userId);
    
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let posts;
    let total;

    if (userId) {
        posts = await FeedModel.getFeed(userId, parseInt(limit), parseInt(offset));
        console.log('🔍 Posts found:', posts.length);
        
        if (posts.length === 0) {
            // Debug: Check if there are any posts at all
            const allPosts = await pool.query('SELECT COUNT(*) FROM posts WHERE is_active = true');
            console.log('🔍 Total active posts in DB:', allPosts.rows[0].count);
            
            // Check user's own posts
            const userPosts = await pool.query('SELECT COUNT(*) FROM posts WHERE user_id = $1 AND is_active = true', [userId]);
            console.log('🔍 User\'s own posts:', userPosts.rows[0].count);
        }
        
        total = posts.length;
    } else {
        posts = await FeedModel.getPublicFeed(parseInt(limit), parseInt(offset));
        total = posts.length;
    }

    ResponseHandler.paginated(res, posts, page, limit, total);
});

// Get recommended posts based on user interests
const getRecommended = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const recommendations = await FeedModel.getRecommendedPosts(userId, parseInt(limit));

    ResponseHandler.success(res, { recommendations });
});

// Get feed by specific category/hashtag
const getFeedByHashtag = catchAsync(async (req, res) => {
    const { hashtag } = req.params;
    const userId = req.user?.id;
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const posts = await FeedModel.getPostsByHashtag(hashtag, userId, parseInt(limit), parseInt(offset));

    // Get total count
    const countResult = await pool.query(
        `SELECT COUNT(*) 
         FROM post_hashtags ph
         JOIN hashtags h ON ph.hashtag_id = h.id
         WHERE h.name = $1`,
        [hashtag.toLowerCase()]
    );
    const total = parseInt(countResult.rows[0].count);

    ResponseHandler.paginated(res, posts, page, limit, total);
});

// Get feed from followed users only
const getFollowingFeed = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const posts = await FeedModel.getFollowingFeed(userId, parseInt(limit), parseInt(offset));

    // Get total count of followed users' posts
    const countResult = await pool.query(
        `SELECT COUNT(*) FROM posts p
         WHERE p.is_active = true 
         AND EXISTS (
           SELECT 1 FROM follows 
           WHERE follower_id = $1 AND following_id = p.user_id AND status = 'accepted'
         )`,
        [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    ResponseHandler.paginated(res, posts, page, limit, total);
});

// Get trending posts (most engaged from last 7 days)
const getTrendingFeed = catchAsync(async (req, res) => {
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const posts = await FeedModel.getTrendingPosts(parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, posts, page, limit, null);
});

// Get latest posts (most recent)
const getLatestFeed = catchAsync(async (req, res) => {
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const posts = await FeedModel.getLatestPosts(parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, posts, page, limit, null);
});

// Get user's own posts
const getMyPosts = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            p.id, p.content, p.media_url, p.media_type, p.created_at,
            p.user_id, p.likes_count, p.comments_count,
            u.username, u.full_name, u.avatar_url, u.is_verified,
            EXISTS(
                SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id
            ) as is_liked,
            EXISTS(
                SELECT 1 FROM bookmarks WHERE user_id = $1 AND post_id = p.id
            ) as is_bookmarked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = $1 AND p.is_active = true
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    
    ResponseHandler.paginated(res, result.rows, page, limit, null);
});

module.exports = {
    getFeed,
    getRecommended,
    getFeedByHashtag,
    getFollowingFeed,
    getTrendingFeed,
    getLatestFeed,
    getMyPosts
};