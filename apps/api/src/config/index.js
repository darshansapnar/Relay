import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Ensure apps/api/.env is always loaded regardless of the execution working directory
const apiEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(apiEnvPath)) {
  dotenv.config({ path: apiEnvPath, override: true });
}

// 2. Also check monorepo root .env as a fallback
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// 3. Process cwd .env fallback
dotenv.config();

export const reloadEnv = () => {
  if (fs.existsSync(apiEnvPath)) {
    dotenv.config({ path: apiEnvPath, override: true });
  }
};

const sanitizeEnv = val => (val ? String(val).trim() : '');

const livekitUrl = sanitizeEnv(process.env.LIVEKIT_URL);
const livekitApiKey = sanitizeEnv(process.env.LIVEKIT_API_KEY);
const livekitApiSecret = sanitizeEnv(process.env.LIVEKIT_API_SECRET);

const databaseUrl = sanitizeEnv(process.env.DATABASE_URL);
const databaseUrlUnpooled = sanitizeEnv(process.env.DATABASE_URL_UNPOOLED);

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
  database: {
    url: databaseUrl,
    unpooledUrl: databaseUrlUnpooled,
    isConfigured: Boolean(databaseUrl),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '5000', 10),
  },
  ai: {
    enabled: process.env.AI_ASSISTANT_ENABLED !== 'false',
    _groqApiKey: null,
    _geminiApiKey: null,
    get groqApiKey() {
      return this._groqApiKey ?? sanitizeEnv(process.env.GROQ_API_KEY);
    },
    set groqApiKey(val) {
      this._groqApiKey = val;
    },
    get geminiApiKey() {
      return this._geminiApiKey ?? sanitizeEnv(process.env.GEMINI_API_KEY);
    },
    set geminiApiKey(val) {
      this._geminiApiKey = val;
    },
    groqPrimaryModel: process.env.GROQ_PRIMARY_MODEL || 'openai/gpt-oss-120b',
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite',
    transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'gemini',
    geminiTranscriptionModel:
      process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-3.5-transcribe',
    groqTranscriptionModel:
      process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
    summaryMinChars: parseInt(process.env.AI_SUMMARY_MIN_CHARS || '400', 10),
    summaryCooldownMs: parseInt(process.env.AI_SUMMARY_COOLDOWN_MS || '300000', 10), // 5 minutes
    maxSummariesPerMeeting: parseInt(process.env.AI_MAX_SUMMARIES_PER_MEETING || '10', 10),
    maxInputTokens: parseInt(process.env.AI_MAX_INPUT_TOKENS || '4000', 10),
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '2048', 10),
    maxMeetingDurationMs: parseInt(process.env.AI_MAX_MEETING_DURATION_MS || '7200000', 10), // 2 hours
  },
};

