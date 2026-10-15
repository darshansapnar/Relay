-- Migration 004: Create access control tables for waiting room, meeting lock, and participant permissions

CREATE TABLE IF NOT EXISTS meeting_access_states (
  room_name VARCHAR(64) PRIMARY KEY,
  host_identity VARCHAR(128) NOT NULL,
  waiting_room_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_access_entries (
  id SERIAL PRIMARY KEY,
  room_name VARCHAR(64) NOT NULL,
  participant_identity VARCHAR(128) NOT NULL,
  participant_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'waiting', -- 'waiting' | 'approved' | 'rejected' | 'removed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_room_participant_access UNIQUE (room_name, participant_identity)
);

CREATE INDEX IF NOT EXISTS idx_access_entries_room_status
  ON meeting_access_entries (room_name, status);

CREATE INDEX IF NOT EXISTS idx_access_entries_room_identity
  ON meeting_access_entries (room_name, participant_identity);
