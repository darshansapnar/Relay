import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AIManager } from './aiManager.js';
import { clearAIRoomData, getAIState } from '../db/aiRepo.js';
import { config } from '../config/index.js';
vi.mock('./aiSummarizer.js', () => ({
  generateSummary: vi.fn().mockResolvedValue({
    ok: true,
    summary: 'Executive meeting summary.',
    keyPoints: ['Key milestone completed'],
    decisions: ['Approved deployment'],
    workAllocation: [{ person: 'Bob', responsibilities: ['Deploy code'] }],
    actionItems: [{ task: 'Deploy code', owner: 'Bob', assignee: 'Bob', deadline: 'Friday' }],
    unresolvedQuestions: ['Rollback plan?'],
    providerUsed: 'groq',
    modelUsed: 'openai/gpt-oss-120b',
  }),
  resetProviderState: vi.fn(),
}));

describe('AIManager service and cost controls', () => {
  const roomName = 'test-ai-manager-room';
  let mockIO;
  let broadcastEvents;
  let aiManager;

  beforeEach(async () => {
    broadcastEvents = [];
    mockIO = {
      to: vi.fn().mockImplementation(room => ({
        emit: vi.fn().mockImplementation((event, data) => {
          broadcastEvents.push({ room, event, data });
        }),
      })),
    };

    aiManager = new AIManager(mockIO);
    await clearAIRoomData(roomName);
  });

  afterEach(async () => {
    await clearAIRoomData(roomName);
  });

  it('enforces participant consent before activating AI assistant', async () => {
    const res = await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: false,
      requestedByIdentity: 'alice',
      requestedByName: 'Alice',
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('consent is required');

    const state = await getAIState(roomName);
    expect(state.isActive).toBe(false);
  });

  it('activates AI assistant and broadcasts state update when consent is granted', async () => {
    const res = await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
      requestedByIdentity: 'alice',
      requestedByName: 'Alice',
    });

    expect(res.ok).toBe(true);
    expect(res.state.isActive).toBe(true);
    expect(res.state.consentGranted).toBe(true);

    const broadcast = broadcastEvents.find(e => e.event === 'ai:statusUpdate');
    expect(broadcast).toBeDefined();
    expect(broadcast.data.isActive).toBe(true);
  });

  it('persists transcript segments and broadcasts ai:transcriptChunk', async () => {
    // Activate AI
    await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
      requestedByIdentity: 'alice',
      requestedByName: 'Alice',
    });

    const segment = await aiManager.handleTranscriptSegment({
      roomName,
      speakerIdentity: 'bob',
      speakerName: 'Bob',
      text: 'Let us deploy the database index.',
      startTimeMs: 1000,
      endTimeMs: 3000,
    });

    expect(segment).toBeDefined();
    expect(segment.text).toBe('Let us deploy the database index.');

    const broadcast = broadcastEvents.find(e => e.event === 'ai:transcriptChunk');
    expect(broadcast).toBeDefined();
    expect(broadcast.data.text).toBe('Let us deploy the database index.');
  });

  it('does not block the first summary with cooldown and triggers when threshold is reached', async () => {
    const { generateSummary } = await import('./aiSummarizer.js');
    generateSummary.mockClear();

    await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
      requestedByIdentity: 'alice',
      requestedByName: 'Alice',
    });

    // Add transcript segment exceeding threshold (> 400 chars)
    const longText = 'This is a comprehensive discussion about migrating database architecture to Neon PostgreSQL with serverless connection pooling. We also reviewed frontend performance optimization and agreed to ship the simplified two-tab AI assistant interface with live transcript and cumulative summary views before Friday. Additionally, all team members agreed on maintaining strict cost controls and graceful fallback mechanisms across Groq and Gemini models.';
    expect(longText.length).toBeGreaterThan(config.ai.summaryMinChars);

    await aiManager.handleTranscriptSegment({
      roomName,
      speakerIdentity: 'alice',
      speakerName: 'Alice',
      text: longText,
      startTimeMs: 1000,
      endTimeMs: 10000,
    });

    // Await background summarization triggered by handleTranscriptSegment
    if (aiManager.lastSummaryPromise) {
      await aiManager.lastSummaryPromise;
    }

    expect(generateSummary).toHaveBeenCalledTimes(1);

    const summaryBroadcast = broadcastEvents.find(e => e.event === 'ai:summaryUpdate');
    expect(summaryBroadcast).toBeDefined();
    expect(summaryBroadcast.data.summaryText).toBe('Executive meeting summary.');
    expect(summaryBroadcast.data.workAllocation).toEqual([
      { person: 'Bob', responsibilities: ['Deploy code'] },
    ]);
    expect(summaryBroadcast.data.unresolvedQuestions).toEqual(['Rollback plan?']);
    expect(summaryBroadcast.data.actionItems[0].deadline).toBe('Friday');

    const state = await getAIState(roomName);
    expect(state.summaryCount).toBe(1);
  });

  it('skips summary when accumulated new transcript is below threshold', async () => {
    const { generateSummary } = await import('./aiSummarizer.js');
    generateSummary.mockClear();

    await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
    });

    // Short transcript below threshold
    await aiManager.handleTranscriptSegment({
      roomName,
      speakerIdentity: 'alice',
      speakerName: 'Alice',
      text: 'Short statement.',
      startTimeMs: 1000,
      endTimeMs: 2000,
    });

    if (aiManager.lastSummaryPromise) {
      await aiManager.lastSummaryPromise;
    }

    expect(generateSummary).not.toHaveBeenCalled();
    const summaryBroadcast = broadcastEvents.find(e => e.event === 'ai:summaryUpdate');
    expect(summaryBroadcast).toBeUndefined();
  });

  it('triggers final summary on meeting end if transcript has >= 80 chars', async () => {
    const { generateSummary } = await import('./aiSummarizer.js');
    generateSummary.mockClear();

    await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
    });

    // Transcript with ~120 chars: below regular 400-char threshold but above 80-char meeting end threshold
    const meetingEndText = 'We wrapped up the meeting early after confirming that all database health checks and integration tests passed smoothly.';
    expect(meetingEndText.length).toBeGreaterThanOrEqual(80);
    expect(meetingEndText.length).toBeLessThan(config.ai.summaryMinChars);

    await aiManager.handleTranscriptSegment({
      roomName,
      speakerIdentity: 'bob',
      speakerName: 'Bob',
      text: meetingEndText,
      startTimeMs: 0,
      endTimeMs: 5000,
    });

    if (aiManager.lastSummaryPromise) {
      await aiManager.lastSummaryPromise;
    }
    expect(generateSummary).not.toHaveBeenCalled();

    // On meeting end, it should trigger
    await aiManager.maybeTriggerSummary(roomName, { isMeetingEnd: true });

    expect(generateSummary).toHaveBeenCalledTimes(1);
    const summaryBroadcast = broadcastEvents.find(e => e.event === 'ai:summaryUpdate');
    expect(summaryBroadcast).toBeDefined();
  });

  it('skips final summary on meeting end if transcript is too brief (< 80 chars)', async () => {
    const { generateSummary } = await import('./aiSummarizer.js');
    generateSummary.mockClear();

    await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
    });

    // Very brief transcript
    await aiManager.handleTranscriptSegment({
      roomName,
      speakerIdentity: 'bob',
      speakerName: 'Bob',
      text: 'Goodbye.',
      startTimeMs: 0,
      endTimeMs: 1000,
    });

    await aiManager.maybeTriggerSummary(roomName, { isMeetingEnd: true });

    expect(generateSummary).not.toHaveBeenCalled();
  });

  it('respects hard cost limit: max summaries per meeting', async () => {
    // Seed AI state with summaryCount = maxSummariesPerMeeting
    const origMax = config.ai.maxSummariesPerMeeting;
    config.ai.maxSummariesPerMeeting = 2;

    await aiManager.toggleAIState(roomName, {
      isActive: true,
      consentGranted: true,
    });

    // Manually set summaryCount to limit
    const { upsertAIState } = await import('../db/aiRepo.js');
    await upsertAIState(roomName, { summaryCount: 2 });

    // Try triggering summary
    await aiManager.maybeTriggerSummary(roomName);

    const state = await getAIState(roomName);
    expect(state.summaryCount).toBe(2);

    config.ai.maxSummariesPerMeeting = origMax;
  });
});
