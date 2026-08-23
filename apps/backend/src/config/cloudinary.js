// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const config = require('./env');

// Configure Cloudinary with timeout options
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
  timeout: 120000 // 120 seconds timeout for video uploads
});

// Test connection
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    return false;
  }
};

// Helper function to determine resource type from file or mimetype
const getResourceType = (filePath, mimetype) => {
  // Check by mimetype first
  if (mimetype) {
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('image/')) return 'image';
  }
  
  // Check by file extension
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.mpeg', '.mpg'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  if (videoExtensions.includes(ext)) return 'video';
  if (imageExtensions.includes(ext)) return 'image';
  
  return 'auto';
};

// Upload to Cloudinary with options
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }
    
    // Determine resource type from file path or provided options
    let resourceType = options.resource_type;
    if (!resourceType && options.mimetype) {
      resourceType = getResourceType(filePath, options.mimetype);
    } else if (!resourceType) {
      resourceType = getResourceType(filePath);
    }
    
    const uploadOptions = {
      folder: options.folder || config.cloudinary.folder,
      resource_type: resourceType,
      timeout: options.timeout || 120000, // 120 seconds timeout
    };
    
    // Add video-specific transformations
    if (resourceType === 'video') {
      uploadOptions.eager = [
        { quality: 'auto', fetch_format: 'auto' }
      ];
      uploadOptions.eager_async = true;
    }
    
    console.log('Uploading to Cloudinary:', {
      filePath,
      resourceType,
      options: uploadOptions
    });
    
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    
    console.log('Cloudinary upload result:', {
      public_id: result.public_id,
      resource_type: result.resource_type,
      duration: result.duration,
      format: result.format,
      bytes: result.bytes
    });
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      duration: result.duration,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('Cloudinary upload error details:', error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Delete from Cloudinary
const deleteFromCloudinary = async (publicId, options = {}) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, options);
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

// Get optimized URL
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    ...options
  });
};

module.exports = {
  cloudinary,
  testCloudinaryConnection,
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedUrl
};