import crypto from 'crypto';
import { query } from './index.js';

/**
 * Retrieves the AI assistant state for a meeting room.
 *
 * @param {string} roomName
 * @returns {Promise<object>}
 */
export const getAIState = async roomName => {
  if (!roomName) return null;

  const sql = `
    SELECT 
      room_name AS "roomName",
      is_active AS "isActive",
      consent_granted AS "consentGranted",
      transcription_status AS "transcriptionStatus",
      summary_status AS "summaryStatus",
      pause_reason AS "pauseReason",
      transcription_pause_reason AS "transcriptionPauseReason",
      summary_count AS "summaryCount",
      total_transcript_chars AS "totalTranscriptChars",
      last_summarized_char_count AS "lastSummarizedCharCount",
      last_summarized_at AS "lastSummarizedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM meeting_ai_states
    WHERE room_name = $1
    LIMIT 1;
  `;

  const { rows } = await query(sql, [roomName]);
  if (rows.length > 0) {
    return rows[0];
  }

  return {
    roomName,
    isActive: false,
    consentGranted: false,
    transcriptionStatus: 'idle',
    summaryStatus: 'idle',
    pauseReason: null,
    transcriptionPauseReason: null,
    summaryCount: 0,
    totalTranscriptChars: 0,
    lastSummarizedCharCount: 0,
    lastSummarizedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Upserts the AI assistant state for a meeting room.
 *
 * @param {string} roomName
 * @param {object} updates
 * @returns {Promise<object>}
 */
export const upsertAIState = async (roomName, updates = {}) => {
  if (!roomName) throw new Error('roomName is required to upsert AI state');

  const current = await getAIState(roomName);

  const isActive = updates.isActive !== undefined ? Boolean(updates.isActive) : current.isActive;
  const consentGranted =
    updates.consentGranted !== undefined ? Boolean(updates.consentGranted) : current.consentGranted;
  const transcriptionStatus = updates.transcriptionStatus || current.transcriptionStatus;
  const summaryStatus = updates.summaryStatus || current.summaryStatus;
  const pauseReason = updates.pauseReason !== undefined ? updates.pauseReason : current.pauseReason;
  const transcriptionPauseReason =
    updates.transcriptionPauseReason !== undefined
      ? updates.transcriptionPauseReason
      : current.transcriptionPauseReason;
  const summaryCount =
    updates.summaryCount !== undefined ? Number(updates.summaryCount) : current.summaryCount;
  const totalTranscriptChars =
    updates.totalTranscriptChars !== undefined
      ? Number(updates.totalTranscriptChars)
      : current.totalTranscriptChars;
  const lastSummarizedCharCount =
    updates.lastSummarizedCharCount !== undefined
      ? Number(updates.lastSummarizedCharCount)
      : current.lastSummarizedCharCount;
  const lastSummarizedAt =
    updates.lastSummarizedAt !== undefined ? updates.lastSummarizedAt : current.lastSummarizedAt;

  const sql = `
    INSERT INTO meeting_ai_states (
      room_name,
      is_active,
      consent_granted,
      transcription_status,
      summary_status,
      pause_reason,
      transcription_pause_reason,
      summary_count,
      total_transcript_chars,
      last_summarized_char_count,
      last_summarized_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (room_name) DO UPDATE SET
      is_active = EXCLUDED.is_active,
      consent_granted = EXCLUDED.consent_granted,
      transcription_status = EXCLUDED.transcription_status,
      summary_status = EXCLUDED.summary_status,
      pause_reason = EXCLUDED.pause_reason,
      transcription_pause_reason = EXCLUDED.transcription_pause_reason,
      summary_count = EXCLUDED.summary_count,
      total_transcript_chars = EXCLUDED.total_transcript_chars,
      last_summarized_char_count = EXCLUDED.last_summarized_char_count,
      last_summarized_at = EXCLUDED.last_summarized_at,
      updated_at = NOW()
    RETURNING 
      room_name AS "roomName",
      is_active AS "isActive",
      consent_granted AS "consentGranted",
      transcription_status AS "transcriptionStatus",
      summary_status AS "summaryStatus",
      pause_reason AS "pauseReason",
      transcription_pause_reason AS "transcriptionPauseReason",
      summary_count AS "summaryCount",
      total_transcript_chars AS "totalTranscriptChars",
      last_summarized_char_count AS "lastSummarizedCharCount",
      last_summarized_at AS "lastSummarizedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt";
  `;

  const values = [
    roomName,
    isActive,
    consentGranted,
    transcriptionStatus,
    summaryStatus,
    pauseReason,
    transcriptionPauseReason,
    summaryCount,
    totalTranscriptChars,
    lastSummarizedCharCount,
    lastSummarizedAt,
  ];

  const { rows } = await query(sql, values);
  return rows[0];
};

/**
 * Saves a finalized transcript segment to the database and updates total transcript character count.
 *
 * @param {object} segmentData
 * @returns {Promise<object>}
 */
export const saveTranscript = async ({
  id = crypto.randomUUID(),
  roomName,
  speakerIdentity,
  speakerName,
  text,
  startTimeMs = 0,
  endTimeMs = 0,
  isFinal = true,
}) => {
  if (!roomName || !text || !speakerIdentity) {
    throw new Error('roomName, text, and speakerIdentity are required for transcript saving');
  }

  const cleanText = String(text).trim();
  const cleanSpeakerName = String(speakerName || '').trim() || 'Unknown speaker';

  const insertSql = `
    INSERT INTO meeting_transcripts (
      id,
      room_name,
      speaker_identity,
      speaker_name,
      text,
      start_time_ms,
      end_time_ms,
      is_final,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (id) DO NOTHING
    RETURNING 
      id,
      room_name AS "roomName",
      speaker_identity AS "speakerIdentity",
      speaker_name AS "speakerName",
      text,
      start_time_ms AS "startTimeMs",
      end_time_ms AS "endTimeMs",
      is_final AS "isFinal",
      created_at AS "createdAt";
  `;

  const { rows } = await query(insertSql, [
    id,
    roomName,
    speakerIdentity,
    cleanSpeakerName,
    cleanText,
    Math.round(startTimeMs),
    Math.round(endTimeMs),
    isFinal,
  ]);

  if (rows.length === 0) {
    // Idempotent duplicate: fetch existing record without updating character counts
    const { rows: existingRows } = await query(
      `
        SELECT 
          id,
          room_name AS "roomName",
          speaker_identity AS "speakerIdentity",
          speaker_name AS "speakerName",
          text,
          start_time_ms AS "startTimeMs",
          end_time_ms AS "endTimeMs",
          is_final AS "isFinal",
          created_at AS "createdAt"
        FROM meeting_transcripts
        WHERE id = $1
        LIMIT 1;
      `,
      [id]
    );
    return { ...existingRows[0], isDuplicate: true };
  }

  const savedSegment = rows[0];

  // Update total character count in meeting_ai_states
  await query(
    `
      INSERT INTO meeting_ai_states (
        room_name,
        total_transcript_chars,
        updated_at
      ) VALUES ($1, $2, NOW())
      ON CONFLICT (room_name) DO UPDATE SET
        total_transcript_chars = meeting_ai_states.total_transcript_chars + $2,
        updated_at = NOW();
    `,
    [roomName, cleanText.length]
  );

  return savedSegment;
};

/**
 * Retrieves chronological transcript segments for a meeting room.
 *
 * @param {string} roomName
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
export const getTranscripts = async (roomName, options = {}) => {
  if (!roomName) return [];

  const limit = Math.min(Math.max(parseInt(options.limit || '100', 10), 1), 500);
  const offset = Math.max(parseInt(options.offset || '0', 10), 0);

  const sql = `
    SELECT 
      id,
      room_name AS "roomName",
      speaker_identity AS "speakerIdentity",
      speaker_name AS "speakerName",
      text,
      start_time_ms AS "startTimeMs",
      end_time_ms AS "endTimeMs",
      is_final AS "isFinal",
      created_at AS "createdAt"
    FROM meeting_transcripts
    WHERE room_name = $1
    ORDER BY start_time_ms ASC, created_at ASC
    LIMIT $2 OFFSET $3;
  `;

  const { rows } = await query(sql, [roomName, limit, offset]);
  return rows;
};

/**
 * Saves a versioned meeting summary.
 *
 * @param {object} summaryData
 * @returns {Promise<object>}
 */
export const saveSummary = async ({
  id = crypto.randomUUID(),
  roomName,
  summaryText,
  keyPoints = [],
  decisions = [],
  actionItems = [],
  workAllocation = [],
  unresolvedQuestions = [],
  providerUsed = 'groq',
  modelUsed = '',
  charCountCovered = 0,
}) => {
  if (!roomName || !summaryText) {
    throw new Error('roomName and summaryText are required to save a summary');
  }

  // Determine next version number
  const versionQuery = `
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
    FROM meeting_summaries
    WHERE room_name = $1;
  `;
  const { rows: versionRows } = await query(versionQuery, [roomName]);
  const nextVersion = parseInt(versionRows[0]?.next_version || '1', 10);

  const insertSql = `
    INSERT INTO meeting_summaries (
      id,
      room_name,
      version,
      summary_text,
      key_points,
      decisions,
      action_items,
      work_allocation,
      unresolved_questions,
      provider_used,
      model_used,
      char_count_covered,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    RETURNING 
      id,
      room_name AS "roomName",
      version,
      summary_text AS "summaryText",
      key_points AS "keyPoints",
      decisions,
      action_items AS "actionItems",
      work_allocation AS "workAllocation",
      unresolved_questions AS "unresolvedQuestions",
      provider_used AS "providerUsed",
      model_used AS "modelUsed",
      char_count_covered AS "charCountCovered",
      created_at AS "createdAt";
  `;

  const { rows } = await query(insertSql, [
    id,
    roomName,
    nextVersion,
    summaryText,
    JSON.stringify(keyPoints),
    JSON.stringify(decisions),
    JSON.stringify(actionItems),
    JSON.stringify(workAllocation),
    JSON.stringify(unresolvedQuestions),
    providerUsed,
    modelUsed,
    charCountCovered,
  ]);

  const savedSummary = rows[0];

  // Upsert meeting_ai_states with summary progress
  await query(
    `
      INSERT INTO meeting_ai_states (
        room_name,
        summary_count,
        total_transcript_chars,
        last_summarized_char_count,
        last_summarized_at,
        summary_status,
        updated_at
      ) VALUES ($1, 1, $2, $2, NOW(), 'idle', NOW())
      ON CONFLICT (room_name) DO UPDATE SET
        summary_count = meeting_ai_states.summary_count + 1,
        total_transcript_chars = GREATEST(meeting_ai_states.total_transcript_chars, $2),
        last_summarized_char_count = $2,
        last_summarized_at = NOW(),
        summary_status = 'idle',
        updated_at = NOW();
    `,
    [roomName, charCountCovered]
  );

  return {
    ...savedSummary,
    workAllocation: savedSummary.workAllocation || [],
    unresolvedQuestions: savedSummary.unresolvedQuestions || [],
  };
};

/**
 * Retrieves the latest summary for a meeting room.
 *
 * @param {string} roomName
 * @returns {Promise<object | null>}
 */
export const getLatestSummary = async roomName => {
  if (!roomName) return null;

  const sql = `
    SELECT 
      id,
      room_name AS "roomName",
      version,
      summary_text AS "summaryText",
      key_points AS "keyPoints",
      decisions,
      action_items AS "actionItems",
      work_allocation AS "workAllocation",
      unresolved_questions AS "unresolvedQuestions",
      provider_used AS "providerUsed",
      model_used AS "modelUsed",
      char_count_covered AS "charCountCovered",
      created_at AS "createdAt"
    FROM meeting_summaries
    WHERE room_name = $1
    ORDER BY version DESC
    LIMIT 1;
  `;

  const { rows } = await query(sql, [roomName]);
  if (!rows[0]) return null;

  return {
    ...rows[0],
    workAllocation: rows[0].workAllocation || [],
    unresolvedQuestions: rows[0].unresolvedQuestions || [],
  };
};

/**
 * Retrieves all summary versions for a meeting room.
 *
 * @param {string} roomName
 * @returns {Promise<Array<object>>}
 */
export const getSummaries = async roomName => {
  if (!roomName) return [];

  const sql = `
    SELECT 
      id,
      room_name AS "roomName",
      version,
      summary_text AS "summaryText",
      key_points AS "keyPoints",
      decisions,
      action_items AS "actionItems",
      work_allocation AS "workAllocation",
      unresolved_questions AS "unresolvedQuestions",
      provider_used AS "providerUsed",
      model_used AS "modelUsed",
      char_count_covered AS "charCountCovered",
      created_at AS "createdAt"
    FROM meeting_summaries
    WHERE room_name = $1
    ORDER BY version DESC;
  `;

  const { rows } = await query(sql, [roomName]);
  return rows.map(r => ({
    ...r,
    workAllocation: r.workAllocation || [],
    unresolvedQuestions: r.unresolvedQuestions || [],
  }));
};


/**
 * Deletes all AI data for a meeting room (transcripts, summaries, state).
 * Used for testing and room cleanup.
 *
 * @param {string} roomName
 * @returns {Promise<void>}
 */
export const clearAIRoomData = async roomName => {
  if (!roomName) return;
  await query('DELETE FROM meeting_transcripts WHERE room_name = $1;', [roomName]);
  await query('DELETE FROM meeting_summaries WHERE room_name = $1;', [roomName]);
  await query('DELETE FROM meeting_ai_states WHERE room_name = $1;', [roomName]);
};

