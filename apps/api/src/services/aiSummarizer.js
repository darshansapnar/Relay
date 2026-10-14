import { config } from '../config/index.js';
import { AI_MESSAGES } from '@relay/shared';

export const BATCH_MAX_CHARS = 12000;

/**
 * Tracks server-side health and usage for LLM providers.
 */
export const providerState = {
  groq: {
    consecutiveErrors: 0,
    quotaExhaustedUntil: null,
    lastUsedAt: null,
    totalCalls: 0,
  },
  gemini: {
    consecutiveErrors: 0,
    quotaExhaustedUntil: null,
    lastUsedAt: null,
    totalCalls: 0,
  },
};

/**
 * Resets provider tracking state (useful for tests and manual administrative resets).
 */
export const resetProviderState = () => {
  providerState.groq = {
    consecutiveErrors: 0,
    quotaExhaustedUntil: null,
    lastUsedAt: null,
    totalCalls: 0,
  };
  providerState.gemini = {
    consecutiveErrors: 0,
    quotaExhaustedUntil: null,
    lastUsedAt: null,
    totalCalls: 0,
  };
};

/**
 * Deduplicates action items across iterations or duplicate LLM outputs.
 * Normalizes task and owner, retains explicit deadlines over "Not specified",
 * and ensures backward-compatible assignee and owner properties.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export const deduplicateActionItems = (items = []) => {
  if (!Array.isArray(items)) return [];
  const map = new Map();

  for (const item of items) {
    if (!item) continue;
    const taskClean = String(item.task || item.item || item.description || '').trim();
    if (!taskClean) continue;

    const rawOwner = item.owner || item.assignee || item.person || '';
    const ownerClean = String(rawOwner).trim() || 'Not specified';
    const rawDeadline = item.deadline || item.due || item.dueDate || item.targetDate || '';
    const deadlineClean = String(rawDeadline).trim() || 'Not specified';

    // Key on normalized owner + normalized task text
    const normTask = taskClean
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const normKey = `${ownerClean.toLowerCase()}:::${normTask}`;

    if (!map.has(normKey)) {
      map.set(normKey, {
        task: taskClean,
        owner: ownerClean,
        assignee: ownerClean, // Backward compatibility
        deadline: deadlineClean,
      });
    } else {
      const existing = map.get(normKey);
      // Upgrade deadline if existing was "Not specified" and incoming has a specified deadline
      if (existing.deadline === 'Not specified' && deadlineClean !== 'Not specified') {
        existing.deadline = deadlineClean;
      }
      // Retain more descriptive task description if available
      if (taskClean.length > existing.task.length) {
        existing.task = taskClean;
      }
    }
  }

  return Array.from(map.values());
};

/**
 * Safely parses JSON response from LLM output, stripping markdown fences if present.
 * Normalizes all required structured summary fields:
 * - summary (overview)
 * - keyPoints
 * - decisions (confirmed only)
 * - workAllocation (person + responsibilities)
 * - actionItems (task, owner, deadline)
 * - unresolvedQuestions (open questions and follow-ups)
 *
 * @param {string} text
 * @returns {object}
 */
export const parseStructuredSummary = text => {
  if (!text) {
    throw new Error('Empty response from LLM');
  }

  let cleaned = String(text).trim();

  // Strip markdown code fences if model returned ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.slice(firstBrace, lastBrace + 1);
      parsed = JSON.parse(extracted);
    } else {
      throw new Error('Failed to parse JSON from LLM output');
    }
  }

  // Parse raw action items
  const rawActionItems = Array.isArray(parsed.actionItems)
    ? parsed.actionItems
        .map(a => {
          if (typeof a === 'string') {
            return {
              task: a.trim(),
              owner: 'Not specified',
              assignee: 'Not specified',
              deadline: 'Not specified',
            };
          }
          if (typeof a === 'object' && a !== null) {
            const task = String(a.task || a.item || a.description || '').trim();
            const rawOwner = a.owner || a.assignee || a.person || '';
            const owner = String(rawOwner).trim() || 'Not specified';
            const rawDeadline = a.deadline || a.due || a.dueDate || a.targetDate || '';
            const deadline = String(rawDeadline).trim() || 'Not specified';
            return {
              task,
              owner,
              assignee: owner,
              deadline,
            };
          }
          return null;
        })
        .filter(a => a && a.task)
    : [];

  // Parse work allocation (person + responsibilities)
  const rawWorkAllocation = Array.isArray(parsed.workAllocation)
    ? parsed.workAllocation
        .map(w => {
          if (typeof w === 'object' && w !== null) {
            const person = String(w.person || w.name || w.owner || '').trim();
            const rawResp = w.responsibilities || w.tasks || w.roles || [];
            const responsibilities = Array.isArray(rawResp)
              ? rawResp.map(r => String(r).trim()).filter(Boolean)
              : typeof rawResp === 'string' && rawResp.trim()
                ? [rawResp.trim()]
                : [];
            if (person) {
              return { person, responsibilities };
            }
          }
          return null;
        })
        .filter(Boolean)
    : [];

  // Parse unresolved questions and follow-ups
  const rawUnresolved = Array.isArray(parsed.unresolvedQuestions)
    ? parsed.unresolvedQuestions.map(q => String(q).trim()).filter(Boolean)
    : Array.isArray(parsed.followUps)
      ? parsed.followUps.map(q => String(q).trim()).filter(Boolean)
      : Array.isArray(parsed.unresolved)
        ? parsed.unresolved.map(q => String(q).trim()).filter(Boolean)
        : [];

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map(p => String(p).trim()).filter(Boolean)
      : [],
    decisions: Array.isArray(parsed.decisions)
      ? parsed.decisions.map(d => String(d).trim()).filter(Boolean)
      : [],
    workAllocation: rawWorkAllocation,
    actionItems: deduplicateActionItems(rawActionItems),
    unresolvedQuestions: rawUnresolved,
  };
};

/**
 * Constructs prompt content combining previous cumulative summary and transcript segments.
 * Explicitly instructs the LLM on all requirements: overview, key points, confirmed decisions only,
 * work allocation by person, action items with deadline/owner, and unresolved questions.
 *
 * @param {object | null} previousSummary
 * @param {Array<object>} transcripts
 * @returns {string}
 */
export const buildPrompt = (previousSummary, transcripts = []) => {
  const transcriptLines = transcripts
    .map(t => {
      const timeSec = Math.round((t.startTimeMs || 0) / 1000);
      const mm = String(Math.floor(timeSec / 60)).padStart(2, '0');
      const ss = String(timeSec % 60).padStart(2, '0');
      const speaker = t.speakerName || t.speakerIdentity || 'Speaker';
      return `[${mm}:${ss}] ${speaker}: ${t.text}`;
    })
    .join('\n');

  let prompt = '';

  if (previousSummary && previousSummary.summaryText) {
    prompt += `=== PREVIOUS CUMULATIVE MEETING SUMMARY ===\n`;
    prompt += `OVERVIEW:\n${previousSummary.summaryText}\n\n`;

    if (previousSummary.keyPoints && previousSummary.keyPoints.length > 0) {
      prompt += `PREVIOUS KEY POINTS:\n${previousSummary.keyPoints.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    if (previousSummary.decisions && previousSummary.decisions.length > 0) {
      prompt += `PREVIOUS CONFIRMED DECISIONS:\n${previousSummary.decisions.map(d => `- ${d}`).join('\n')}\n\n`;
    }

    if (previousSummary.workAllocation && previousSummary.workAllocation.length > 0) {
      prompt += `PREVIOUS WORK ALLOCATION:\n${previousSummary.workAllocation
        .map(w => `- ${w.person}: ${w.responsibilities.join('; ')}`)
        .join('\n')}\n\n`;
    }

    if (previousSummary.actionItems && previousSummary.actionItems.length > 0) {
      prompt += `PREVIOUS ACTION ITEMS:\n${previousSummary.actionItems
        .map(
          a =>
            `- Task: "${a.task}", Owner: "${a.owner || a.assignee || 'Not specified'}", Deadline: "${a.deadline || 'Not specified'}"`
        )
        .join('\n')}\n\n`;
    }

    if (previousSummary.unresolvedQuestions && previousSummary.unresolvedQuestions.length > 0) {
      prompt += `PREVIOUS UNRESOLVED QUESTIONS & FOLLOW-UPS:\n${previousSummary.unresolvedQuestions
        .map(q => `- ${q}`)
        .join('\n')}\n\n`;
    }

    prompt += `=== NEW DISCUSSION TRANSCRIPT TO INTEGRATE ===\n${transcriptLines}\n\n`;
    prompt += `=== INSTRUCTIONS FOR UPDATING CUMULATIVE SUMMARY ===
1. Synthesize an updated, cumulative summary incorporating the new discussion while preserving all prior context.
2. Maintain confirmed decisions: preserve existing confirmed decisions unless explicitly changed or reversed by the group. Record new decisions ONLY when they were explicitly agreed upon (do NOT record tentative suggestions, proposals, or thoughts as decisions).
3. Update work allocation: prominently identify each person by name and list their assigned responsibilities and owned areas.
4. Update action items: retain prior action items, update deadlines or details if clarified in the new discussion, add new action items, and avoid duplicates. Use "Not specified" if owner or deadline is unknown.
5. Retain explicitly mentioned dates, times, names, technical commitments, and metrics. Never invent missing details.
6. Track unresolved questions and follow-ups: if an earlier question was answered in the new discussion, resolve it; keep open ones and add any new unresolved questions raised.`;
  } else {
    prompt += `=== MEETING TRANSCRIPT ===\n${transcriptLines}\n\n`;
    prompt += `=== INSTRUCTIONS FOR INITIAL SUMMARY ===
1. Generate an accurate, comprehensive, and well-structured meeting summary.
2. "summary": Executive overview paragraph synthesizing the meeting purpose, key themes, and current status.
3. "keyPoints": Bullet points capturing the core technical, operational, and organizational topics discussed.
4. "decisions": Only include CONFIRMED decisions explicitly agreed upon by the participants. Do NOT label tentative ideas, suggestions, or exploratory options as confirmed decisions.
5. "workAllocation": Group by individual person's name, prominently highlighting their owned areas and assigned responsibilities.
6. "actionItems": Concrete tasks with "task", "owner", and exact "deadline". Retain exact mentioned dates and times. Never invent missing details; use "Not specified" if owner or deadline is not stated.
7. "unresolvedQuestions": Unresolved questions, open topics, and items marked for later follow-up.`;
  }

  return prompt;
};

const SYSTEM_PROMPT = `You are Relay Copilot, an expert AI meeting assistant. Analyze meeting transcript segments and produce or update an accurate, complete, structured cumulative meeting summary.

You must respond with ONLY valid JSON strictly adhering to this schema:
{
  "summary": "Cohesive executive overview paragraph...",
  "keyPoints": [
    "Key discussion point 1"
  ],
  "decisions": [
    "Confirmed decision 1 (ONLY confirmed decisions, not tentative suggestions or exploratory ideas)"
  ],
  "workAllocation": [
    {
      "person": "Full Name",
      "responsibilities": ["Primary responsibility or owned area"]
    }
  ],
  "actionItems": [
    {
      "task": "Concrete actionable task",
      "owner": "Person Name or 'Not specified'",
      "deadline": "Exact mentioned date/time/timeframe or 'Not specified'"
    }
  ],
  "unresolvedQuestions": [
    "Unresolved question or follow-up item"
  ]
}

Rules:
- Retain explicitly mentioned dates, times, names, technical details, commitments, and metrics.
- Never invent missing information; use "Not specified" when an owner or deadline is unknown.
- Distinguish confirmed decisions from suggestions or proposals.
- Do not wrap your response in markdown code blocks.`;

/**
 * Splits transcript segments into sequential chunks respecting the maximum character limit.
 * Used for processing long meetings in batches without silently discarding earlier context.
 *
 * @param {Array<object>} transcripts
 * @param {number} [maxChars=BATCH_MAX_CHARS]
 * @returns {Array<Array<object>>}
 */
export const chunkTranscripts = (transcripts, maxChars = BATCH_MAX_CHARS) => {
  if (!Array.isArray(transcripts) || transcripts.length === 0) return [];

  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const seg of transcripts) {
    const textLen = (seg.text || '').length;
    if (currentLength + textLen > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [seg];
      currentLength = textLen;
    } else {
      currentChunk.push(seg);
      currentLength += textLen;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
};

/**
 * Executes an HTTP call to Groq Chat Completions API with bounded retry for transient errors.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export const callGroq = async (prompt, options = {}) => {
  const fetchFn = options.fetch || fetch;
  const apiKey = options.apiKey || config.ai.groqApiKey;
  const model = options.model || config.ai.groqPrimaryModel;

  if (!apiKey) {
    const err = new Error('Groq API key is not configured');
    err.code = 'CONFIG_MISSING';
    throw err;
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: config.ai.maxOutputTokens || 2048,
    response_format: { type: 'json_object' },
  };

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts += 1;
    let res;
    try {
      res = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
    } catch (netErr) {
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      netErr.isTransient = true;
      throw netErr;
    }

    if (res.ok) {
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      return parseStructuredSummary(content);
    }

    // Inspect error status
    const status = res.status;
    let errorBody = {};
    try {
      errorBody = await res.json();
    } catch {
      // Ignore JSON parse error on error response
    }

    const errorMsg = errorBody?.error?.message || res.statusText || 'Groq error';
    const errorCode = errorBody?.error?.code || '';

    // Check for rate limits / quota exhaustion
    if (status === 429) {
      const isQuotaExhausted =
        errorCode === 'insufficient_quota' ||
        errorCode === 'quota_exceeded' ||
        errorMsg.toLowerCase().includes('quota') ||
        errorMsg.toLowerCase().includes('limit reached');

      const err = new Error(errorMsg);
      err.status = 429;
      err.isQuotaExhausted = isQuotaExhausted;
      err.retryAfter = parseInt(res.headers?.get('retry-after') || '0', 10);

      // If it's a short transient rate limit and we have retries left
      if (!isQuotaExhausted && err.retryAfter > 0 && err.retryAfter <= 2 && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, err.retryAfter * 1000));
        continue;
      }

      throw err;
    }

    // Transient 5xx server errors
    if (status >= 500 && status < 600 && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    const generalErr = new Error(`Groq request failed with status ${status}: ${errorMsg}`);
    generalErr.status = status;
    generalErr.isTransient = status >= 500 && status < 600;
    throw generalErr;
  }
};

/**
 * Executes an HTTP call to Google Gemini GenerateContent API as a fallback.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export const callGemini = async (prompt, options = {}) => {
  const fetchFn = options.fetch || fetch;
  const apiKey = options.apiKey || config.ai.geminiApiKey;
  const model = options.model || config.ai.geminiFallbackModel;

  if (!apiKey) {
    const err = new Error('Gemini API key is not configured');
    err.code = 'CONFIG_MISSING';
    throw err;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: config.ai.maxOutputTokens || 2048,
    },
  };

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts += 1;
    let res;
    try {
      res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
    } catch (netErr) {
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      netErr.isTransient = true;
      throw netErr;
    }

    if (res.ok) {
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return parseStructuredSummary(content);
    }

    const status = res.status;
    let errorBody = {};
    try {
      errorBody = await res.json();
    } catch {
      // Ignore JSON parse error
    }

    const errorMsg = errorBody?.error?.message || res.statusText || 'Gemini error';
    const isQuota =
      status === 429 ||
      errorMsg.toLowerCase().includes('quota') ||
      errorMsg.toLowerCase().includes('resource has been exhausted');

    const err = new Error(`Gemini request failed (${status}): ${errorMsg}`);
    err.status = status;
    err.isQuotaExhausted = isQuota;

    if (isQuota) {
      throw err;
    }

    if (status >= 500 && status < 600 && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    throw err;
  }
};

/**
 * Summarizes a single batch of transcript segments using Groq as primary and Gemini as fallback.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
export const summarizeSingleBatch = async ({
  previousSummary = null,
  batchTranscripts = [],
  customFetch = fetch,
  forceProvider = null,
}) => {
  const prompt = buildPrompt(previousSummary, batchTranscripts);
  const now = Date.now();

  // 1. Try Groq (Primary LLM)
  const isGroqQuotaPaused =
    providerState.groq.quotaExhaustedUntil && providerState.groq.quotaExhaustedUntil > now;
  const hasGroqAccess = Boolean(config.ai.groqApiKey || customFetch !== fetch);

  if (forceProvider !== 'gemini' && !isGroqQuotaPaused && hasGroqAccess) {
    try {
      const groqResult = await callGroq(prompt, {
        fetch: customFetch,
        apiKey: config.ai.groqApiKey || 'mock-groq-key',
      });
      providerState.groq.consecutiveErrors = 0;
      providerState.groq.lastUsedAt = new Date().toISOString();
      providerState.groq.totalCalls += 1;

      return {
        ok: true,
        providerUsed: 'groq',
        modelUsed: config.ai.groqPrimaryModel,
        ...groqResult,
      };
    } catch (err) {
      providerState.groq.consecutiveErrors += 1;

      if (err.isQuotaExhausted) {
        // Pause Groq for 1 hour
        providerState.groq.quotaExhaustedUntil = now + 3600000;
        console.warn(`[Relay AI] Groq free-tier quota exhausted. Will attempt Gemini fallback.`);
      } else {
        console.warn(`[Relay AI] Groq call failed (${err.message}). Checking Gemini fallback.`);
      }
    }
  }

  // 2. Fallback to Gemini
  const isGeminiQuotaPaused =
    providerState.gemini.quotaExhaustedUntil && providerState.gemini.quotaExhaustedUntil > now;
  const hasGeminiAccess = Boolean(config.ai.geminiApiKey || customFetch !== fetch);

  if (forceProvider !== 'groq' && !isGeminiQuotaPaused && hasGeminiAccess) {
    try {
      const geminiResult = await callGemini(prompt, {
        fetch: customFetch,
        apiKey: config.ai.geminiApiKey || 'mock-gemini-key',
      });
      providerState.gemini.consecutiveErrors = 0;
      providerState.gemini.lastUsedAt = new Date().toISOString();
      providerState.gemini.totalCalls += 1;

      return {
        ok: true,
        providerUsed: 'gemini',
        modelUsed: config.ai.geminiFallbackModel,
        ...geminiResult,
      };
    } catch (geminiErr) {
      providerState.gemini.consecutiveErrors += 1;
      if (geminiErr.isQuotaExhausted) {
        providerState.gemini.quotaExhaustedUntil = now + 3600000;
        console.warn(`[Relay AI] Gemini free-tier quota exhausted.`);
      } else {
        console.warn(`[Relay AI] Gemini fallback call failed: ${geminiErr.message}`);
      }
    }
  }

  // 3. Both failed or paused: return paused quota message
  return {
    ok: false,
    paused: true,
    reason: 'quota_exhausted',
    message: AI_MESSAGES.SUMMARY_PAUSED_QUOTA,
  };
};

/**
 * Primary summarization coordinator:
 * 1. Checks global AI activation and input transcripts.
 * 2. Uses complete available meeting context. If transcript length exceeds maxBatchChars,
 *    partitions into chronological batches and combines extracted information sequentially.
 * 3. Uses Groq as primary LLM and Gemini as fallback.
 * 4. Merges and deduplicates action items and work allocation.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
export const generateSummary = async ({
  _roomName,
  previousSummary = null,
  newTranscripts = [],
  transcripts = null,
  customFetch = fetch,
  forceProvider = null, // for testing: 'groq' | 'gemini'
  maxBatchChars = BATCH_MAX_CHARS,
}) => {
  if (!config.ai.enabled) {
    return {
      ok: false,
      paused: true,
      reason: 'disabled',
      message: 'AI Assistant is currently disabled globally.',
    };
  }

  const allTranscripts = transcripts || newTranscripts;
  if (!allTranscripts || allTranscripts.length === 0) {
    return {
      ok: false,
      skipped: true,
      reason: 'no_new_transcripts',
    };
  }

  // Partition into batches if transcripts exceed maxBatchChars
  const batches = chunkTranscripts(allTranscripts, maxBatchChars);
  if (batches.length === 0) {
    return {
      ok: false,
      skipped: true,
      reason: 'no_new_transcripts',
    };
  }

  let cumulativeSummary = previousSummary;
  let finalResult = null;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchResult = await summarizeSingleBatch({
      previousSummary: cumulativeSummary,
      batchTranscripts: batch,
      customFetch,
      forceProvider,
    });

    if (!batchResult.ok) {
      return batchResult;
    }

    cumulativeSummary = {
      summaryText: batchResult.summary,
      keyPoints: batchResult.keyPoints,
      decisions: batchResult.decisions,
      workAllocation: batchResult.workAllocation,
      actionItems: batchResult.actionItems,
      unresolvedQuestions: batchResult.unresolvedQuestions,
      providerUsed: batchResult.providerUsed,
      modelUsed: batchResult.modelUsed,
    };
    finalResult = batchResult;
  }

  return finalResult;
};
