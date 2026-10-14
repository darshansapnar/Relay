import { describe, expect, it, beforeEach } from 'vitest';
import {
  parseStructuredSummary,
  deduplicateActionItems,
  buildPrompt,
  chunkTranscripts,
  generateSummary,
  resetProviderState,
} from './aiSummarizer.js';
import { AI_MESSAGES } from '@relay/shared';

describe('aiSummarizer service', () => {
  beforeEach(() => {
    resetProviderState();
  });

  describe('parseStructuredSummary', () => {
    it('parses raw JSON string into rich structured summary object with all 6 sections', () => {
      const raw = JSON.stringify({
        summary: 'Team reviewed the Q4 roadmap and agreed to ship Relay Copilot.',
        keyPoints: ['Database migration completed', 'Frontend UI ready'],
        decisions: ['Agreed to use Neon PostgreSQL as primary database'],
        workAllocation: [
          {
            person: 'Sarah Chen',
            responsibilities: ['Oversee database architecture', 'Review pull requests'],
          },
          {
            person: 'Marcus Miller',
            responsibilities: ['Frontend integration'],
          },
        ],
        actionItems: [
          {
            task: 'Run integration tests',
            owner: 'Alice',
            deadline: 'Thursday 3:00 PM',
          },
        ],
        unresolvedQuestions: ['Should we enable auto-scaling on weekends?'],
      });

      const parsed = parseStructuredSummary(raw);
      expect(parsed.summary).toBe('Team reviewed the Q4 roadmap and agreed to ship Relay Copilot.');
      expect(parsed.keyPoints).toEqual(['Database migration completed', 'Frontend UI ready']);
      expect(parsed.decisions).toEqual(['Agreed to use Neon PostgreSQL as primary database']);
      expect(parsed.workAllocation).toHaveLength(2);
      expect(parsed.workAllocation[0].person).toBe('Sarah Chen');
      expect(parsed.workAllocation[0].responsibilities).toEqual([
        'Oversee database architecture',
        'Review pull requests',
      ]);
      expect(parsed.actionItems).toHaveLength(1);
      expect(parsed.actionItems[0].task).toBe('Run integration tests');
      expect(parsed.actionItems[0].owner).toBe('Alice');
      expect(parsed.actionItems[0].assignee).toBe('Alice');
      expect(parsed.actionItems[0].deadline).toBe('Thursday 3:00 PM');
      expect(parsed.unresolvedQuestions).toEqual(['Should we enable auto-scaling on weekends?']);
    });

    it('defaults missing deadlines and owners to "Not specified"', () => {
      const raw = JSON.stringify({
        summary: 'Discussion on project deliverables.',
        keyPoints: ['Initial setup'],
        decisions: ['Deploy to staging'],
        actionItems: [
          { task: 'Check error logs' }, // Missing owner and deadline
          'Write release notes', // Raw string format
        ],
      });

      const parsed = parseStructuredSummary(raw);
      expect(parsed.actionItems).toHaveLength(2);
      expect(parsed.actionItems[0].task).toBe('Check error logs');
      expect(parsed.actionItems[0].owner).toBe('Not specified');
      expect(parsed.actionItems[0].deadline).toBe('Not specified');

      expect(parsed.actionItems[1].task).toBe('Write release notes');
      expect(parsed.actionItems[1].owner).toBe('Not specified');
      expect(parsed.actionItems[1].deadline).toBe('Not specified');
    });

    it('strips markdown code blocks (```json ... ```) safely', () => {
      const raw =
        '```json\n{"summary":"Clean meeting","keyPoints":["Point A"],"decisions":[],"actionItems":[],"workAllocation":[],"unresolvedQuestions":[]}\n```';
      const parsed = parseStructuredSummary(raw);
      expect(parsed.summary).toBe('Clean meeting');
      expect(parsed.keyPoints).toEqual(['Point A']);
    });
  });

  describe('deduplicateActionItems', () => {
    it('deduplicates identical action items and upgrades "Not specified" deadline to explicit deadline', () => {
      const items = [
        { task: 'Deploy database migration', owner: 'Sarah', deadline: 'Not specified' },
        { task: 'Deploy database migration', owner: 'Sarah', deadline: 'Friday 5:00 PM' },
        { task: 'Write unit tests', owner: 'Bob', deadline: 'Tomorrow' },
      ];

      const deduped = deduplicateActionItems(items);
      expect(deduped).toHaveLength(2);

      const migrationItem = deduped.find(d => d.task === 'Deploy database migration');
      expect(migrationItem).toBeDefined();
      expect(migrationItem.owner).toBe('Sarah');
      expect(migrationItem.deadline).toBe('Friday 5:00 PM'); // Upgraded deadline!
    });
  });

  describe('chunkTranscripts', () => {
    it('splits long transcripts into sequential chunks without dropping segments', () => {
      const segments = [
        { id: '1', text: 'Sentence one with some detail.', startTimeMs: 1000 },
        { id: '2', text: 'Sentence two with more technical details.', startTimeMs: 5000 },
        { id: '3', text: 'Sentence three concluding the discussion.', startTimeMs: 9000 },
      ];

      // Set maxChars to 45 so segments get chunked into 2 batches
      const chunks = chunkTranscripts(segments, 45);
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      // Verify all segments are preserved across chunks
      const allText = chunks.flat().map(s => s.text);
      expect(allText).toContain('Sentence one with some detail.');
      expect(allText).toContain('Sentence two with more technical details.');
      expect(allText).toContain('Sentence three concluding the discussion.');
    });
  });

  describe('buildPrompt', () => {
    it('constructs prompt with full previous context and instructions to distinguish confirmed decisions', () => {
      const prevSummary = {
        summaryText: 'Earlier discussion on architecture.',
        keyPoints: ['Neon pooling evaluated'],
        decisions: ['Agreed to use PostgreSQL'],
        workAllocation: [{ person: 'Alice', responsibilities: ['Database setup'] }],
        actionItems: [{ task: 'Write schema', owner: 'Bob', deadline: 'Wednesday' }],
        unresolvedQuestions: ['What SSL mode to use?'],
      };

      const newTranscripts = [
        {
          speakerName: 'Charlie',
          text: 'We agreed to use verify-full SSL mode, and Sarah will verify connection pooling by Friday.',
          startTimeMs: 12000,
        },
      ];

      const prompt = buildPrompt(prevSummary, newTranscripts);
      expect(prompt).toContain('PREVIOUS CUMULATIVE MEETING SUMMARY');
      expect(prompt).toContain('Earlier discussion on architecture.');
      expect(prompt).toContain('Agreed to use PostgreSQL');
      expect(prompt).toContain('Alice: Database setup');
      expect(prompt).toContain('Task: "Write schema", Owner: "Bob", Deadline: "Wednesday"');
      expect(prompt).toContain('What SSL mode to use?');
      expect(prompt).toContain('Charlie: We agreed to use verify-full SSL mode');
      expect(prompt).toContain('ONLY when they were explicitly agreed upon');
    });
  });

  describe('generateSummary with long transcripts, batching, and evolving meetings', () => {
    it('processes long transcripts in batches and combines extracted information into final summary', async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount += 1;
        if (callCount === 1) {
          // Summary of Batch 1
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      summary: 'Batch 1: Architecture review completed.',
                      keyPoints: ['Agreed on Neon PostgreSQL'],
                      decisions: ['Approved Neon DB migration'],
                      workAllocation: [
                        { person: 'Sarah', responsibilities: ['Database architecture'] },
                      ],
                      actionItems: [
                        { task: 'Set up database pooler', owner: 'Sarah', deadline: 'Friday' },
                      ],
                      unresolvedQuestions: ['Socket.IO authentication method'],
                    }),
                  },
                },
              ],
            }),
          };
        } else {
          // Summary of Batch 2 combining Batch 1 context + Batch 2 discussion
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      summary:
                        'Batch 2: Full team aligned on Neon DB and resolved Socket.IO authentication.',
                      keyPoints: [
                        'Agreed on Neon PostgreSQL',
                        'Resolved Socket.IO token authentication',
                      ],
                      decisions: [
                        'Approved Neon DB migration',
                        'Confirmed JWT token validation on socket handshake',
                      ],
                      workAllocation: [
                        { person: 'Sarah', responsibilities: ['Database architecture'] },
                        { person: 'Marcus', responsibilities: ['Socket.IO integration'] },
                      ],
                      actionItems: [
                        { task: 'Set up database pooler', owner: 'Sarah', deadline: 'Friday' },
                        { task: 'Implement JWT socket auth', owner: 'Marcus', deadline: 'Monday' },
                      ],
                      unresolvedQuestions: [], // Answered!
                    }),
                  },
                },
              ],
            }),
          };
        }
      };

      const longTranscripts = [
        {
          speakerName: 'Sarah',
          text: 'We are evaluating the database performance on Neon PostgreSQL and connection pooling.',
          startTimeMs: 1000,
        },
        {
          speakerName: 'Sarah',
          text: 'The connection pool handles high concurrent socket connections seamlessly.',
          startTimeMs: 5000,
        },
        {
          speakerName: 'Marcus',
          text: 'Now regarding Socket.IO, we confirmed JWT token validation on handshake solves our security question.',
          startTimeMs: 10000,
        },
      ];

      // Force maxBatchChars low so it triggers 2 batches
      const res = await generateSummary({
        roomName: 'long-transcript-room',
        transcripts: longTranscripts,
        customFetch: mockFetch,
        forceProvider: 'groq',
        maxBatchChars: 180, // partitions 3 segments (94, 76, 104 chars) into exactly 2 batches
      });

      expect(res.ok).toBe(true);
      expect(callCount).toBe(2);
      expect(res.summary).toContain('Full team aligned on Neon DB');
      expect(res.decisions).toContain('Approved Neon DB migration');
      expect(res.decisions).toContain('Confirmed JWT token validation on socket handshake');
      expect(res.workAllocation).toHaveLength(2);
      expect(res.actionItems).toHaveLength(2);
      expect(res.actionItems[0].deadline).toBe('Friday');
      expect(res.actionItems[1].deadline).toBe('Monday');
    });

    it('uses Groq when healthy and successful', async () => {
      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Groq generated summary',
                  keyPoints: ['Groq point'],
                  decisions: ['Agreed on feature'],
                  workAllocation: [{ person: 'Alice', responsibilities: ['Testing'] }],
                  actionItems: [{ task: 'Test pipeline', owner: 'Alice', deadline: 'Tomorrow' }],
                  unresolvedQuestions: [],
                }),
              },
            },
          ],
        }),
      });

      const res = await generateSummary({
        roomName: 'room-1',
        newTranscripts: [{ speakerName: 'Alice', text: 'Hello', startTimeMs: 0 }],
        customFetch: mockFetch,
        forceProvider: 'groq',
      });

      expect(res.ok).toBe(true);
      expect(res.providerUsed).toBe('groq');
      expect(res.summary).toBe('Groq generated summary');
      expect(res.workAllocation[0].person).toBe('Alice');
      expect(res.actionItems[0].owner).toBe('Alice');
      expect(res.actionItems[0].deadline).toBe('Tomorrow');
    });

    it('falls back to Gemini when Groq fails with an eligible server error', async () => {
      let groqCalled = false;
      let geminiCalled = false;

      const mockFetch = async url => {
        if (url.includes('groq.com')) {
          groqCalled = true;
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: async () => ({ error: { message: 'Groq temporarily down' } }),
          };
        }
        if (url.includes('generativelanguage.googleapis.com')) {
          geminiCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          summary: 'Gemini fallback summary',
                          keyPoints: ['Gemini point'],
                          decisions: ['Agreed via Gemini'],
                          workAllocation: [{ person: 'Bob', responsibilities: ['Fallback lead'] }],
                          actionItems: [{ task: 'Check fallbacks', owner: 'Bob', deadline: 'Not specified' }],
                          unresolvedQuestions: [],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      };

      const res = await generateSummary({
        roomName: 'room-1',
        newTranscripts: [{ speakerName: 'Alice', text: 'Hello', startTimeMs: 0 }],
        customFetch: mockFetch,
      });

      expect(groqCalled).toBe(true);
      expect(geminiCalled).toBe(true);
      expect(res.ok).toBe(true);
      expect(res.providerUsed).toBe('gemini');
      expect(res.summary).toBe('Gemini fallback summary');
      expect(res.workAllocation[0].person).toBe('Bob');
      expect(res.actionItems[0].deadline).toBe('Not specified');
    });

    it('pauses gracefully with exact user-facing message when both Groq and Gemini quotas are exhausted', async () => {
      const mockFetch = async url => {
        if (url.includes('groq.com')) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              error: { code: 'insufficient_quota', message: 'Quota exceeded on Groq' },
            }),
          };
        }
        if (url.includes('generativelanguage.googleapis.com')) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              error: { message: 'Resource has been exhausted (quota exceeded)' },
            }),
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      };

      const res = await generateSummary({
        roomName: 'room-1',
        newTranscripts: [{ speakerName: 'Alice', text: 'Hello', startTimeMs: 0 }],
        customFetch: mockFetch,
      });

      expect(res.ok).toBe(false);
      expect(res.paused).toBe(true);
      expect(res.reason).toBe('quota_exhausted');
      expect(res.message).toBe(AI_MESSAGES.SUMMARY_PAUSED_QUOTA);
      expect(res.message).toBe(
        'AI summaries are paused because the free-tier limit has been reached. Your meeting can continue normally.'
      );
    });
  });
});
