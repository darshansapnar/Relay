import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { requestLogger } from './middlewares/logger.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import apiRoutes from './routes/index.js';

export const createApp = () => {
  const app = express();

  // CORS configuration allowing frontend origin
  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  const isOriginAllowed = origin => {
    if (!origin) return true;
    if (config.clientUrl === '*' || allowedOrigins.includes(origin)) return true;
    try {
      const hostname = new URL(origin).hostname;
      if (hostname === 'localhost' || hostname.endsWith('.vercel.app')) {
        return true;
      }
    } catch {
      // ignore parse error
    }
    return false;
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // HTTP Request Logging
  app.use(requestLogger);

  // Mount API router at /api
  app.use('/api', apiRoutes);

  // Root endpoint info
  app.get('/', (req, res) => {
    res.json({
      service: 'Relay API',
      status: 'active',
      documentation: '/docs',
      health: '/api/health',
    });
  });

  // Catch-all 404 handler
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
};
