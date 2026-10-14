import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { setupChatSocket } from './services/chatSocket.js';
import { getSafeDatabaseInfo, closePool } from './db/index.js';
import { runMigrations } from './db/migrate.js';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO real-time chat service
const io = setupChatSocket(server);

server.listen(config.port, () => {
  console.log(`[Relay API] Server running at http://localhost:${config.port}`);
  console.log(`[Relay API] Health check at http://localhost:${config.port}/api/health`);
  console.log(`[Relay API] Socket.IO chat service ready.`);
  console.log(`[Relay API] Environment: ${config.nodeEnv}`);

  // Safe startup configuration check for LiveKit credentials
  if (config.livekit.isConfigured) {
    console.log(
      '[Relay API] LiveKit: Configured successfully (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET present).'
    );
  } else {
    console.warn(
      `[Relay API] LiveKit: Incomplete configuration. Missing environment variables: ${config.livekit.missingVars.join(
        ', '
      )}`
    );
    console.warn(
      `[Relay API] LiveKit: Looked for environment file at: ${config.envPaths.apiEnvPath}`
    );
  }

  // Safe startup configuration check for Neon PostgreSQL credentials (never print secrets)
  if (config.database.isConfigured) {
    const safeDb = getSafeDatabaseInfo(config.database.url);
    console.log(
      `[Relay API] Database: Configured successfully (host: ${safeDb?.host || 'unknown'}, db: ${safeDb?.database || 'unknown'}, pooled: ${Boolean(safeDb?.isPooled)}).`
    );

    // Apply any pending PostgreSQL schema migrations idempotently
    runMigrations().catch(err => {
      console.error('[Relay API] Database migration error:', err.message);
    });
  } else {
    console.warn(
      `[Relay API] Database: DATABASE_URL not set in ${config.envPaths.apiEnvPath}. Database features are disabled.`
    );
  }
});

// Graceful shutdown handling
const handleShutdown = signal => {
  console.log(`\n[Relay API] Received ${signal}. Gracefully shutting down...`);
  io.close(async () => {
    try {
      await closePool();
      console.log('[Relay API] Database connection pool closed.');
    } catch (err) {
      console.error('[Relay API] Error closing database pool:', err.message);
    }

    server.close(() => {
      console.log('[Relay API] HTTP and Socket.IO servers closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
