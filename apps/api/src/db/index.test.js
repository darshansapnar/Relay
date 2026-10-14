import { describe, expect, it, afterAll } from 'vitest';
import { getSafeDatabaseInfo, checkDatabaseHealth, query, closePool } from './index.js';
import { config } from '../config/index.js';

describe('getSafeDatabaseInfo', () => {
  it('extracts host, database, and pooling status without exposing passwords or credentials', () => {
    const raw =
      'postgresql://neondb_owner:npg_supersecretpassword123@ep-snowy-river-b3vcgdxl-pooler.c-4.ap-southeast-1.aws.neon.tech/relay?sslmode=require';
    const info = getSafeDatabaseInfo(raw);

    expect(info).not.toBeNull();
    expect(info.host).toBe('ep-snowy-river-b3vcgdxl-pooler.c-4.ap-southeast-1.aws.neon.tech');
    expect(info.database).toBe('relay');
    expect(info.isPooled).toBe(true);
    expect(info.port).toBe('5432');
    expect(JSON.stringify(info)).not.toContain('supersecretpassword123');
    expect(JSON.stringify(info)).not.toContain('neondb_owner');
  });

  it('correctly identifies non-pooled direct hosts', () => {
    const directRaw =
      'postgresql://neondb_owner:secret@ep-snowy-river-b3vcgdxl.c-4.ap-southeast-1.aws.neon.tech/relay?sslmode=require';
    const info = getSafeDatabaseInfo(directRaw);

    expect(info).not.toBeNull();
    expect(info.isPooled).toBe(false);
  });

  it('returns null for null, undefined, or invalid URLs', () => {
    expect(getSafeDatabaseInfo(null)).toBeNull();
    expect(getSafeDatabaseInfo(undefined)).toBeNull();
    expect(getSafeDatabaseInfo('invalid-url-string')).toBeNull();
  });
});

describe('Database Connection & Health Check', () => {
  afterAll(async () => {
    await closePool();
  });

  it('performs an active health check query against Neon PostgreSQL', async () => {
    if (!config.database.isConfigured) {
      console.warn('Skipping live DB query: DATABASE_URL is not set.');
      return;
    }

    const health = await checkDatabaseHealth();
    expect(health.status).toBe('connected');
    expect(typeof health.responseTimeMs).toBe('number');
    expect(health.responseTimeMs).toBeGreaterThan(0);
    expect(health.database).toBe('relay');
    expect(health.isPooled).toBe(true);
    expect(health.pool).toBeDefined();
    expect(health.pool.total).toBeGreaterThanOrEqual(1);

    // Verify secrets are never in the returned health object
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain('npg_');
    expect(serialized).not.toContain('neondb_owner');
  });

  it('executes a parameterized calculation query successfully', async () => {
    if (!config.database.isConfigured) {
      return;
    }

    const result = await query('SELECT ($1::int + $2::int) AS total;', [15, 27]);
    expect(result.rows[0].total).toBe(42);
  });
});
