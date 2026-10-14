import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, query } from './index.js';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs pending PostgreSQL migrations in alphabetical order.
 * Safe, idempotent, and records completed migrations in schema_migrations.
 *
 * @returns {Promise<{ applied: Array<string>, total: number }>}
 */
export const runMigrations = async () => {
  if (!config.database.isConfigured) {
    console.warn('[Relay DB] Migrations skipped: DATABASE_URL is not configured.');
    return { applied: [], total: 0 };
  }

  const pool = getPool();
  if (!pool) {
    throw new Error('Database pool could not be initialized.');
  }

  // Ensure migrations tracking table exists
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Query already applied migrations
  const { rows } = await query('SELECT name FROM schema_migrations ORDER BY name ASC;');
  const appliedSet = new Set(rows.map(r => r.name));

  const migrationsDir = path.resolve(__dirname, './migrations');
  if (!fs.existsSync(migrationsDir)) {
    return { applied: [], total: appliedSet.size };
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const newlyApplied = [];

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
      await client.query('COMMIT');

      newlyApplied.push(file);
      console.log(`[Relay DB] Applied migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[Relay DB] Failed applying migration ${file}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  return { applied: newlyApplied, total: appliedSet.size + newlyApplied.length };
};

// Allow standalone execution via `node apps/api/src/db/migrate.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(result => {
      console.log(`[Relay DB] Migrations complete. Newly applied: ${result.applied.length}.`);
      process.exit(0);
    })
    .catch(err => {
      console.error('[Relay DB] Migration execution failed:', err);
      process.exit(1);
    });
}
