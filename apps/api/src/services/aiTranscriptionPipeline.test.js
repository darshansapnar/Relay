import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aiManager } from './aiManager.js';
import { clearAIRoomData, getTranscripts, upsertAIState } from '../db/aiRepo.js';

describe('AI Transcription Pipeline End-to-End', () => {
  const testRoom = `test-pipe-${Date.now()}`;

  beforeEach(async () => {
    await clearAIRoomData(testRoom);
    await upsertAIState(testRoom, {
      isActive: true,
      consentGranted: true,
    });
  });

  afterEach(async () => {
    await clearAIRoomData(testRoom);
  });

  it('handles consecutive audio chunks containing a sentence that crosses a chunk boundary', async () => {
    // Chunk 1 ends with "video conferencing"
    const chunk1Text =
      'Recently I have been working on a project called Relay, an AI-powered video conferencing';
    const seg1 = await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-alice',
      speakerName: 'Alice',
      text: chunk1Text,
      startTimeMs: 0,
      endTimeMs: 6000,
    });

    expect(seg1).toBeTruthy();
    expect(seg1.text).toBe(chunk1Text);
    expect(Number(seg1.startTimeMs)).toBe(0);
    expect(seg1.speakerName).toBe('Alice');

    // Chunk 2 crosses the boundary, starting with "video conferencing platform..."
    const chunk2Text =
      'video conferencing platform. The goal is to make online meetings more productive.';
    const seg2 = await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-alice',
      speakerName: 'Alice',
      text: chunk2Text,
      startTimeMs: 6000,
      endTimeMs: 12000,
    });

    expect(seg2).toBeTruthy();
    // Overlapping words "video conferencing" trimmed, sentence capitalized
    expect(seg2.text).toBe(
      'Platform. The goal is to make online meetings more productive.'
    );
    expect(Number(seg2.startTimeMs)).toBe(6000);

    // Verify chronological order in database
    const allTranscripts = await getTranscripts(testRoom);
    expect(allTranscripts.length).toBe(2);
    expect(allTranscripts[0].text).toBe(chunk1Text);
    expect(allTranscripts[1].text).toBe(
      'Platform. The goal is to make online meetings more productive.'
    );
  });

  it('deduplicates identical chunks caused by reconnections or duplicate streams', async () => {
    const text = 'Welcome to today’s product review.';
    const seg1 = await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-bob',
      speakerName: 'Bob',
      text,
      startTimeMs: 0,
      endTimeMs: 6000,
    });

    expect(seg1).toBeTruthy();

    // Reconnection or duplicate chunk received with same text and timestamp
    const duplicateSeg = await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-bob',
      speakerName: 'Bob',
      text,
      startTimeMs: 0,
      endTimeMs: 6000,
    });

    // Should be detected as duplicate and discarded (returns null or duplicate)
    expect(duplicateSeg?.isDuplicate ? duplicateSeg.isDuplicate : duplicateSeg).toBeFalsy();

    const stored = await getTranscripts(testRoom);
    expect(stored.length).toBe(1);
  });

  it('normalizes raw epoch timestamps to elapsed meeting milliseconds', async () => {
    const epochNow = Date.now();
    const rawEpoch = epochNow + 5000;

    const seg = await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-charlie',
      speakerName: 'Charlie',
      text: 'Testing timestamp normalization from epoch values.',
      startTimeMs: rawEpoch,
      endTimeMs: rawEpoch + 6000,
    });

    expect(seg).toBeTruthy();
    // Timestamp stored must NOT be 1.7e12 (epoch value)
    expect(Number(seg.startTimeMs)).toBeLessThan(100000000);
    expect(Number(seg.startTimeMs)).toBeGreaterThanOrEqual(0);
  });

  it('assigns Unknown speaker when speaker name is unresolvable rather than inventing a name', async () => {
    const seg = await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-anon-999',
      speakerName: '',
      text: 'A question from an unidentified participant.',
      startTimeMs: 18000,
      endTimeMs: 24000,
    });

    expect(seg).toBeTruthy();
    expect(seg.speakerName).toBe('Unknown speaker');
  });

  it('ensures reloading transcripts retains chronological order and does not introduce duplicates', async () => {
    await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-alice',
      speakerName: 'Alice',
      text: 'Point 1: We should upgrade the database pool.',
      startTimeMs: 0,
      endTimeMs: 6000,
    });

    await aiManager.handleTranscriptSegment({
      roomName: testRoom,
      speakerIdentity: 'user-bob',
      speakerName: 'Bob',
      text: 'Point 2: Agreed on the upgrade.',
      startTimeMs: 6000,
      endTimeMs: 12000,
    });

    const firstLoad = await getTranscripts(testRoom);
    const secondLoad = await getTranscripts(testRoom);

    expect(firstLoad.length).toBe(2);
    expect(secondLoad.length).toBe(2);
    expect(firstLoad[0].id).toBe(secondLoad[0].id);
    expect(firstLoad[1].id).toBe(secondLoad[1].id);
    expect(Number(firstLoad[0].startTimeMs)).toBeLessThan(Number(firstLoad[1].startTimeMs));
  });
});
