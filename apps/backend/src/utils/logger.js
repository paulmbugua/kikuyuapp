// src/utils/logger.js
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

// Ensure log directory exists
const logDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Simple logger implementation
const logger = {
  info: (message) => {
    const logEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message
    };
    console.log(JSON.stringify(logEntry));
    
    if (config.isProduction) {
      fs.appendFileSync(config.logging.filePath, JSON.stringify(logEntry) + '\n');
    }
  },
  
  error: (message) => {
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message: message.message || message,
      stack: message.stack
    };
    console.error(JSON.stringify(logEntry));
    
    if (config.isProduction) {
      fs.appendFileSync(config.logging.filePath, JSON.stringify(logEntry) + '\n');
    }
  },
  
  warn: (message) => {
    const logEntry = {
      level: 'warn',
      timestamp: new Date().toISOString(),
      message
    };
    console.warn(JSON.stringify(logEntry));
  },
  
  debug: (message) => {
    if (config.logging.level === 'debug') {
      const logEntry = {
        level: 'debug',
        timestamp: new Date().toISOString(),
        message
      };
      console.debug(JSON.stringify(logEntry));
    }
  }
};

module.exports = logger;