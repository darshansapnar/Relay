import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getAIState,
  upsertAIState,
  saveTranscript,
  getTranscripts,
  saveSummary,
  getLatestSummary,
  clearAIRoomData,
} from './aiRepo.js';
import { closePool } from './index.js';
import { config } from '../config/index.js';

describe('aiRepo PostgreSQL repository', () => {
  const roomName = 'test-ai-repo-room';

  beforeAll(async () => {
    if (!config.database.isConfigured) return;
    await clearAIRoomData(roomName);
  });

  afterAll(async () => {
    if (!config.database.isConfigured) return;
    await clearAIRoomData(roomName);
    await closePool();
  });

  beforeEach(async () => {
    if (!config.database.isConfigured) return;
    await clearAIRoomData(roomName);
  });

  it('manages AI state lifecycle and consent', async () => {
    if (!config.database.isConfigured) return;

    // Default initial state
    const initial = await getAIState(roomName);
    expect(initial).toBeDefined();
    expect(initial.isActive).toBe(false);
    expect(initial.consentGranted).toBe(false);

    // Update consent and active status
    const updated = await upsertAIState(roomName, {
      consentGranted: true,
      isActive: true,
      transcriptionStatus: 'active',
      summaryStatus: 'active',
    });

    expect(updated.consentGranted).toBe(true);
    expect(updated.isActive).toBe(true);
    expect(updated.transcriptionStatus).toBe('active');

    // Fetch again
    const fetched = await getAIState(roomName);
    expect(fetched.consentGranted).toBe(true);
    expect(fetched.isActive).toBe(true);
  });

  it('persists and retrieves chronological transcripts with speaker attribution', async () => {
    if (!config.database.isConfigured) return;

    const seg1 = await saveTranscript({
      roomName,
      speakerIdentity: 'user-alice',
      speakerName: 'Alice',
      text: 'Good morning everyone, let us discuss the Q3 roadmap.',
      startTimeMs: 1000,
      endTimeMs: 4000,
    });

    expect(seg1.id).toBeDefined();
    expect(seg1.speakerName).toBe('Alice');
    expect(seg1.text).toContain('Q3 roadmap');

    const seg2 = await saveTranscript({
      roomName,
      speakerIdentity: 'user-bob',
      speakerName: 'Bob',
      text: 'I agree Alice, we need to finalize the database migration first.',
      startTimeMs: 4500,
      endTimeMs: 8000,
    });

    expect(seg2.speakerName).toBe('Bob');

    // Retrieve transcripts
    const list = await getTranscripts(roomName);
    expect(list.length).toBe(2);
    expect(list[0].speakerName).toBe('Alice');
    expect(list[1].speakerName).toBe('Bob');

    // Check that total characters accumulated
    const state = await getAIState(roomName);
    expect(state.totalTranscriptChars).toBe(seg1.text.length + seg2.text.length);
  });

  it('persists versioned summaries with key points, decisions, and action items', async () => {
    if (!config.database.isConfigured) return;

    const summary1 = await saveSummary({
      roomName,
      summaryText: 'Initial team alignment on roadmap priorities.',
      keyPoints: ['Database migration is prerequisite', 'Frontend release scheduled'],
      decisions: ['Agreed to use Neon PostgreSQL'],
      actionItems: [{ task: 'Complete migration script', assignee: 'Bob' }],
      providerUsed: 'groq',
      modelUsed: 'llama-3.3-70b-versatile',
      charCountCovered: 1500,
    });

    expect(summary1.version).toBe(1);
    expect(summary1.summaryText).toContain('roadmap priorities');
    expect(summary1.actionItems.length).toBe(1);
    expect(summary1.actionItems[0].assignee).toBe('Bob');

    const summary2 = await saveSummary({
      roomName,
      summaryText: 'Updated summary incorporating security review.',
      keyPoints: ['Security review approved', 'SSL mode enabled'],
      decisions: ['Agreed to use Neon PostgreSQL', 'Enable connection pooling'],
      actionItems: [
        { task: 'Complete migration script', assignee: 'Bob' },
        { task: 'Audit API endpoints', assignee: 'Alice' },
      ],
      providerUsed: 'groq',
      modelUsed: 'llama-3.3-70b-versatile',
      charCountCovered: 3200,
    });

    expect(summary2.version).toBe(2);

    const latest = await getLatestSummary(roomName);
    expect(latest.version).toBe(2);
    expect(latest.summaryText).toContain('security review');
    expect(latest.actionItems.length).toBe(2);

    const state = await getAIState(roomName);
    expect(state.summaryCount).toBe(2);
    expect(state.lastSummarizedCharCount).toBe(3200);
  });
});
