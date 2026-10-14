import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  transcribeAudioChunk,
  transcriptionState,
  resetTranscriptionState,
} from './aiTranscription.js';
import { AI_MESSAGES } from '@relay/shared';
import { config } from '../config/index.js';

describe('aiTranscription service', () => {
  beforeEach(() => {
    resetTranscriptionState();
  });

  describe('Gemini Transcription Provider', () => {
    it('successfully transcribes an audio chunk using Gemini generateContent', async () => {
      const mockAudio = Buffer.from('fake-audio-chunk-data');
      let calledUrl = null;
      let calledBody = null;

      const mockFetch = async (url, options) => {
        calledUrl = url;
        calledBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'Hello team, let us review the sprint roadmap.',
                    },
                  ],
                },
              },
            ],
          }),
        };
      };

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        startTimeMs: 1000,
        endTimeMs: 4000,
        customFetch: mockFetch,
        forceProvider: 'gemini',
      });

      expect(result.ok).toBe(true);
      expect(result.text).toBe('Hello team, let us review the sprint roadmap.');
      expect(result.speakerName).toBe('Alice');
      expect(result.providerUsed).toBe('gemini');
      expect(result.modelUsed).toBe(config.ai.geminiTranscriptionModel);

      expect(calledUrl).toContain('generativelanguage.googleapis.com');
      expect(calledUrl).toContain(config.ai.geminiTranscriptionModel);
      expect(calledBody.contents[0].parts[0].inlineData.mimeType).toBe('audio/webm');
      expect(calledBody.contents[0].parts[0].inlineData.data).toBe(
        mockAudio.toString('base64')
      );
    });

    it('filters out silence and common hallucinations gracefully', async () => {
      const mockAudio = Buffer.from('silence-audio');

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: ' [Music] ' }],
              },
            },
          ],
        }),
      });

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        customFetch: mockFetch,
        forceProvider: 'gemini',
      });

      expect(result.ok).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.text).toBe('');
    });

    it('pauses transcription on 429 quota exhaustion and returns standard message', async () => {
      const mockAudio = Buffer.from('quota-test-audio');

      const mockFetch = async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 429,
            message: 'Resource has been exhausted (e.g. check quota).',
          },
        }),
      });

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        customFetch: mockFetch,
        forceProvider: 'gemini',
      });

      expect(result.ok).toBe(false);
      expect(result.paused).toBe(true);
      expect(result.reason).toBe('quota_exhausted');
      expect(result.message).toBe(AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA);
      expect(transcriptionState.quotaExhaustedUntil).toBeGreaterThan(Date.now());

      // Subsequent call while quota paused should return immediately without calling fetch
      const neverCalledFetch = vi.fn();
      const cachedResult = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        customFetch: neverCalledFetch,
        forceProvider: 'gemini',
      });

      expect(cachedResult.paused).toBe(true);
      expect(cachedResult.message).toBe(AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA);
      expect(neverCalledFetch).not.toHaveBeenCalled();
    });

    it('falls back to gemini-3.5-flash-lite when gemini-3.5-transcribe returns 503 high demand', async () => {
      const mockAudio = Buffer.from('test-audio');
      const calledModels = [];

      const mockFetch = async url => {
        if (url.includes('gemini-3.5-transcribe')) {
          calledModels.push('gemini-3.5-transcribe');
          return {
            ok: false,
            status: 503,
            json: async () => ({
              error: {
                code: 503,
                message:
                  'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
              },
            }),
          };
        }

        if (url.includes('gemini-3.5-flash-lite')) {
          calledModels.push('gemini-3.5-flash-lite');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Fallback transcription successfully completed.' }],
                  },
                },
              ],
            }),
          };
        }

        return { ok: false, status: 404 };
      };

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        customFetch: mockFetch,
        forceProvider: 'gemini',
      });

      expect(result.ok).toBe(true);
      expect(result.text).toBe('Fallback transcription successfully completed.');
      expect(result.modelUsed).toBe('gemini-3.5-flash-lite');
      expect(result.fallbackFrom).toBe('gemini-3.5-transcribe');
      expect(calledModels).toContain('gemini-3.5-transcribe');
      expect(calledModels).toContain('gemini-3.5-flash-lite');
    });

    it('falls back to gemini-3.5-flash-lite when gemini-3.5-transcribe returns 429 rate limit', async () => {
      const mockAudio = Buffer.from('test-audio');
      const calledModels = [];

      const mockFetch = async url => {
        if (url.includes('gemini-3.5-transcribe')) {
          calledModels.push('gemini-3.5-transcribe');
          return {
            ok: false,
            status: 429,
            json: async () => ({
              error: {
                code: 429,
                message:
                  'Resource has been exhausted (e.g. check quota for gemini-3.5-transcribe).',
              },
            }),
          };
        }

        if (url.includes('gemini-3.5-flash-lite')) {
          calledModels.push('gemini-3.5-flash-lite');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Transcription rescued by fallback flash-lite.' }],
                  },
                },
              ],
            }),
          };
        }

        return { ok: false, status: 404 };
      };

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        customFetch: mockFetch,
        forceProvider: 'gemini',
      });

      expect(result.ok).toBe(true);
      expect(result.text).toBe('Transcription rescued by fallback flash-lite.');
      expect(result.modelUsed).toBe('gemini-3.5-flash-lite');
      expect(result.fallbackFrom).toBe('gemini-3.5-transcribe');
      expect(calledModels).toContain('gemini-3.5-transcribe');
      expect(calledModels).toContain('gemini-3.5-flash-lite');
    });

    it('handles transient 503 high demand response when all models fail without crashing', async () => {
      const mockAudio = Buffer.from('test-audio');
      let callCount = 0;

      const mockFetch = async () => {
        callCount += 1;
        return {
          ok: false,
          status: 503,
          json: async () => ({
            error: {
              code: 503,
              message:
                'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
            },
          }),
        };
      };

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-1',
        speakerName: 'Alice',
        customFetch: mockFetch,
        forceProvider: 'gemini',
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(503);
      expect(result.error).toContain('high demand');
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Groq Transcription Fallback Provider', () => {
    it('transcribes using Groq Whisper when configured or forced', async () => {
      const mockAudio = Buffer.from('groq-audio-data');
      let calledUrl = null;

      const mockFetch = async (url) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: 'Groq transcription successfully processed.',
          }),
        };
      };

      const result = await transcribeAudioChunk({
        audioData: mockAudio,
        speakerIdentity: 'user-2',
        speakerName: 'Bob',
        customFetch: mockFetch,
        forceProvider: 'groq',
      });

      expect(result.ok).toBe(true);
      expect(result.text).toBe('Groq transcription successfully processed.');
      expect(result.providerUsed).toBe('groq');
      expect(calledUrl).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    });
  });
});
