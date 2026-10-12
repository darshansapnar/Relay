import { config } from '../config/index.js';

export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'relay-api',
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
};
