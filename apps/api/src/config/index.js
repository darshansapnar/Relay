import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Ensure apps/api/.env is always loaded regardless of the execution working directory
const apiEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(apiEnvPath)) {
  dotenv.config({ path: apiEnvPath });
}

// 2. Also check monorepo root .env as a fallback
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// 3. Process cwd .env fallback
dotenv.config();

const sanitizeEnv = val => (val ? String(val).trim() : '');

const livekitUrl = sanitizeEnv(process.env.LIVEKIT_URL);
const livekitApiKey = sanitizeEnv(process.env.LIVEKIT_API_KEY);
const livekitApiSecret = sanitizeEnv(process.env.LIVEKIT_API_SECRET);

const missingLiveKitVars = [];
if (!livekitUrl) missingLiveKitVars.push('LIVEKIT_URL');
if (!livekitApiKey) missingLiveKitVars.push('LIVEKIT_API_KEY');
if (!livekitApiSecret) missingLiveKitVars.push('LIVEKIT_API_SECRET');

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  envPaths: {
    apiEnvPath,
    rootEnvPath,
  },
  livekit: {
    url: livekitUrl,
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
    isConfigured: missingLiveKitVars.length === 0,
    missingVars: missingLiveKitVars,
  },
};
