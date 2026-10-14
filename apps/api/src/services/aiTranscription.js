import { config } from '../config/index.js';
import { AI_MESSAGES } from '@relay/shared';

export const transcriptionState = {
  quotaExhaustedUntil: null,
  consecutiveErrors: 0,
  totalTranscriptions: 0,
  primaryModelCooldownUntil: null,
};

export const resetTranscriptionState = () => {
  transcriptionState.quotaExhaustedUntil = null;
  transcriptionState.consecutiveErrors = 0;
  transcriptionState.totalTranscriptions = 0;
  transcriptionState.primaryModelCooldownUntil = null;
};

/**
 * Encodes audio data into a base64 string and detects mime type.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array | Blob} audioData
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
const prepareAudioData = async audioData => {
  let mimeType = 'audio/webm';
  let base64 = '';

  if (typeof Blob !== 'undefined' && audioData instanceof Blob) {
    if (audioData.type) {
      mimeType = audioData.type;
    }
    const arrayBuf = await audioData.arrayBuffer();
    base64 = Buffer.from(arrayBuf).toString('base64');
  } else if (Buffer.isBuffer(audioData)) {
    base64 = audioData.toString('base64');
  } else if (audioData instanceof ArrayBuffer) {
    base64 = Buffer.from(audioData).toString('base64');
  } else if (ArrayBuffer.isView(audioData)) {
    base64 = Buffer.from(
      audioData.buffer,
      audioData.byteOffset,
      audioData.byteLength
    ).toString('base64');
  } else if (audioData) {
    base64 = Buffer.from(audioData).toString('base64');
  }

  return { base64, mimeType };
};

/**
 * Filters out common silence hallucinations across ASR models.
 *
 * @param {string} text
 * @returns {boolean} True if the text is considered silence or hallucination.
 */
const isSilenceOrHallucination = text => {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  const knownHallucinations = [
    'you',
    'thank you.',
    'thank you',
    '[music]',
    '(silence)',
    'silence',
    '...',
    'bye.',
  ];
  return knownHallucinations.includes(lower);
};

/**
 * Transcribes an audio chunk using Google Gemini GenerateContent API.
 */
const transcribeWithGemini = async ({
  audioData,
  speakerIdentity,
  speakerName,
  startTimeMs,
  endTimeMs,
  customFetch,
  now,
  apiKey: explicitApiKey,
}) => {
  const apiKey = explicitApiKey || config.ai.geminiApiKey;
  if (!apiKey && customFetch === fetch) {
    return {
      ok: false,
      paused: true,
      reason: 'not_configured',
      message: 'Gemini transcription API key is not configured.',
    };
  }

  const primaryModel = config.ai.geminiTranscriptionModel || 'gemini-3.5-transcribe';
  const fallbackModel = config.ai.geminiFallbackModel || 'gemini-3.5-flash-lite';
  const effectiveKey = apiKey || 'mock-gemini-key';

  // If primary model is currently on cooldown (e.g. hit 429 quota), route directly to fallback
  const model =
    transcriptionState.primaryModelCooldownUntil &&
    transcriptionState.primaryModelCooldownUntil > now &&
    primaryModel !== fallbackModel
      ? fallbackModel
      : primaryModel;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;

  const { base64, mimeType } = await prepareAudioData(audioData);

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: 'Transcribe this spoken audio verbatim. If the audio is silent or contains only background noise, respond with an empty string. Output only the transcribed text without commentary.',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.0,
    },
  };

  let attempts = 0;
  const maxAttempts = 2;
  let res;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      res = await customFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } catch (netErr) {
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      transcriptionState.consecutiveErrors += 1;
      return { ok: false, error: netErr.message };
    }

    if (res.ok) break;

    // Transient 5xx retry
    if (res.status >= 500 && res.status < 600 && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 600));
      continue;
    }

    break;
  }

  if (!res.ok) {
    let status = res.status;
    let errorBody = {};
    try {
      errorBody = await res.json();
    } catch {
      // Ignore
    }

    let errorMsg =
      errorBody?.error?.message || res.statusText || 'Gemini transcription error';

    // If primary model encountered 503 (high demand), 429 (rate/quota cap), or 404, fall back to fallbackModel
    const isEligibleForFallback =
      (status === 503 || status === 429 || status === 404 || status === 400) &&
      model !== fallbackModel;

    if (isEligibleForFallback) {
      if (status === 429) {
        console.warn(
          `[Relay AI] ${model} rate-limited or quota exceeded (429). Setting temporary cooldown and falling back to ${fallbackModel}.`
        );
        transcriptionState.primaryModelCooldownUntil = now + 300000; // 5 min cooldown for primary model
      } else if (status === 503) {
        console.warn(
          `[Relay AI] ${model} unavailable (503 high demand). Attempting fallback to ${fallbackModel}.`
        );
        transcriptionState.primaryModelCooldownUntil = now + 30000;
      } else {
        console.warn(
          `[Relay AI] ${model} returned error status ${status}. Attempting fallback to ${fallbackModel}.`
        );
      }

      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${effectiveKey}`;
      try {
        const fbRes = await customFetch(fallbackEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbRaw = fbData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const fbText = fbRaw.trim();

          if (isSilenceOrHallucination(fbText)) {
            return {
              ok: true,
              text: '',
              skipped: true,
            };
          }

          transcriptionState.consecutiveErrors = 0;
          transcriptionState.totalTranscriptions += 1;

          return {
            ok: true,
            text: fbText,
            speakerIdentity,
            speakerName,
            startTimeMs,
            endTimeMs,
            providerUsed: 'gemini',
            modelUsed: fallbackModel,
            fallbackFrom: model,
          };
        }

        // If fallback also failed, capture its status and error
        status = fbRes.status;
        try {
          errorBody = await fbRes.json();
          errorMsg = errorBody?.error?.message || fbRes.statusText || errorMsg;
        } catch {
          // Ignore
        }
        console.warn(`[Relay AI] Fallback model ${fallbackModel} also failed with status ${status}`);
      } catch (fbErr) {
        console.warn(
          `[Relay AI] Gemini transcription fallback to ${fallbackModel} network error:`,
          fbErr.message
        );
      }
    }

    // Only enter quota pause if the fallback model itself returned 429
    if (status === 429 || errorMsg.toLowerCase().includes('quota')) {
      const retrySec = parseInt(
        errorBody?.error?.details?.find(d => d.retryDelay)?.retryDelay || '60',
        10
      );
      const cooldownMs = Math.min(Math.max(retrySec * 1000, 30000), 300000);
      transcriptionState.quotaExhaustedUntil = now + cooldownMs;
      console.warn(
        `[Relay AI] Gemini transcription quota reached across all models. Pausing transcription for ${Math.round(cooldownMs / 1000)}s.`
      );
      return {
        ok: false,
        paused: true,
        reason: 'quota_exhausted',
        message: AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA,
      };
    }

    transcriptionState.consecutiveErrors += 1;
    return {
      ok: false,
      status,
      error: errorMsg,
    };
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const text = rawText.trim();

  if (isSilenceOrHallucination(text)) {
    return {
      ok: true,
      text: '',
      skipped: true,
    };
  }

  transcriptionState.consecutiveErrors = 0;
  transcriptionState.totalTranscriptions += 1;

  return {
    ok: true,
    text,
    speakerIdentity,
    speakerName,
    startTimeMs,
    endTimeMs,
    providerUsed: 'gemini',
    modelUsed: model,
  };
};

/**
 * Transcribes an audio chunk using Groq Whisper API.
 */
const transcribeWithGroq = async ({
  audioData,
  speakerIdentity,
  speakerName,
  startTimeMs,
  endTimeMs,
  customFetch,
  now,
  apiKey: explicitApiKey,
}) => {
  const apiKey = explicitApiKey || config.ai.groqApiKey;
  if (!apiKey && customFetch === fetch) {
    return {
      ok: false,
      paused: true,
      reason: 'not_configured',
      message: 'Groq transcription API key is not configured.',
    };
  }

  const model = config.ai.groqTranscriptionModel || 'whisper-large-v3-turbo';
  const effectiveKey = apiKey || 'mock-groq-key';

  try {
    const formData = new FormData();
    const audioBlob =
      audioData instanceof Blob
        ? audioData
        : new Blob([audioData], { type: 'audio/webm' });

    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', model);
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');

    const res = await customFetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const status = res.status;
      let errorBody = {};
      try {
        errorBody = await res.json();
      } catch {
        // Ignore
      }

      const errorMsg =
        errorBody?.error?.message || res.statusText || 'Groq transcription error';

      if (status === 429 || errorMsg.toLowerCase().includes('quota')) {
        transcriptionState.quotaExhaustedUntil = now + 3600000;
        console.warn('[Relay AI] Groq transcription quota reached. Pausing transcription.');
        return {
          ok: false,
          paused: true,
          reason: 'quota_exhausted',
          message: AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA,
        };
      }

      transcriptionState.consecutiveErrors += 1;
      return {
        ok: false,
        status,
        error: errorMsg,
      };
    }

    const data = await res.json();
    const text = (data?.text || '').trim();

    if (isSilenceOrHallucination(text)) {
      return {
        ok: true,
        text: '',
        skipped: true,
      };
    }

    transcriptionState.consecutiveErrors = 0;
    transcriptionState.totalTranscriptions += 1;

    return {
      ok: true,
      text,
      speakerIdentity,
      speakerName,
      startTimeMs,
      endTimeMs,
      providerUsed: 'groq',
      modelUsed: model,
    };
  } catch (err) {
    transcriptionState.consecutiveErrors += 1;
    console.error('[Relay AI] Audio transcription network error:', err.message);
    return {
      ok: false,
      error: err.message,
    };
  }
};

/**
 * Transcribes an audio chunk using the configured transcription provider.
 *
 * @param {object} params
 * @param {Buffer | ArrayBuffer | Blob} params.audioData
 * @param {string} params.speakerIdentity
 * @param {string} params.speakerName
 * @param {number} [params.startTimeMs]
 * @param {number} [params.endTimeMs]
 * @param {Function} [params.customFetch]
 * @param {string} [params.forceProvider]
 * @returns {Promise<object>}
 */
export const transcribeAudioChunk = async ({
  audioData,
  speakerIdentity,
  speakerName,
  startTimeMs = 0,
  endTimeMs = 0,
  customFetch = fetch,
  forceProvider = null,
  apiKey = null,
}) => {
  const now = Date.now();
  if (
    transcriptionState.quotaExhaustedUntil &&
    transcriptionState.quotaExhaustedUntil > now
  ) {
    return {
      ok: false,
      paused: true,
      reason: 'quota_exhausted',
      message: AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA,
    };
  }

  const provider = forceProvider || config.ai.transcriptionProvider || 'gemini';

  if (provider === 'gemini') {
    return transcribeWithGemini({
      audioData,
      speakerIdentity,
      speakerName,
      startTimeMs,
      endTimeMs,
      customFetch,
      now,
      apiKey,
    });
  }

  if (provider === 'groq') {
    return transcribeWithGroq({
      audioData,
      speakerIdentity,
      speakerName,
      startTimeMs,
      endTimeMs,
      customFetch,
      now,
      apiKey,
    });
  }

  return {
    ok: false,
    error: `Unsupported transcription provider: ${provider}`,
  };
};
