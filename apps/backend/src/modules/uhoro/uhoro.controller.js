// src/modules/uhoro/uhoro.controller.js
const UhoroModel = require('./uhoro.model');
const UhoroLikeModel = require('../uhoroLike/uhoroLike.model');
const UhoroViewModel = require('../uhoroView/uhoroView.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const { uploadImage, deleteImage } = require('../../config/r2');
const { validateUhoroVideo, generateThumbnail, extractMetadata } = require('../../utils/videoProcessor');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const fs = require('fs').promises;
const path = require('path');
const pool = require('../../config/db');

// Upload new video
const uploadVideo = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new AppError('Please upload a video file', 400);
    }

    const userId = req.user.id;
    const { title, description, allowsComments, allowsDuets, allowsStitches, isPrivate } = req.body;

    // Validate video for Uhoro format
    const validation = await validateUhoroVideo(req.file.path);
    
    // Generate thumbnail
    const thumbnailPath = path.join('uploads', `thumb_${Date.now()}.jpg`);
    await generateThumbnail(req.file.path, thumbnailPath);

    const metadata = await extractMetadata(req.file.path);

    // Upload video to Cloudinary
    const videoResult = await uploadToCloudinary(req.file.path, {
        folder: 'rugano/uhoro/videos',
        resource_type: 'video',
        transformation: [
            { width: 720, height: 1280, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
        ]
    });

    // Store the displayed thumbnail directly in Cloudflare R2.
    const thumbnailStat = await fs.stat(thumbnailPath);
    const thumbnailResult = await uploadImage({
        path: thumbnailPath,
        originalname: path.basename(thumbnailPath),
        mimetype: 'image/jpeg',
        size: thumbnailStat.size
    }, 'uhoro/thumbnails');

    // Clean up temporary files
    await fs.unlink(req.file.path).catch(console.error);
    await fs.unlink(thumbnailPath).catch(console.error);


    // Create video record
    const video = await UhoroModel.create(userId, {
        videoUrl: videoResult.url,
        videoPublicId: videoResult.publicId,
        thumbnailUrl: thumbnailResult.url,
        thumbnailPublicId: thumbnailResult.publicId,
        title,
        description,
        duration: validation.duration,
        width: validation.width,
        height: validation.height,
        fileSize: validation.fileSize,
        format: metadata.format,
        allowsComments: allowsComments !== 'false',
        allowsDuets: allowsDuets !== 'false',
        allowsStitches: allowsStitches !== 'false',
        isPrivate: isPrivate === 'true'
    }, metadata);

    ResponseHandler.created(res, { video }, 'Video uploaded successfully');
});

// Get video by ID
const getVideo = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const currentUserId = req.user?.id;

    const video = await UhoroModel.findById(videoId, currentUserId);

    if (!video) {
        throw new AppError('Video not found', 404);
    }

    // Check privacy settings
  // Check privacy settings
if (video.is_private && video.user_id !== currentUserId) {
    const isFollowing = await pool.query(
        "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted'",
        [currentUserId, video.user_id]
    );
    
    if (isFollowing.rows.length === 0 && !video.is_following) {
        throw new AppError('This video is private', 403);
    }
}

    ResponseHandler.success(res, { video });
});

// Get feed
const getFeed = catchAsync(async (req, res) => {
    const userId = req.user?.id;
    const { type = 'for-you', limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let videos;
    
    switch (type) {
        case 'following':
            if (!userId) throw new AppError('Authentication required for following feed', 401);
            videos = await UhoroModel.getFollowingFeed(userId, parseInt(limit), parseInt(offset));
            break;
        case 'popular':
            videos = await UhoroModel.getPopularFeed(parseInt(limit), parseInt(offset));
            break;
        case 'for-you':
        default:
            videos = await UhoroModel.getForYouFeed(userId, parseInt(limit), parseInt(offset));
    }

    ResponseHandler.paginated(res, videos, page, limit, null);
});

// Get user's videos
const getUserVideos = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const videos = await UhoroModel.findByUser(userId, currentUserId, parseInt(limit), parseInt(offset));

    // Get total count
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM uhoro_videos WHERE user_id = $1 AND is_active = true',
        [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    ResponseHandler.paginated(res, videos, page, limit, total);
});

// Update video
const updateVideo = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const video = await UhoroModel.update(videoId, userId, updates);

    ResponseHandler.success(res, { video }, 'Video updated successfully');
});

// Delete video
const deleteVideo = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;

    const result = await UhoroModel.delete(videoId, userId);

    // Delete from Cloudinary (background)
    if (result.video_public_id) {
        deleteFromCloudinary(result.video_public_id).catch(console.error);
    }
    if (result.thumbnail_public_id) {
        deleteImage(result.thumbnail_public_id).catch(console.error);
    }

    ResponseHandler.success(res, null, 'Video deleted successfully');
});

// Search videos
const searchVideos = catchAsync(async (req, res) => {
    const { q, userId, minLikes, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    if (!q && !userId) {
        throw new AppError('Search query or user ID is required', 400);
    }

    const filters = {
        userId,
        minLikes: minLikes ? parseInt(minLikes) : undefined
    };

    const videos = await UhoroModel.search(q, filters, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, videos, page, limit, null);
});

// Like video
const likeVideo = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;

    const result = await UhoroLikeModel.like(userId, videoId);

    ResponseHandler.success(res, result, 'Video liked successfully');
});

// Unlike video
const unlikeVideo = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;

    const result = await UhoroLikeModel.unlike(userId, videoId);

    ResponseHandler.success(res, result, 'Video unliked successfully');
});

// Get video likers
const getVideoLikers = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const likers = await UhoroLikeModel.getLikers(videoId, parseInt(limit), parseInt(offset));

    // Get total count
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM uhoro_likes WHERE video_id = $1',
        [videoId]
    );
    const total = parseInt(countResult.rows[0].count);

    ResponseHandler.paginated(res, likers, page, limit, total);
});

// Record an explicit share action
const shareVideo = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const result = await pool.query(
        `UPDATE uhoro_videos
         SET shares_count = shares_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND is_active = true
         RETURNING shares_count`,
        [videoId]
    );
    if (!result.rows[0]) throw new AppError('Video not found', 404);
    ResponseHandler.success(res, { shares_count: result.rows[0].shares_count }, 'Video share recorded');
});

// Record video view
const recordView = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user?.id;
    const { watchDuration, watchedPercentage, completed } = req.body;

    // Validate watch data
    if (watchDuration === undefined || watchedPercentage === undefined) {
        throw new AppError('Watch duration and percentage are required', 400);
    }

    await UhoroViewModel.recordView(videoId, userId, {
        watchDuration,
        watchedPercentage,
        completed: completed || false
    });

    ResponseHandler.success(res, null, 'View recorded');
});

// Get trending hashtags
const getTrendingHashtags = catchAsync(async (req, res) => {
    const { limit = 20 } = req.query;

    const hashtags = await UhoroModel.getTrendingHashtags(parseInt(limit));

    ResponseHandler.success(res, { hashtags });
});

// Get videos by hashtag
const getVideosByHashtag = catchAsync(async (req, res) => {
    const { hashtag } = req.params;
    const userId = req.user?.id;
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const videos = await UhoroModel.findByHashtag(hashtag, userId, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, videos, page, limit, null);
});

// Get video analytics
const getVideoAnalytics = catchAsync(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;

    const analytics = await UhoroModel.getAnalytics(videoId, userId);

    ResponseHandler.success(res, { analytics });
});

// Get user's watch history
const getWatchHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const history = await UhoroViewModel.getUserHistory(userId, parseInt(limit), parseInt(offset));

    ResponseHandler.paginated(res, history, page, limit, null);
});

// Get user's watch time stats
const getWatchTimeStats = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const stats = await UhoroViewModel.getUserTotalWatchTime(userId);

    ResponseHandler.success(res, { stats });
});

module.exports = {
    uploadVideo,
    getVideo,
    getFeed,
    getUserVideos,
    updateVideo,
    deleteVideo,
    searchVideos,
    likeVideo,
    unlikeVideo,
    getVideoLikers,
    recordView,
    shareVideo,
    getTrendingHashtags,
    getVideosByHashtag,
    getVideoAnalytics,
    getWatchHistory,
    getWatchTimeStats
};