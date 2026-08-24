// src/app.js (UPDATED VERSION WITH CORRECT PATHS)
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Import routes
const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const feedRoutes = require('./modules/feed/feed.routes');
const postRoutes = require('./modules/post/post.routes');
const commentRoutes = require('./modules/comment/comment.routes');
const likeRoutes = require('./modules/like/like.routes');
const bookmarkRoutes = require('./modules/bookmark/bookmark.routes');
const uhoroRoutes = require('./modules/uhoro/uhoro.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const callRoutes = require('./modules/call/call.routes');
const tokenRoutes = require('./modules/token/token.routes');  // ← Note: singular 'token'
const tipRoutes = require('./modules/tip/tip.routes');
const mpesaRoutes = require('./modules/mpesa/mpesa.routes');
const walletRoutes = require('./modules/wallet/wallet.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const verificationRoutes = require('./modules/verification/verification.routes');
const promotionRoutes = require('./modules/promotion/promotion.routes');
const commissionRoutes = require('./modules/commission/commission.routes');
const taxRoutes = require('./modules/tax/tax.routes');
const revenueRoutes = require('./modules/revenue/revenue.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const paymentRoutes = require('./modules/payments/payments.routes');
const userRoutes = require('./modules/user/user.routes');
const followRoutes = require('./modules/follow/follow.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const ruganoRoutes = require('./modules/rugano/rugano.routes');
const uploadRoutes = require('./modules/upload/upload.routes');

logger.info('✅ All route modules loaded successfully');

const app = express();

// =============================================
// Security Middleware
// =============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// =============================================
// CORS Configuration
// =============================================
app.use(cors({
  origin: config.isProduction
    ? (origin, callback) => callback(null, !origin || config.server.corsOrigin.includes(origin))
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// =============================================
// Body Parsing Middleware
// =============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());

// =============================================
// Logging Middleware
// =============================================
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// =============================================
// Rate Limiting
// =============================================
app.use(config.server.apiPrefix, apiLimiter);

// =============================================
// Static Files
// =============================================
app.use('/uploads', express.static('uploads'));

// =============================================
// Health Check Endpoint
// =============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    memory: process.memoryUsage(),
    database: 'connected'
  });
});

// =============================================
// API Routes - USING CORRECT PATHS
// =============================================
const apiPrefix = config.server.apiPrefix;

app.use(`${apiPrefix}/health`, healthRoutes);
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/follows`, followRoutes);
app.use(`${apiPrefix}/feed`, feedRoutes);
app.use(`${apiPrefix}/posts`, postRoutes);
app.use(`${apiPrefix}/posts/:postId/comments`, commentRoutes);
app.use(`${apiPrefix}/likes`, likeRoutes);
app.use(`${apiPrefix}/bookmarks`, bookmarkRoutes);
app.use(`${apiPrefix}/uhoro`, uhoroRoutes);
app.use(`${apiPrefix}/chat`, chatRoutes);
app.use(`${apiPrefix}/calls`, callRoutes);
app.use(`${apiPrefix}/token`, tokenRoutes);  // ← SINGULAR 'token'
app.use(`${apiPrefix}/tips`, tipRoutes);
app.use(`${apiPrefix}/mpesa`, mpesaRoutes);
app.use(`${apiPrefix}/wallet`, walletRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/verification`, verificationRoutes);
app.use(`${apiPrefix}/promotions`, promotionRoutes);
app.use(`${apiPrefix}/commission`, commissionRoutes);
app.use(`${apiPrefix}/tax`, taxRoutes);
app.use(`${apiPrefix}/revenue`, revenueRoutes);
app.use(`${apiPrefix}/reports`, reportsRoutes);
app.use(`${apiPrefix}/payments`, paymentRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/rugano`, ruganoRoutes);
app.use(`${apiPrefix}/upload`, uploadRoutes);

// Log all mounted routes
if (config.isDevelopment) {
  logger.info('📋 API Routes mounted:');
  logger.info(`   - ${apiPrefix}/health`);
  logger.info(`   - ${apiPrefix}/auth`);
  logger.info(`   - ${apiPrefix}/users`);
  logger.info(`   - ${apiPrefix}/follows`);
  logger.info(`   - ${apiPrefix}/feed`);
  logger.info(`   - ${apiPrefix}/posts`);
  logger.info(`   - ${apiPrefix}/likes`);
  logger.info(`   - ${apiPrefix}/bookmarks`);
  logger.info(`   - ${apiPrefix}/token`);     // ← Added to log
  logger.info(`   - ${apiPrefix}/wallet`);
  logger.info(`   - ${apiPrefix}/admin`);
}

// =============================================
// API Documentation
// =============================================
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('./docs/swagger.json');
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  logger.info('✅ Swagger documentation loaded successfully');
} catch (error) {
  logger.warn('⚠️ Swagger documentation not available');
}

// =============================================
// Test route
// =============================================
app.get(`${apiPrefix}`, (req, res) => {
  res.json({
    message: '🚀 Welcome to Rugano API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    status: 'operational',
    environment: config.env,
    timestamp: new Date().toISOString()
  });
});

// =============================================
// 404 Handler
// =============================================
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`,
    method: req.method,
    path: req.originalUrl
  });
});

// =============================================
// Error Handling Middleware
// =============================================
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(statusCode).json({
    status,
    message: err.message,
    ...(config.isDevelopment && { stack: err.stack })
  });
});

module.exports = app;