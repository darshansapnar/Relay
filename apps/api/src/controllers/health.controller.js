import { config } from '../config/index.js';
import { checkDatabaseHealth } from '../db/index.js';

export const getHealth = async (req, res) => {
  const dbHealth = await checkDatabaseHealth();

  res.status(200).json({
    status: 'ok',
    service: 'relay-api',
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: dbHealth,
  });
};

export const getDatabaseHealth = async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const statusCode = dbHealth.status === 'error' ? 503 : 200;
  res.status(statusCode).json(dbHealth);
};
