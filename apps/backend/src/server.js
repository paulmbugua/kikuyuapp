// src/server.js
const app = require('./app');
const config = require('./config/env');
const { testConnection } = require('./config/db');
const { runMigrations } = require('./config/databaseSetup');
const { testCloudinaryConnection } = require('./config/cloudinary');
const { initializeSocket } = require('./socket');
const { setupDailyJobs } = require('./cron/jobs');
const logger = require('./utils/logger');

let server;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    await runMigrations();
    
    // Test Cloudinary connection
    await testCloudinaryConnection();
    
    // Start listening
    server = app.listen(config.server.port, () => {
      logger.info(`
      ╔══════════════════════════════════════════════════════════╗
      ║                                                          ║
      ║   🚀 Rugano Backend Server Started Successfully!         ║
      ║                                                          ║
      ║   Environment: ${config.env.padEnd(28)} ║
      ║   Port: ${config.server.port.toString().padEnd(35)} ║
      ║   API Prefix: ${config.server.apiPrefix.padEnd(29)} ║
      ║   Database: Connected                                    ║
      ║   Cloudinary: Connected                                  ║
      ║                                                          ║
      ║   Server is running on:                                  ║
      ║   http://localhost:${config.server.port}${config.server.apiPrefix}          ║
      ║                                                          ║
      ╚══════════════════════════════════════════════════════════╝
      `);
    });

    // ✅ Initialize Socket.IO
    const io = initializeSocket(server);
    app.set('io', io);
    logger.info('🔌 Socket.IO initialized');

    // ✅ Setup cron jobs (only in production)
    if (config.isProduction) {
      setupDailyJobs();
      logger.info('📅 Cron jobs scheduled');
    }

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down server...');
  
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    
    setTimeout(() => {
      logger.error('Forced shutdown');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
startServer();