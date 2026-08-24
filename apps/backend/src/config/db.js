// src/config/db.js
// WHY: Centralizes database connection logic
// Handles connection pooling and error recovery
// Exports a reusable pool instance

const { Pool } = require('pg');
const config = require('./env');

// Create connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ...config.database.pool,
  keepAlive: true,
});

// Test database connection
pool.on('connect', () => {
  console.log('📦 Database connected successfully');
});

pool.on('error', (err) => {
  // pg removes failed idle clients from the pool automatically. Keep the
  // process alive so a temporary local or Railway network interruption can recover.
  console.error('❌ Unexpected idle database client error:', err);
});

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Verify startup connectivity with bounded retries. PostgreSQL can be healthy
// while taking a few seconds to accept a new connection after startup/resume.
const testConnection = async (maxAttempts = 5) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      console.log(`✅ Database time: ${result.rows[0].current_time}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const retryDelay = Math.min(1000 * attempt, 5000);
        console.warn(`⚠️ Database connection attempt ${attempt}/${maxAttempts} failed: ${error.message}. Retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
      }
    } finally {
      client?.release();
    }
  }

  throw new Error(`Database connection failed after ${maxAttempts} attempts: ${lastError?.message || 'unknown error'}`, { cause: lastError });
};

// Export pool and helper functions
module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  end: () => pool.end(),
  testConnection,
  
  // Transaction helper
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};