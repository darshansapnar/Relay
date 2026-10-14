import { randomUUID } from 'crypto';
import { CHAT_MESSAGE_TYPES, CHAT_CONFIG } from '@relay/shared';

/**
 * In-memory repository for meeting chat messages.
 * Stores messages per meeting room, enforces capacity bounds, handles
 * client-id deduplication, and strictly filters message visibility
 * so participants can only retrieve messages they are authorized to see.
 */
class ChatStore {
  constructor() {
    /** @type {Map<string, Array<object>>} */
    this.rooms = new Map();
    /** @type {Map<string, { id: string, timestamp: number }>} key: `${roomName}:${senderIdentity}:${clientMessageId}` */
    this.recentClientMessages = new Map();
  }

  /**
   * Saves a message to the room repository after checking for duplicate client messages.
   *
   * @param {object} params
   * @param {string} params.roomName
   * @param {string} [params.clientMessageId]
   * @param {string} params.targetType - 'everyone' | 'direct'
   * @param {string} params.senderIdentity - Verified sender LiveKit identity
   * @param {string} params.senderName - Verified sender display name
   * @param {string|null} [params.recipientIdentity] - Verified recipient identity (if direct)
   * @param {string|null} [params.recipientName] - Verified recipient display name (if direct)
   * @param {string} params.content - Clean message text
   * @returns {object} The persisted message
   */
  addMessage({
    roomName,
    clientMessageId = null,
    targetType = CHAT_MESSAGE_TYPES.EVERYONE,
    senderIdentity,
    senderName,
    recipientIdentity = null,
    recipientName = null,
    content,
  }) {
    if (!roomName || !senderIdentity || !content) {
      throw new Error('Missing required message parameters.');
    }

    // Deduplication check for retried network sends
    if (clientMessageId) {
      const dedupKey = `${roomName}:${senderIdentity}:${clientMessageId}`;
      const existing = this.recentClientMessages.get(dedupKey);
      if (existing && Date.now() - existing.timestamp < 15000) {
        const roomMessages = this.rooms.get(roomName) || [];
        const found = roomMessages.find(m => m.id === existing.id);
        if (found) {
          return found;
        }
      }
    }

    const timestamp = Date.now();
    const id = `msg_${timestamp}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

    const message = {
      id,
      clientMessageId: clientMessageId || null,
      roomName,
      targetType,
      senderIdentity,
      senderName: senderName || senderIdentity,
      recipientIdentity: targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientIdentity : null,
      recipientName: targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientName : null,
      content,
      timestamp,
      createdAt: new Date(timestamp).toISOString(),
    };

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, []);
    }

    const roomMessages = this.rooms.get(roomName);
    roomMessages.push(message);

    // Enforce max room history capacity to prevent memory bloat
    const maxCapacity = CHAT_CONFIG.MAX_ROOM_HISTORY || 500;
    if (roomMessages.length > maxCapacity) {
      roomMessages.splice(0, roomMessages.length - maxCapacity);
    }

    // Record client message ID for deduplication
    if (clientMessageId) {
      const dedupKey = `${roomName}:${senderIdentity}:${clientMessageId}`;
      this.recentClientMessages.set(dedupKey, { id, timestamp });

      // Expire old entries if map grows large
      if (this.recentClientMessages.size > 2000) {
        const now = Date.now();
        for (const [key, value] of this.recentClientMessages.entries()) {
          if (now - value.timestamp > 30000) {
            this.recentClientMessages.delete(key);
          }
        }
      }
    }

    return message;
  }

  /**
   * Retrieves messages for a participant, returning ONLY messages they are
   * authorized to see (all everyone messages, plus direct messages where
   * they are either the sender or the recipient).
   *
   * @param {string} roomName
   * @param {string} participantIdentity
   * @returns {Array<object>}
   */
  getAuthorizedMessages(roomName, participantIdentity) {
    if (!roomName || !participantIdentity) {
      return [];
    }

    const roomMessages = this.rooms.get(roomName);
    if (!roomMessages || roomMessages.length === 0) {
      return [];
    }

    return roomMessages.filter(m => {
      // 1. Everyone messages are visible to all members of the room
      if (m.targetType === CHAT_MESSAGE_TYPES.EVERYONE) {
        return true;
      }
      // 2. Direct messages are visible ONLY to the sender and recipient
      if (m.targetType === CHAT_MESSAGE_TYPES.DIRECT) {
        return (
          m.senderIdentity === participantIdentity || m.recipientIdentity === participantIdentity
        );
      }
      return false;
    });
  }

  /**
   * Clears messages for a room (e.g. when room is ended by host).
   * @param {string} roomName
   */
  clearRoom(roomName) {
    this.rooms.delete(roomName);
  }

  /**
   * Clears all rooms (primarily for testing).
   */
  clearAll() {
    this.rooms.clear();
    this.recentClientMessages.clear();
  }
}

export const chatStore = new ChatStore();
