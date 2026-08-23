// src/modules/post/post.controller.js
const PostModel = require('./post.model');
const LikeModel = require('../like/like.model');
const BookmarkModel = require('../bookmark/bookmark.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const { validatePostContent, moderateContent } = require('../../utils/contentModeration');
const fs = require('fs').promises;
const pool = require('../../config/db');
const NotificationModel = require('../notification/notification.model');

// Create a new post
const createPost = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { content } = req.body;
  
  // DEBUG: Log what we received
  console.log('=== POST CREATION DEBUG ===');
  console.log('Content:', content);
  console.log('Has file?', !!req.file);
  if (req.file) {
    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });
  }
  
  // Validate content if provided
  if (content) {
    const validation = validatePostContent(content);
    if (!validation.isValid) {
      // Clean up file if exists
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      throw new AppError(validation.reason, 400);
    }
    
    // Moderate content
    const moderation = moderateContent(content);
    if (!moderation.isClean) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      throw new AppError(`Content moderation failed: ${moderation.issues.join(', ')}`, 400);
    }
  }
  
  // Handle media upload if file exists
  let mediaData = null;
  if (req.file) {
    try {
      const folder = content ? 'rugano/posts' : 'rugano/posts/media';
      
      console.log('Uploading to Cloudinary from path:', req.file.path);
      console.log('File mimetype:', req.file.mimetype);
      
      // Determine resource type based on mimetype
      const isVideo = req.file.mimetype.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';
      
      // Set upload options based on file type
      const uploadOptions = {
        folder,
        resource_type: resourceType,
        timeout: 120000, // 2 minutes for videos
        mimetype: req.file.mimetype // Pass mimetype for detection
      };
      
      // For videos, add eager transformations
      if (isVideo) {
        uploadOptions.eager = [
          { quality: 'auto', fetch_format: 'auto' }
        ];
        uploadOptions.eager_async = true;
      }
      
      mediaData = await uploadToCloudinary(req.file.path, uploadOptions);
      
      console.log('Upload successful:', {
        url: mediaData.url,
        resourceType: mediaData.resourceType,
        bytes: mediaData.bytes,
        duration: mediaData.duration
      });
      
      // Delete temporary file
      await fs.unlink(req.file.path).catch(console.error);
    } catch (uploadError) {
      console.error('Upload error details:', uploadError);
      // Delete temporary file even if upload fails
      await fs.unlink(req.file.path).catch(console.error);
      throw new AppError(`Media upload failed: ${uploadError.message}. Please try with a smaller video or check your connection.`, 400);
    }
  }
  
  // Ensure either content or media is provided
  if (!content && !mediaData) {
    throw new AppError('Post must contain either text or media', 400);
  }
  
  const post = await PostModel.create(userId, { content }, mediaData);
  
  // Send notifications to followers
  try {
    const followers = await pool.query(
      `SELECT follower_id FROM follows WHERE following_id = $1 AND status = 'accepted'`,
      [userId]
    );
    
    if (followers.rows.length > 0) {
      const actorResult = await pool.query(
        'SELECT username, full_name, avatar_url FROM users WHERE id = $1',
        [userId]
      );
      
      if (actorResult.rows.length > 0) {
        const actor = actorResult.rows[0];
        const truncatedContent = content && content.length > 100 
          ? content.substring(0, 100) + '...' 
          : content || 'New post with media';
        
        const notificationPromises = followers.rows.map(follower => 
          NotificationModel.create({
            userId: follower.follower_id,
            type: 'new_post',
            actorId: userId,
            actorName: actor.full_name || actor.username,
            actorAvatarUrl: actor.avatar_url,
            content: `${actor.full_name || actor.username} created a new post: ${truncatedContent}`,
            referenceId: post.id,
            referenceType: 'post'
          })
        );
        
        Promise.all(notificationPromises).catch(console.error);
      }
    }
  } catch (err) {
    console.error('Error sending follower notifications:', err.message);
  }
  
  ResponseHandler.created(res, { post }, 'Post created successfully');
});

// Rest of the controller remains unchanged...
const getPost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const currentUserId = req.user?.id;
  
  const post = await PostModel.findById(postId, currentUserId);
  
  if (!post) {
    throw new AppError('Post not found', 404);
  }
  
  ResponseHandler.success(res, { post });
});

const getUserPosts = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user?.id;
  const { limit = 20, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const posts = await PostModel.findByUser(userId, currentUserId, parseInt(limit), parseInt(offset));
  
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM posts WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);
  
  ResponseHandler.paginated(res, posts, page, limit, total);
});

const updatePost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const { content } = req.body;
  
  if (!content) {
    throw new AppError('Content is required for update', 400);
  }
  
  const validation = validatePostContent(content);
  if (!validation.isValid) {
    throw new AppError(validation.reason, 400);
  }
  
  const moderation = moderateContent(content);
  if (!moderation.isClean) {
    throw new AppError(`Content moderation failed: ${moderation.issues.join(', ')}`, 400);
  }
  
  const post = await PostModel.update(postId, userId, { content });
  
  ResponseHandler.success(res, { post }, 'Post updated successfully');
});

const deletePost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  const post = await PostModel.findById(postId);
  
  if (post && post.media_public_id) {
    deleteFromCloudinary(post.media_public_id).catch(console.error);
  }
  
  await PostModel.delete(postId, userId);
  
  ResponseHandler.success(res, null, 'Post deleted successfully');
});

const getFeed = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit = 20, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const posts = await PostModel.getFeed(userId, parseInt(limit), parseInt(offset));
  
  ResponseHandler.paginated(res, posts, page, limit, null);
});

const getExploreFeed = catchAsync(async (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  const offset = (page - 1) * limit;
  
  const posts = await PostModel.getPopularPosts(parseInt(limit), parseInt(offset));
  
  ResponseHandler.paginated(res, posts, page, limit, null);
});

const getPostsByHashtag = catchAsync(async (req, res) => {
  const { hashtag } = req.params;
  const currentUserId = req.user?.id;
  const { limit = 20, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const posts = await PostModel.findByHashtag(hashtag, currentUserId, parseInt(limit), parseInt(offset));
  
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

const getTrendingHashtags = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const hashtags = await PostModel.getTrendingHashtags(parseInt(limit));
  
  ResponseHandler.success(res, { hashtags });
});

const pinPost = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  await PostModel.togglePin(postId, userId);
  
  ResponseHandler.success(res, null, 'Post pinned successfully');
});

// Track post view
const trackView = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  // Check if user already viewed this post (optional - to prevent duplicate counting)
  const existingView = await pool.query(
    'SELECT id FROM post_views WHERE post_id = $1 AND user_id = $2',
    [postId, userId]
  );
  
  if (existingView.rows.length === 0) {
    // Insert view record
    await pool.query(
      'INSERT INTO post_views (post_id, user_id) VALUES ($1, $2)',
      [postId, userId]
    );
    
    // Increment view count on post
    await pool.query(
      'UPDATE posts SET views_count = views_count + 1 WHERE id = $1',
      [postId]
    );
  }
  
  ResponseHandler.success(res, { viewed: true }, 'View tracked');
});

module.exports = {
  createPost,
  getPost,
  getUserPosts,
  updatePost,
  deletePost,
  getFeed,
  getExploreFeed,
  getPostsByHashtag,
  getTrendingHashtags,
  pinPost,
  trackView,
};