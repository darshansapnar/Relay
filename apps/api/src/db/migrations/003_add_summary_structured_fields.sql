-- Migration 003: Add work_allocation and unresolved_questions to meeting_summaries
ALTER TABLE meeting_summaries
  ADD COLUMN IF NOT EXISTS work_allocation JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unresolved_questions JSONB NOT NULL DEFAULT '[]'::jsonb;
