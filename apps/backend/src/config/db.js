// src/config/db.js
// WHY: Centralizes database connection logic
// Handles connection pooling and error recovery
// Exports a reusable pool instance

const { Pool } = require('pg');
const config = require('./env');

// Create connection pool
const pool = new Pool({
  connectionString: config.database.url,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('📦 Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Test query to verify connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✅ Database time: ${result.rows[0].current_time}`);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
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