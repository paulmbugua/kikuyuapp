// src/utils/logger.js
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

// Ensure log directory exists
const logDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const serializeDetail = (detail) => {
  if (detail instanceof Error) {
    return {
      name: detail.name,
      message: detail.message,
      code: detail.code,
      stack: detail.stack
    };
  }
  return detail;
};

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
  
  error: (message, ...details) => {
    const primaryError = message instanceof Error
      ? message
      : details.find((detail) => detail instanceof Error);
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message: message instanceof Error ? message.message : String(message),
      ...(primaryError && { error: serializeDetail(primaryError), stack: primaryError.stack }),
      ...(details.length > 0 && { details: details.map(serializeDetail) })
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