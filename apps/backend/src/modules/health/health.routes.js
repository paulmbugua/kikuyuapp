// src/modules/health/health.routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../../config/db');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

router.get('/', (req, res) => {
  ResponseHandler.success(res, {
    status: 'OK',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  }, 'Service healthy');
});

// Detailed health check
router.get('/detailed', catchAsync(async (req, res) => {
  const startTime = Date.now();
  
  // Check database
  let dbStatus = 'disconnected';
  let dbLatency = null;
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    dbLatency = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  // Check memory
  const memoryUsage = process.memoryUsage();
  
  ResponseHandler.success(res, {
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    environment: process.env.NODE_ENV,
    database: {
      status: dbStatus,
      latency: dbLatency
    },
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
    },
    cpu: process.cpuUsage()
  });
}));

module.exports = router;