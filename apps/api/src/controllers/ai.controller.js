import { verifyParticipantToken } from '../services/livekitAdmin.js';
import { aiManager } from '../services/aiManager.js';
import { getTranscripts, getLatestSummary, getSummaries, getAIState } from '../db/aiRepo.js';


/**
 * GET /api/meetings/:roomName/ai/state
 * Retrieves the current AI assistant state for a meeting room.
 */
export const getAIStateController = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    await verifyParticipantToken(req, roomName);

    const state = await aiManager.getRoomState(roomName);
    res.json(state);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/meetings/:roomName/ai/toggle
 * Toggles AI assistant activation state (requires consent).
 */
export const toggleAIStateController = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    const auth = await verifyParticipantToken(req, roomName);
    const { isActive, consentGranted } = req.body;

    const result = await aiManager.toggleAIState(roomName, {
      isActive,
      consentGranted,
      requestedByIdentity: auth.identity,
      requestedByName: auth.name,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.state);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/meetings/:roomName/ai/transcripts
 * Retrieves paginated chronological transcripts for a meeting room.
 */
export const getTranscriptsController = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    await verifyParticipantToken(req, roomName);

    const limit = parseInt(req.query.limit || '100', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const transcripts = await getTranscripts(roomName, { limit, offset });
    res.json({ transcripts });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/meetings/:roomName/ai/transcripts
 * Submits a finalized transcript segment directly.
 */
export const postTranscriptController = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    const auth = await verifyParticipantToken(req, roomName);
    const { text, startTimeMs, endTimeMs } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Transcript text is required' });
    }

    const saved = await aiManager.handleTranscriptSegment({
      roomName,
      speakerIdentity: auth.identity,
      speakerName: auth.name,
      text,
      startTimeMs: Number(startTimeMs) || 0,
      endTimeMs: Number(endTimeMs) || 0,
    });

    if (!saved) {
      return res.status(400).json({
        error: 'AI Assistant is not active or consent has not been granted for this meeting.',
      });
    }

    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/meetings/:roomName/ai/summaries
 * Retrieves all summary versions or latest summary.
 */
export const getSummariesController = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    await verifyParticipantToken(req, roomName);

    const latest = req.query.latest === 'true';
    if (latest) {
      const summary = await getLatestSummary(roomName);
      return res.json({ summary });
    }

    const summaries = await getSummaries(roomName);
    res.json({ summaries });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/meetings/:roomName/ai/summary/trigger
 * Triggers manual summary generation if quota and limits permit.
 */
export const triggerSummaryController = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    await verifyParticipantToken(req, roomName);

    await aiManager.maybeTriggerSummary(roomName, true);
    const latest = await getLatestSummary(roomName);
    const state = await getAIState(roomName);

    res.json({ state, latestSummary: latest });
  } catch (err) {
    next(err);
  }
};

