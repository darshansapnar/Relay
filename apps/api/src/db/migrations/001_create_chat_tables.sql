-- Migration 001: Create chat tables and meeting membership records

-- Schema migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meeting memberships table: Tracks participants who have joined or been authorized in a meeting room
CREATE TABLE IF NOT EXISTS meeting_memberships (
  id SERIAL PRIMARY KEY,
  room_name VARCHAR(64) NOT NULL,
  participant_identity VARCHAR(128) NOT NULL,
  participant_name VARCHAR(128) NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  first_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_meeting_membership UNIQUE (room_name, participant_identity)
);

CREATE INDEX IF NOT EXISTS idx_memberships_room_name 
  ON meeting_memberships (room_name);

-- Chat messages table: Persistent storage for everyone and direct one-to-one messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  client_message_id VARCHAR(128),
  room_name VARCHAR(64) NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('everyone', 'direct')),
  sender_identity VARCHAR(128) NOT NULL,
  sender_name VARCHAR(128) NOT NULL,
  recipient_identity VARCHAR(128),
  recipient_name VARCHAR(128),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_direct_recipient CHECK (
    (target_type = 'everyone' AND recipient_identity IS NULL) OR
    (target_type = 'direct' AND recipient_identity IS NOT NULL)
  )
);

-- Chronological ordering index for room message listing
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created 
  ON chat_messages (room_name, created_at ASC);

-- Index for Everyone room messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_everyone 
  ON chat_messages (room_name, created_at DESC) 
  WHERE target_type = 'everyone';

-- Index for direct message lookup by sender
CREATE INDEX IF NOT EXISTS idx_chat_messages_direct_sender 
  ON chat_messages (room_name, sender_identity, created_at DESC) 
  WHERE target_type = 'direct';

-- Index for direct message lookup by recipient
CREATE INDEX IF NOT EXISTS idx_chat_messages_direct_recipient 
  ON chat_messages (room_name, recipient_identity, created_at DESC) 
  WHERE target_type = 'direct';

-- Deduplication index for retried sends
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_dedup 
  ON chat_messages (room_name, sender_identity, client_message_id) 
  WHERE client_message_id IS NOT NULL;

-- Read state tracking table
CREATE TABLE IF NOT EXISTS chat_read_states (
  room_name VARCHAR(64) NOT NULL,
  participant_identity VARCHAR(128) NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('everyone', 'direct')),
  peer_identity VARCHAR(128) NOT NULL DEFAULT '',
  last_read_message_id VARCHAR(64),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_name, participant_identity, target_type, peer_identity)
);
