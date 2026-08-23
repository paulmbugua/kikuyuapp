// src/config/env.js
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Required environment variables
const requiredEnvVars = [
  'DB_URL',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

// Check for missing required variables
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`❌ Missing required environment variable: ${envVar}`);
  }
});

// Parse CORS origins
const parseCorsOrigin = () => {
  const origins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
  return origins.map(origin => origin.trim());
};

// Export validated config
module.exports = {
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  
  server: {
    port: parseInt(process.env.PORT) || 5000,
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    corsOrigin: parseCorsOrigin(),
    sessionSecret: process.env.SESSION_SECRET || 'session-secret'
  },
  
  database: {
    url: process.env.DB_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'rugano_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }
  },
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.NODE_ENV === 'production' ? 'rugano/prod' : 'rugano/dev'
  },
  
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    shortCode: process.env.MPESA_SHORTCODE,
    businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
    callbackUrl: process.env.MPESA_CALLBACK_URL
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE) || 5 * 1024 * 1024,
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE) || 10 * 1024 * 1024,
    allowedImageTypes: process.env.ALLOWED_IMAGE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    allowedVideoTypes: process.env.ALLOWED_VIDEO_TYPES?.split(',') || [
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]
  },
  
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs/app.log'
  }
};