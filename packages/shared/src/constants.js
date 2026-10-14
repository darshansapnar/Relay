export const APP_CONFIG = {
  name: 'Relay',
  tagline: 'Intelligent video meetings for high-velocity teams',
  defaultApiPort: 5000,
  defaultClientPort: 5173,
};

export const API_ROUTES = {
  HEALTH: '/api/health',
};

export const MEETING_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  ENDED: 'ended',
};

export const CHAT_MESSAGE_TYPES = {
  EVERYONE: 'everyone',
  DIRECT: 'direct',
};

export const CHAT_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SEND_MESSAGE: 'chat:send',
  NEW_MESSAGE: 'chat:message',
  GET_HISTORY: 'chat:getHistory',
  MARK_READ: 'chat:markRead',
  UNREAD_UPDATE: 'chat:unreadUpdate',
  ERROR: 'chat:error',
};

export const CHAT_CONFIG = {
  MAX_CONTENT_LENGTH: 2000,
  MAX_ROOM_HISTORY: 500,
  DEFAULT_PAGE_SIZE: 50,
  RATE_LIMIT_MAX_PER_WINDOW: 5,
  RATE_LIMIT_WINDOW_MS: 2000,
};

export const AI_EVENTS = {
  TOGGLE_STATE: 'ai:toggleState',
  GRANT_CONSENT: 'ai:grantConsent',
  STATUS_UPDATE: 'ai:statusUpdate',
  TRANSCRIPT_CHUNK: 'ai:transcriptChunk',
  SUMMARY_UPDATE: 'ai:summaryUpdate',
  GET_STATE: 'ai:getState',
  AUDIO_CHUNK: 'ai:audioChunk',
  REQUEST_SUMMARY: 'ai:requestSummary',
  ERROR: 'ai:error',
};

export const AI_STATUS = {
  IDLE: 'idle',
  ACTIVE: 'active',
  SUMMARIZING: 'summarizing',
  TRANSCRIBING: 'transcribing',
  PAUSED: 'paused',
  ERROR: 'error',
};

export const AI_MESSAGES = {
  SUMMARY_PAUSED_QUOTA:
    'AI summaries are paused because the free-tier limit has been reached. Your meeting can continue normally.',
  TRANSCRIPTION_PAUSED_QUOTA:
    'AI transcription is paused because the free-tier limit has been reached.',
};

