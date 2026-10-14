import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  stitchAndDeduplicate,
} from './aiTranscriptDeduplicator.js';

describe('aiTranscriptDeduplicator', () => {
  describe('normalizeText', () => {
    it('lowercases, strips punctuation and collapses whitespace', () => {
      expect(normalizeText('Hello, World!   How are you?')).toBe('hello world how are you');
      expect(normalizeText("That's all from my side. Thank you.")).toBe('thats all from my side thank you');
    });

    it('handles empty or null input gracefully', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });
  });

  describe('stitchAndDeduplicate', () => {
    it('passes through first segment without modification', () => {
      const result = stitchAndDeduplicate({
        lastSegment: null,
        text: 'Welcome to today’s meeting.',
        speakerIdentity: 'user-1',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.text).toBe('Welcome to today’s meeting.');
      expect(result.trimmedWordsCount).toBe(0);
    });

    it('discards exact duplicates from reconnections, retries, or duplicate streams', () => {
      const last = {
        text: 'Today I want to talk about technology, innovation and AI.',
        speakerIdentity: 'user-1',
        endTimeMs: 6000,
      };

      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'Today I want to talk about technology, innovation and AI.',
        speakerIdentity: 'user-1',
        startTimeMs: 6000,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.text).toBe('');
    });

    it('discards duplicate chunks with minor punctuation or casing variations', () => {
      const last = {
        text: 'Recently, I have been working on a project called Relay.',
        speakerIdentity: 'user-1',
        endTimeMs: 6000,
      };

      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'Recently I have been working on a project called Relay',
        speakerIdentity: 'user-1',
        startTimeMs: 6050,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.text).toBe('');
    });

    it('discards segments that are completely contained within previous segment', () => {
      const last = {
        text: 'Platform. The goal is to make online meetings more productive by automatically generating summaries.',
        speakerIdentity: 'user-1',
        endTimeMs: 12000,
      };

      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'The goal is to make online meetings more productive by automatically generating',
        speakerIdentity: 'user-1',
        startTimeMs: 12050,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.text).toBe('');
    });

    it('trims boundary overlap across consecutive chunks from the same speaker', () => {
      const last = {
        text: 'Recently I have been working on a project called Relay, an AI-powered video conferencing',
        speakerIdentity: 'user-1',
        endTimeMs: 6000,
      };

      // Consecutive chunk re-states "video conferencing platform. The goal is..."
      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'video conferencing platform. The goal is to make online meetings more productive.',
        speakerIdentity: 'user-1',
        startTimeMs: 6000,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.trimmedWordsCount).toBe(2);
      expect(result.text).toBe('Platform. The goal is to make online meetings more productive.');
    });

    it('trims multi-word boundary overlap while preserving casing and punctuation', () => {
      const last = {
        text: 'The goal is to make online meeting more productive by automatically generating',
        speakerIdentity: 'user-1',
        endTimeMs: 12000,
      };

      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'by automatically generating future release should identify the important decision.',
        speakerIdentity: 'user-1',
        startTimeMs: 12000,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.trimmedWordsCount).toBe(3);
      expect(result.text).toBe('Future release should identify the important decision.');
    });

    it('does not deduplicate across different speakers', () => {
      const last = {
        text: 'I agree with the roadmap.',
        speakerIdentity: 'user-1',
        endTimeMs: 6000,
      };

      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'I agree with the roadmap.',
        speakerIdentity: 'user-2', // Different speaker
        startTimeMs: 6500,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.text).toBe('I agree with the roadmap.');
    });

    it('preserves legitimate repeated words within an utterance', () => {
      const result = stitchAndDeduplicate({
        lastSegment: null,
        text: 'No, no, no, that is not the right approach.',
        speakerIdentity: 'user-1',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.text).toBe('No, no, no, that is not the right approach.');
    });

    it('does not trim overlap if chunks are far apart in time (different conversational turns)', () => {
      const last = {
        text: 'Thank you.',
        speakerIdentity: 'user-1',
        endTimeMs: 5000,
      };

      const result = stitchAndDeduplicate({
        lastSegment: last,
        text: 'Thank you for having me.',
        speakerIdentity: 'user-1',
        startTimeMs: 60000, // 55 seconds later
        timeDeltaMs: 55000,
      });

      // Because timeDelta is > 15s, it is a new sentence, not chunk boundary ASR overlap
      expect(result.isDuplicate).toBe(false);
      expect(result.text).toBe('Thank you for having me.');
    });
  });
});
