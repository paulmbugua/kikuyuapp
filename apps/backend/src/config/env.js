// src/config/env.js
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const backendEnvPath = path.resolve(__dirname, '../../.env');
const isProductionRuntime = process.env.NODE_ENV === 'production';
const envResult = dotenv.config({ path: backendEnvPath, override: !isProductionRuntime });

if (envResult.error && !isProductionRuntime) {
  throw new Error('Failed to load backend environment file at ' + backendEnvPath + ': ' + envResult.error.message);
}

// Required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_IMAGES',
  'R2_PUBLIC_BASE_URL_IMAGES',
  'R2_BUCKET_COVER',
  'R2_PUBLIC_BASE_URL_COVER'
];

// Check for missing required variables
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`❌ Missing required environment variable: ${envVar}`);
  }
});

const normalizeOrigin = (value, variableName) => {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.origin;
  } catch {
    throw new Error(`❌ ${variableName} contains an invalid HTTP(S) origin: ${value}`);
  }
};

const parseOriginList = (value, defaults, variableName) => {
  const entries = value ? value.split(',') : defaults;
  return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean).map((entry) => normalizeOrigin(entry, variableName)))];
};

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID_WEB;
if (!googleClientId) {
  throw new Error('❌ Missing required environment variable: GOOGLE_CLIENT_ID_WEB or GOOGLE_CLIENT_ID');
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('❌ Missing required environment variable: GOOGLE_CLIENT_SECRET');
}

const serverPort = parseInt(process.env.PORT) || 5000;
const apiPrefix = process.env.API_PREFIX || '/api/v1';
const isProduction = process.env.NODE_ENV === 'production';
const localBackendOrigin = `http://localhost:${serverPort}`;
const defaultFrontendOrigins = isProduction
  ? ['https://www.thutha.co.ke', 'https://thutha.co.ke']
  : ['http://localhost:8080', 'http://localhost:3000'];
const frontendOrigins = parseOriginList(process.env.FRONTEND_URL, defaultFrontendOrigins, 'FRONTEND_URL');
const corsOrigins = [...new Set([
  ...parseOriginList(process.env.CORS_ORIGIN, defaultFrontendOrigins, 'CORS_ORIGIN'),
  ...frontendOrigins
])];
const frontendOrigin = frontendOrigins[0];
const backendOrigin = parseOriginList(process.env.WEB_BACKEND_URL, [localBackendOrigin], 'WEB_BACKEND_URL')[0];

// Export validated config
module.exports = {
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test',

  server: {
    port: serverPort,
    apiPrefix,
    backendOrigin,
    corsOrigin: corsOrigins,
    sessionSecret: process.env.SESSION_SECRET || 'session-secret'
  },

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'kikuyuapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS) || 15000
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  googleOAuth: {
    clientId: googleClientId,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: isProduction
      ? (process.env.GOOGLE_CALLBACK_URL || `${backendOrigin}${apiPrefix}/auth/google/callback`)
      : `${localBackendOrigin}${apiPrefix}/auth/google/callback`,
    frontendOrigin,
    frontendOrigins,
    stateTtl: '10m'
  },

  r2: {
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION || 'auto',
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    buckets: {
      images: process.env.R2_BUCKET_IMAGES,
      cover: process.env.R2_BUCKET_COVER,
      videos: process.env.R2_BUCKET_VIDEOS
    },
    publicBaseUrls: {
      images: process.env.R2_PUBLIC_BASE_URL_IMAGES,
      cover: process.env.R2_PUBLIC_BASE_URL_COVER,
      previews: process.env.R2_PUBLIC_BASE_URL_PREVIEWS
    },
    maxImageBytes: parseInt(process.env.R2_MAX_IMAGE_BYTES) || 10 * 1024 * 1024
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

  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || (process.env.MAIL_FROM_NAME && process.env.MAIL_FROM_ADDRESS ? process.env.MAIL_FROM_NAME + ' <' + process.env.MAIL_FROM_ADDRESS + '>' : process.env.MAIL_FROM_ADDRESS || ''),
    replyTo: process.env.MAIL_REPLY_TO || process.env.SMTP_USER || ''
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs/app.log'
  }
};