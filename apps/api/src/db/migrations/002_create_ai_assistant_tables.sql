-- Migration 002: Create AI assistant tables for transcripts, summaries, and meeting AI states

-- Meeting AI states table: Tracks AI feature state, consent, transcription/summary status, and pause reasons per room
CREATE TABLE IF NOT EXISTS meeting_ai_states (
  room_name VARCHAR(64) PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
  transcription_status VARCHAR(50) NOT NULL DEFAULT 'idle',
  summary_status VARCHAR(50) NOT NULL DEFAULT 'idle',
  pause_reason TEXT,
  transcription_pause_reason TEXT,
  summary_count INTEGER NOT NULL DEFAULT 0,
  total_transcript_chars INTEGER NOT NULL DEFAULT 0,
  last_summarized_char_count INTEGER NOT NULL DEFAULT 0,
  last_summarized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meeting transcripts table: Stores finalized transcript segments with timestamps and speaker attribution
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id VARCHAR(64) PRIMARY KEY,
  room_name VARCHAR(64) NOT NULL,
  speaker_identity VARCHAR(128) NOT NULL,
  speaker_name VARCHAR(128) NOT NULL,
  text TEXT NOT NULL,
  start_time_ms BIGINT NOT NULL DEFAULT 0,
  end_time_ms BIGINT NOT NULL DEFAULT 0,
  is_final BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_room_created
  ON meeting_transcripts (room_name, created_at ASC);

-- Meeting summaries table: Stores versioned meeting summaries with key points, decisions, and action items
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id VARCHAR(64) PRIMARY KEY,
  room_name VARCHAR(64) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  summary_text TEXT NOT NULL,
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  work_allocation JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_used VARCHAR(50) NOT NULL,
  model_used VARCHAR(100),
  char_count_covered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_summaries_room_version
  ON meeting_summaries (room_name, version DESC);
