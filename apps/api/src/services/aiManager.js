import crypto from 'crypto';
import { config } from '../config/index.js';
import { AI_EVENTS, AI_STATUS, AI_MESSAGES } from '@relay/shared';
import {
  getAIState,
  upsertAIState,
  saveTranscript,
  getTranscripts,
  saveSummary,
  getLatestSummary,
} from '../db/aiRepo.js';
import { generateSummary } from './aiSummarizer.js';
import { transcribeAudioChunk } from './aiTranscription.js';
import { stitchAndDeduplicate } from './aiTranscriptDeduplicator.js';

// In-flight summarization locks per room to prevent concurrent duplicate jobs
const roomSummaryLocks = new Set();

/**
 * AI Manager service orchestrating state, live transcription, and automatic periodic summarization.
 */
export class AIManager {
  constructor(io = null) {
    this.io = io;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Broadcasts an event to all participants in a meeting room.
   */
  broadcast(roomName, event, payload) {
    if (!this.io || !roomName) return;
    this.io.to(`room:${roomName}`).emit(event, payload);
  }

  /**
   * Retrieves full AI assistant state for a room, including latest summary and recent transcripts.
   */
  async getRoomState(roomName) {
    const [state, latestSummary, transcripts] = await Promise.all([
      getAIState(roomName),
      getLatestSummary(roomName),
      getTranscripts(roomName, { limit: 100 }),
    ]);

    return {
      ...state,
      latestSummary,
      transcripts,
    };
  }

  /**
   * Toggles the AI assistant active state for a meeting room (requires consent).
   */
  async toggleAIState(roomName, { isActive, consentGranted, _requestedByIdentity, _requestedByName }) {
    if (!config.ai.enabled) {
      return {
        ok: false,
        error: 'AI Assistant is disabled on this server.',
      };
    }

    const current = await getAIState(roomName);

    // If attempting to activate, consent must be granted
    const newConsent =
      consentGranted !== undefined ? Boolean(consentGranted) : current.consentGranted;
    const newActive = Boolean(isActive);

    if (newActive && !newConsent) {
      return {
        ok: false,
        error: 'Participant consent is required before activating the AI assistant.',
      };
    }

    await upsertAIState(roomName, {
      isActive: newActive,
      consentGranted: newConsent,
      transcriptionStatus: newActive ? AI_STATUS.ACTIVE : AI_STATUS.IDLE,
      summaryStatus: newActive ? AI_STATUS.ACTIVE : AI_STATUS.IDLE,
    });


    const fullState = await this.getRoomState(roomName);
    this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, fullState);

    return { ok: true, state: fullState };
  }

  /**
   * Records a finalized transcript segment, persists to PostgreSQL, broadcasts to room,
   * and triggers summarization if criteria are met.
   */
  async handleTranscriptSegment({
    id = null,
    roomName,
    speakerIdentity = 'unknown',
    speakerName = 'Unknown speaker',
    text,
    startTimeMs = 0,
    endTimeMs = 0,
  }) {
    const rawText = String(text || '').trim();
    if (!rawText) return null;

    const state = await getAIState(roomName);
    if (!state.isActive || !state.consentGranted) {
      return null;
    }

    // 1. Normalize timestamps to elapsed meeting time in milliseconds
    let normStartTimeMs = Number(startTimeMs) || 0;
    let normEndTimeMs = Number(endTimeMs) || 0;

    // If an epoch timestamp (e.g. > 1e11) was passed, calculate offset from state.createdAt
    if (normStartTimeMs > 100000000000) {
      const meetingStartMs = state.createdAt ? new Date(state.createdAt).getTime() : normStartTimeMs;
      const duration = normEndTimeMs > normStartTimeMs ? normEndTimeMs - normStartTimeMs : 6000;
      normStartTimeMs = Math.max(0, normStartTimeMs - meetingStartMs);
      normEndTimeMs = normStartTimeMs + duration;
    } else if (normEndTimeMs <= normStartTimeMs) {
      normEndTimeMs = normStartTimeMs + 6000;
    }

    // 2. Normalize and sanitize speaker labels
    const cleanSpeakerIdentity = String(speakerIdentity || 'unknown').trim();
    let cleanSpeakerName = String(speakerName || '').trim();
    if (!cleanSpeakerName || cleanSpeakerName === 'undefined' || cleanSpeakerName === 'null') {
      cleanSpeakerName = 'Unknown speaker';
    }

    // 3. Retrieve recent transcripts for boundary stitching and deduplication
    const recentTranscripts = await getTranscripts(roomName, { limit: 10 });
    // Find the latest segment from this speaker (or the overall latest segment)
    const lastSpeakerSegment =
      recentTranscripts.find(t => t.speakerIdentity === cleanSpeakerIdentity) ||
      (recentTranscripts.length > 0 ? recentTranscripts[recentTranscripts.length - 1] : null);

    const stitchResult = stitchAndDeduplicate({
      lastSegment: lastSpeakerSegment,
      text: rawText,
      speakerIdentity: cleanSpeakerIdentity,
      startTimeMs: normStartTimeMs,
    });

    if (stitchResult.isDuplicate || !stitchResult.text) {
      return null;
    }

    const finalizedText = stitchResult.text;

    // 4. Generate deterministic segment ID for persistence idempotency
    const segmentId =
      id ||
      crypto
        .createHash('sha256')
        .update(`${roomName}:${cleanSpeakerIdentity}:${Math.round(normStartTimeMs)}:${finalizedText}`)
        .digest('hex')
        .slice(0, 32);

    // 5. Persist transcript segment in Neon PostgreSQL
    const saved = await saveTranscript({
      id: segmentId,
      roomName,
      speakerIdentity: cleanSpeakerIdentity,
      speakerName: cleanSpeakerName,
      text: finalizedText,
      startTimeMs: normStartTimeMs,
      endTimeMs: normEndTimeMs,
    });

    // If already saved (idempotent duplicate), do not re-broadcast
    if (saved?.isDuplicate) {
      return saved;
    }

    // 6. Broadcast finalized transcript segment to all room participants in real time
    this.broadcast(roomName, AI_EVENTS.TRANSCRIPT_CHUNK, saved);

    // 7. Check if we should trigger an asynchronous summary
    const summaryPromise = this.maybeTriggerSummary(roomName).catch(err => {
      console.error(`[Relay AI] Background summarization error in room ${roomName}:`, err.message);
    });

    if (this.lastSummaryPromise) {
      this.lastSummaryPromise = Promise.all([this.lastSummaryPromise, summaryPromise]);
    } else {
      this.lastSummaryPromise = summaryPromise;
    }

    return saved;
  }

  /**
   * Handles an incoming audio chunk from the browser, transcribes it, and routes to transcript handler.
   */
  async handleAudioChunk({
    id = null,
    roomName,
    audioBuffer,
    speakerIdentity,
    speakerName,
    startTimeMs = 0,
    endTimeMs = 0,
    customFetch = fetch,
  }) {
    const state = await getAIState(roomName);
    if (!state.isActive || !state.consentGranted) {
      return { ok: false, error: 'AI Assistant is not active in this room' };
    }

    if (state.transcriptionStatus === AI_STATUS.PAUSED) {
      return {
        ok: false,
        paused: true,
        message: AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA,
      };
    }

    const result = await transcribeAudioChunk({
      audioData: audioBuffer,
      speakerIdentity,
      speakerName,
      startTimeMs,
      endTimeMs,
      customFetch,
    });

    if (result.paused) {
      await upsertAIState(roomName, {
        transcriptionStatus: AI_STATUS.PAUSED,
        transcriptionPauseReason: result.reason || 'quota_exhausted',
      });
      this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, {
        roomName,
        transcriptionStatus: AI_STATUS.PAUSED,
        transcriptionPauseReason: result.message,
      });
      return result;
    }

    if (result.ok && result.text) {
      await this.handleTranscriptSegment({
        id,
        roomName,
        speakerIdentity,
        speakerName,
        text: result.text,
        startTimeMs,
        endTimeMs,
      });
    }

    return result;
  }

  /**
   * Evaluates cost controls and conditions to trigger periodic or meeting-end summarization.
   *
   * @param {string} roomName
   * @param {boolean | { force?: boolean, isMeetingEnd?: boolean }} [options=false]
   */
  async maybeTriggerSummary(roomName, options = false) {
    const opts = typeof options === 'boolean' ? { force: options } : (options || {});
    const force = Boolean(opts.force);
    const isMeetingEnd = Boolean(opts.isMeetingEnd);

    if (roomSummaryLocks.has(roomName)) {
      console.log(`[Relay AI] Room ${roomName}: Summary skipped - lock held by in-flight generation.`);
      return; // Job already running for this room
    }
    roomSummaryLocks.add(roomName);

    try {
      const state = await getAIState(roomName);
      if (!state.isActive && !force && !isMeetingEnd) {
        console.log(`[Relay AI] Room ${roomName}: Summary skipped - AI assistant is not active.`);
        return;
      }

      if (state.summaryStatus === AI_STATUS.PAUSED && !force) {
        console.log(
          `[Relay AI] Room ${roomName}: Summary skipped - summarization paused (${state.pauseReason || 'quota limit'}).`
        );
        return;
      }

      // Check maximum summary calls per meeting hard cost limit
      if (state.summaryCount >= config.ai.maxSummariesPerMeeting) {
        console.log(
          `[Relay AI] Room ${roomName}: Summary skipped - reached max summaries limit (${config.ai.maxSummariesPerMeeting}).`
        );
        return;
      }

      const now = Date.now();
      const lastSummaryTime = state.lastSummarizedAt ? new Date(state.lastSummarizedAt).getTime() : 0;
      const timeSinceLastSummary = now - lastSummaryTime;
      const isFirstSummary = !state.summaryCount || state.summaryCount === 0 || !state.lastSummarizedAt;

      // Cooldown check (unless forced or meeting end; first summary is never blocked by cooldown)
      if (!force && !isMeetingEnd && !isFirstSummary && timeSinceLastSummary < config.ai.summaryCooldownMs) {
        const remainingSec = Math.round((config.ai.summaryCooldownMs - timeSinceLastSummary) / 1000);
        console.log(
          `[Relay AI] Room ${roomName}: Summary skipped - cooldown active (${remainingSec}s remaining).`
        );
        return;
      }

      // Fetch actual transcripts to accurately evaluate accumulated and new characters
      const allTranscripts = await getTranscripts(roomName, { limit: 500 });
      const totalChars = allTranscripts.reduce(
        (sum, t) => sum + (t.text ? t.text.trim().length : 0),
        0
      );
      const accumulatedChars = Math.max(state.totalTranscriptChars || 0, totalChars);
      const newChars = Math.max(0, accumulatedChars - (state.lastSummarizedCharCount || 0));

      const threshold = config.ai.summaryMinChars;
      const minMeaningfulChars = 80; // Minimum meaningful discussion for short meeting or final summary

      if (!force) {
        if (isMeetingEnd) {
          if (accumulatedChars < minMeaningfulChars || newChars === 0) {
            console.log(
              `[Relay AI] Room ${roomName}: Final summary skipped - transcript too brief (${accumulatedChars} total chars, ${newChars} new chars).`
            );
            return;
          }
        } else if (newChars < threshold) {
          console.log(
            `[Relay AI] Room ${roomName}: Summary skipped - insufficient new transcript (${newChars}/${threshold} chars).`
          );
          return;
        }
      } else {
        // Forced trigger (e.g. manual button click)
        if (accumulatedChars < minMeaningfulChars) {
          console.log(
            `[Relay AI] Room ${roomName}: Manual summary skipped - transcript too brief (${accumulatedChars} chars).`
          );
          return;
        }
      }

      console.log(
        `[Relay AI] Room ${roomName}: Triggering summarization (accumulated ${newChars} new chars, ${accumulatedChars} total, current version: ${state.summaryCount}).`
      );

      await upsertAIState(roomName, { summaryStatus: AI_STATUS.SUMMARIZING });
      this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, {
        roomName,
        summaryStatus: AI_STATUS.SUMMARIZING,
      });

      const previousSummary = await getLatestSummary(roomName);
      const previousCreatedAt = previousSummary?.createdAt
        ? new Date(previousSummary.createdAt).getTime()
        : 0;

      // When an earlier summary exists, pass new transcripts since that summary
      const filtered = previousSummary
        ? allTranscripts.filter(t => new Date(t.createdAt).getTime() > previousCreatedAt)
        : allTranscripts;
      const newTranscripts = (filtered && filtered.length > 0) ? filtered : allTranscripts;

      if (!newTranscripts || newTranscripts.length === 0) {
        console.log(`[Relay AI] Room ${roomName}: Summary skipped - no new transcript segments since last summary.`);
        await upsertAIState(roomName, { summaryStatus: AI_STATUS.IDLE });
        this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, {
          roomName,
          summaryStatus: AI_STATUS.IDLE,
        });
        return;
      }

      const summaryResult = await generateSummary({
        roomName,
        previousSummary,
        newTranscripts,
      });

      if (summaryResult.paused) {
        console.warn(
          `[Relay AI] Room ${roomName}: Summarization paused (${summaryResult.reason || 'quota_exhausted'}).`
        );
        await upsertAIState(roomName, {
          summaryStatus: AI_STATUS.PAUSED,
          pauseReason: summaryResult.reason || 'quota_exhausted',
        });
        this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, {
          roomName,
          summaryStatus: AI_STATUS.PAUSED,
          pauseReason: summaryResult.message,
        });
        return;
      }

      if (summaryResult.ok) {
        const saved = await saveSummary({
          roomName,
          summaryText: summaryResult.summary,
          keyPoints: summaryResult.keyPoints,
          decisions: summaryResult.decisions,
          actionItems: summaryResult.actionItems,
          workAllocation: summaryResult.workAllocation || [],
          unresolvedQuestions: summaryResult.unresolvedQuestions || [],
          providerUsed: summaryResult.providerUsed,
          modelUsed: summaryResult.modelUsed,
          charCountCovered: accumulatedChars,
        });

        console.log(
          `[Relay AI] Room ${roomName}: Successfully generated and persisted summary v${saved.version} via ${saved.providerUsed} (${saved.modelUsed}).`
        );

        this.broadcast(roomName, AI_EVENTS.SUMMARY_UPDATE, saved);
        this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, {
          roomName,
          summaryStatus: AI_STATUS.IDLE,
          latestSummary: saved,
        });

        return saved;
      }
      return null;
    } catch (err) {
      console.error(`[Relay AI] Summarization error for room ${roomName}:`, err.message);
      await upsertAIState(roomName, { summaryStatus: AI_STATUS.IDLE });
      this.broadcast(roomName, AI_EVENTS.STATUS_UPDATE, {
        roomName,
        summaryStatus: AI_STATUS.IDLE,
      });
    } finally {
      roomSummaryLocks.delete(roomName);
    }
  }
}

export const aiManager = new AIManager();
