import { CHAT_CONFIG } from '@relay/shared';

/**
 * In-memory sliding window rate limiter for chat messaging.
 * Tracks timestamps per participant identity per room to prevent flooding and abuse.
 */
class ChatRateLimiter {
  constructor({
    maxRequests = CHAT_CONFIG.RATE_LIMIT_MAX_PER_WINDOW || 5,
    windowMs = CHAT_CONFIG.RATE_LIMIT_WINDOW_MS || 2000,
  } = {}) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    /** @type {Map<string, Array<number>>} */
    this.clients = new Map();
  }

  /**
   * Checks if an identity is allowed to send a message right now.
   *
   * @param {string} roomName
   * @param {string} participantIdentity
   * @returns {{ allowed: boolean, retryAfterMs?: number, error?: string }}
   */
  checkLimit(roomName, participantIdentity) {
    if (!roomName || !participantIdentity) {
      return { allowed: false, error: 'Room name and participant identity are required.' };
    }

    const key = `${roomName}:${participantIdentity}`;
    const now = Date.now();
    const timestamps = this.clients.get(key) || [];

    // Filter out timestamps outside the sliding window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      const oldest = validTimestamps[0];
      const retryAfterMs = Math.max(0, this.windowMs - (now - oldest));
      return {
        allowed: false,
        retryAfterMs,
        error: `Rate limit exceeded. Please wait ${(retryAfterMs / 1000).toFixed(1)}s before sending another message.`,
      };
    }

    validTimestamps.push(now);
    this.clients.set(key, validTimestamps);

    // Occasional cleanup of stale keys
    if (this.clients.size > 1000) {
      this.cleanup();
    }

    return { allowed: true };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.clients.entries()) {
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      if (valid.length === 0) {
        this.clients.delete(key);
      } else {
        this.clients.set(key, valid);
      }
    }
  }

  reset() {
    this.clients.clear();
  }
}

export const chatRateLimiter = new ChatRateLimiter();
