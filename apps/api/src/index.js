import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[Relay API] Server running at http://localhost:${config.port}`);
  console.log(`[Relay API] Health check at http://localhost:${config.port}/api/health`);
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
});

// Graceful shutdown handling
const handleShutdown = signal => {
  console.log(`\n[Relay API] Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('[Relay API] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
