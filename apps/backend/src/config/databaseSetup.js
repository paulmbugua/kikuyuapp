const fs = require('fs').promises;
const path = require('path');
const db = require('./db');

const migrationsDirectory = path.resolve(__dirname, '../migrations');

const ensureAuthSchema = async () => {
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_sub VARCHAR(255) UNIQUE,
      email VARCHAR(320) UNIQUE NOT NULL,
      username VARCHAR(80) UNIQUE NOT NULL,
      full_name VARCHAR(160), bio TEXT, avatar_url TEXT, cover_url TEXT,
      phone VARCHAR(40), gender VARCHAR(40), date_of_birth DATE, country VARCHAR(120),
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_private BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      token_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_earned NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_tips_sent NUMERIC(14, 2) NOT NULL DEFAULT 0,
      followers_count INTEGER NOT NULL DEFAULT 0,
      following_count INTEGER NOT NULL DEFAULT 0,
      posts_count INTEGER NOT NULL DEFAULT 0,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)');
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users (google_sub) WHERE google_sub IS NOT NULL');
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email))');
};

const runMigrations = async () => {
  await ensureAuthSchema();
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const files = (await fs.readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
    const checksumResult = await db.query('SELECT encode(digest($1, \'sha256\'), \'hex\') AS checksum', [sql]);
    const checksum = checksumResult.rows[0].checksum;
    const applied = await db.query('SELECT checksum FROM schema_migrations WHERE name = $1', [file]);

    if (applied.rows[0]) {
      if (applied.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${file}`);
      continue;
    }

    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
    });
  }
};

module.exports = { ensureAuthSchema, runMigrations };
