import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

/**
 * Safely parses connection string to extract non-sensitive metadata for logging and diagnostics.
 * Never exposes passwords or authentication tokens.
 *
 * @param {string} [connectionString]
 * @returns {{ host: string, port: string, database: string, isPooled: boolean } | null}
 */
export const getSafeDatabaseInfo = connectionString => {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, ''),
      isPooled: url.hostname.includes('-pooler'),
    };
  } catch {
    return null;
  }
};

let poolInstance = null;

/**
 * Gets or initializes the shared PostgreSQL connection pool configured for Neon.
 *
 * @returns {import('pg').Pool | null}
 */
export const getPool = () => {
  if (!config.database.isConfigured) {
    return null;
  }

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: config.database.url,
      max: config.database.poolMax,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    });

    poolInstance.on('error', err => {
      // Handles idle client disconnects cleanly without unhandled rejections
      console.error('[Relay DB] Unexpected idle client error:', err.message);
    });
  }

  return poolInstance;
};

/**
 * Executes a parameterized SQL query on the PostgreSQL connection pool.
 *
 * @param {string} text - SQL query string
 * @param {Array<unknown>} [params] - Optional query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export const query = async (text, params) => {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database is not configured. DATABASE_URL is required.');
  }
  return pool.query(text, params);
};

/**
 * Performs an active database health check via SELECT 1.
 * Returns structured metadata suitable for diagnostics without exposing credentials.
 *
 * @returns {Promise<{
 *   status: 'connected' | 'not_configured' | 'error',
 *   responseTimeMs?: number,
 *   database?: string,
 *   serverTime?: string,
 *   isPooled?: boolean,
 *   pool?: { total: number, idle: number, waiting: number },
 *   message?: string,
 *   timestamp: string
 * }>}
 */
export const checkDatabaseHealth = async () => {
  const timestamp = new Date().toISOString();

  if (!config.database.isConfigured) {
    return {
      status: 'not_configured',
      message: 'DATABASE_URL environment variable is not configured',
      timestamp,
    };
  }

  const pool = getPool();
  const safeInfo = getSafeDatabaseInfo(config.database.url);
  const startTime = Date.now();

  try {
    const result = await pool.query(
      'SELECT 1 AS health, NOW() AS server_time, current_database() AS database_name;'
    );
    const responseTimeMs = Date.now() - startTime;
    const row = result.rows[0] || {};

    return {
      status: 'connected',
      responseTimeMs,
      database: row.database_name || safeInfo?.database || 'relay',
      serverTime: row.server_time ? new Date(row.server_time).toISOString() : timestamp,
      isPooled: safeInfo?.isPooled ?? false,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      timestamp,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message || 'Database query failed',
      database: safeInfo?.database || 'unknown',
      isPooled: safeInfo?.isPooled ?? false,
      timestamp,
    };
  }
};

/**
 * Gracefully terminates the connection pool.
 *
 * @returns {Promise<void>}
 */
export const closePool = async () => {
  if (poolInstance) {
    const pool = poolInstance;
    poolInstance = null;
    await pool.end();
  }
};
