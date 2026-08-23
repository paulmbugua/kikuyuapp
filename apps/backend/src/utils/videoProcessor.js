// src/utils/videoProcessor.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { AppError } = require('../middleware/errorMiddleware');

// Promisify ffmpeg methods
const getVideoMetadata = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
        });
    });
};

// Validate video for Uhoro (vertical format)
const validateUhoroVideo = async (filePath) => {
    try {
        const metadata = await getVideoMetadata(filePath);
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        
        if (!videoStream) {
            throw new AppError('No video stream found', 400);
        }
        
        const { width, height, duration, codec_name } = videoStream;
        
        // Check if video is vertical (height > width)
        if (height < width) {
            throw new AppError('Video must be in vertical format (portrait mode)', 400);
        }
        
        // Check aspect ratio (should be close to 9:16)
        const aspectRatio = width / height;
        if (aspectRatio < 0.5 || aspectRatio > 0.6) {
            throw new AppError('Video must have 9:16 aspect ratio', 400);
        }
        
        // Check duration (max 60 seconds for short videos)
        if (duration > 60) {
            throw new AppError('Video duration cannot exceed 60 seconds', 400);
        }
        
        // Check minimum duration
        if (duration < 3) {
            throw new AppError('Video must be at least 3 seconds long', 400);
        }
        
        // Check file size (max 50MB for short videos)
        const stats = await fs.stat(filePath);
        if (stats.size > 50 * 1024 * 1024) {
            throw new AppError('Video size cannot exceed 50MB', 400);
        }
        
        return {
            width,
            height,
            duration,
            codec: codec_name,
            aspectRatio,
            fileSize: stats.size
        };
        
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Video validation failed: ${error.message}`, 400);
    }
};

// Generate thumbnail from video
const generateThumbnail = (inputPath, outputPath, timestamp = '00:00:01') => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: [timestamp],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '720x1280'
            })
            .on('end', () => resolve(outputPath))
            .on('error', reject);
    });
};

// Compress video for optimal streaming
const compressVideo = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .size('720x1280')
            .autopad()
            .aspect('9:16')
            .videoBitrate('2000k')
            .audioBitrate('128k')
            .fps(30)
            .outputOptions([
                '-movflags +faststart',
                '-preset medium',
                '-crf 23'
            ])
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .save(outputPath);
    });
};

// Extract video metadata
const extractMetadata = async (filePath) => {
    try {
        const metadata = await getVideoMetadata(filePath);
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        const stats = await fs.stat(filePath);
        
        return {
            duration: videoStream?.duration || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            codec: videoStream?.codec_name,
            fps: eval(videoStream?.avg_frame_rate) || 0,
            bitrate: videoStream?.bit_rate || 0,
            audioCodec: audioStream?.codec_name,
            audioBitrate: audioStream?.bit_rate || 0,
            fileSize: stats.size,
            format: metadata.format.format_name
        };
    } catch (error) {
        throw new AppError(`Failed to extract metadata: ${error.message}`, 400);
    }
};

// Create video variants (for future adaptive streaming)
const createVideoVariants = async (inputPath, outputDir) => {
    const variants = [
        { resolution: '480x854', bitrate: '800k', suffix: '480p' },
        { resolution: '720x1280', bitrate: '2000k', suffix: '720p' },
        { resolution: '1080x1920', bitrate: '4000k', suffix: '1080p' }
    ];
    
    const promises = variants.map(variant => {
        const outputPath = path.join(outputDir, `uhoro_${variant.suffix}.mp4`);
        
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .size(variant.resolution)
                .videoBitrate(variant.bitrate)
                .autopad()
                .aspect('9:16')
                .on('end', () => resolve({ ...variant, path: outputPath }))
                .on('error', reject)
                .save(outputPath);
        });
    });
    
    return Promise.all(promises);
};

module.exports = {
    validateUhoroVideo,
    generateThumbnail,
    compressVideo,
    extractMetadata,
    createVideoVariants,
    getVideoMetadata
};