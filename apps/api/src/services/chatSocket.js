import { Server as SocketIOServer } from 'socket.io';
import { CHAT_EVENTS, CHAT_MESSAGE_TYPES, AI_EVENTS } from '@relay/shared';
import { config } from '../config/index.js';
import { verifyRawToken } from './livekitAdmin.js';
import { validateChatMessage } from './chatValidator.js';
import { chatRateLimiter } from './chatRateLimiter.js';
import { aiManager } from './aiManager.js';

import {
  saveMessage,
  getAuthorizedMessages,
  registerMembership,
  isParticipantInMeeting,
  getParticipantMembership,
  markReadState,
  getUnreadCounts,
} from '../db/chatRepo.js';

let ioInstance = null;

/**
 * Returns the active Socket.IO server instance.
 *
 * @returns {SocketIOServer | null}
 */
export const getSocketIO = () => ioInstance;

/**
 * Initializes and binds the Socket.IO real-time chat service to the HTTP server.
 *
 * @param {import('http').Server} httpServer
 * @param {object} [customOptions] - Optional configuration overrides (e.g. for testing)
 * @returns {SocketIOServer}
 */
export const setupChatSocket = (httpServer, customOptions = {}) => {
  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 10000,
    ...customOptions,
  });

  ioInstance = io;
  aiManager.setIO(io);

  // Authentication middleware using LiveKit JWT verification
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const query = socket.handshake.query || {};
      const headers = socket.handshake.headers || {};

      const token =
        auth.token ||
        query.token ||
        (headers.authorization?.startsWith('Bearer ') ? headers.authorization.slice(7) : null);

      const roomName = auth.roomName || query.roomName;

      if (!token) {
        const err = new Error('Authentication required: Missing access token.');
        err.data = { code: 'UNAUTHORIZED' };
        return next(err);
      }

      if (!roomName) {
        const err = new Error('Authentication required: Missing room name.');
        err.data = { code: 'BAD_REQUEST' };
        return next(err);
      }

      // Cryptographically verify LiveKit JWT and room assignment
      const verified = await verifyRawToken(token, roomName);

      // Persist / update verified membership in PostgreSQL
      try {
        await registerMembership({
          roomName: verified.roomName,
          participantIdentity: verified.identity,
          participantName: verified.name,
          isHost: verified.isHost,
        });
      } catch (dbErr) {
        console.warn('[Relay Chat Socket] Membership registration warning:', dbErr.message);
      }

      // Attach authoritative server-verified identity to socket data
      socket.data = {
        identity: verified.identity,
        name: verified.name,
        roomName: verified.roomName,
        isHost: verified.isHost,
      };

      next();
    } catch (err) {
      const authErr = new Error(err.message || 'Authentication failed.');
      authErr.data = { code: err.statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED' };
      next(authErr);
    }
  });

  io.on('connection', socket => {
    const { identity, name, roomName } = socket.data;

    // Join room broadcast channel (for everyone chat in this specific meeting)
    const roomChannel = `room:${roomName}`;
    socket.join(roomChannel);

    // Join private user channel (for direct messages specifically in this room)
    const userChannel = `user:${roomName}:${identity}`;
    socket.join(userChannel);

    /**
     * Handle incoming chat message sending.
     */
    socket.on(CHAT_EVENTS.SEND_MESSAGE, async (payload, ackCallback) => {
      try {
        const targetType = payload?.targetType || CHAT_MESSAGE_TYPES.EVERYONE;
        const recipientIdentity = payload?.recipientIdentity
          ? String(payload.recipientIdentity).trim()
          : null;
        const recipientName = payload?.recipientName ? String(payload.recipientName).trim() : null;
        const clientMessageId = payload?.clientMessageId;

        // 1. Rate limiting check per identity in room
        const rateLimitResult = chatRateLimiter.checkLimit(roomName, identity);
        if (!rateLimitResult.allowed) {
          const errResponse = {
            success: false,
            error: rateLimitResult.error,
            code: 'RATE_LIMITED',
            retryAfterMs: rateLimitResult.retryAfterMs,
          };
          if (typeof ackCallback === 'function') {
            return ackCallback(errResponse);
          }
          return socket.emit(CHAT_EVENTS.ERROR, errResponse);
        }

        // 2. Message validation & sanitization
        const validation = validateChatMessage({
          content: payload?.content,
          targetType,
          recipientIdentity,
          senderIdentity: identity,
        });

        if (!validation.valid) {
          const errResponse = {
            success: false,
            error: validation.error,
            code: 'VALIDATION_ERROR',
          };
          if (typeof ackCallback === 'function') {
            return ackCallback(errResponse);
          }
          return socket.emit(CHAT_EVENTS.ERROR, errResponse);
        }

        // 3. For direct messages, verify recipient is an authorized member of this meeting
        if (targetType === CHAT_MESSAGE_TYPES.DIRECT) {
          const isMember = await isParticipantInMeeting(roomName, recipientIdentity);
          if (!isMember) {
            // Also check if recipient is currently connected to the socket room
            const socketsInRecipientRoom = await io
              .in(`user:${roomName}:${recipientIdentity}`)
              .fetchSockets();
            if (socketsInRecipientRoom.length === 0) {
              const errResponse = {
                success: false,
                error: 'Recipient is not a member of this meeting room.',
                code: 'RECIPIENT_NOT_FOUND',
              };
              if (typeof ackCallback === 'function') {
                return ackCallback(errResponse);
              }
              return socket.emit(CHAT_EVENTS.ERROR, errResponse);
            }
          }
        }

        // 4. Persist message in PostgreSQL BEFORE broadcasting
        const persistedMessage = await saveMessage({
          roomName,
          clientMessageId,
          targetType,
          senderIdentity: identity,
          senderName: name,
          recipientIdentity: targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientIdentity : null,
          recipientName: targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientName : null,
          content: validation.sanitizedContent,
        });

        // 5. Dispatch message through authorized channels ONLY
        if (targetType === CHAT_MESSAGE_TYPES.EVERYONE) {
          // Broadcast to everyone in this meeting room only
          io.to(roomChannel).emit(CHAT_EVENTS.NEW_MESSAGE, persistedMessage);
        } else if (targetType === CHAT_MESSAGE_TYPES.DIRECT) {
          // Private message: emit ONLY to the intended recipient and the sender
          const targetRecipientChannel = `user:${roomName}:${recipientIdentity}`;
          io.to(targetRecipientChannel).emit(CHAT_EVENTS.NEW_MESSAGE, persistedMessage);
          io.to(userChannel).emit(CHAT_EVENTS.NEW_MESSAGE, persistedMessage);

          // Update unread count for recipient
          try {
            const recipientUnread = await getUnreadCounts(roomName, recipientIdentity);
            io.to(targetRecipientChannel).emit(CHAT_EVENTS.UNREAD_UPDATE, recipientUnread);
          } catch (countErr) {
            console.warn('[Relay Chat Socket] Unread count dispatch warning:', countErr.message);
          }
        }

        // 6. Acknowledge delivery to sender
        if (typeof ackCallback === 'function') {
          ackCallback({
            success: true,
            message: persistedMessage,
          });
        }
      } catch (err) {
        console.error('[Relay Chat Socket] Error processing message:', err.message);
        const errResponse = {
          success: false,
          error: 'An unexpected error occurred while saving your message.',
          code: 'SERVER_ERROR',
        };
        if (typeof ackCallback === 'function') {
          ackCallback(errResponse);
        } else {
          socket.emit(CHAT_EVENTS.ERROR, errResponse);
        }
      }
    });

    /**
     * Handle retrieval of authorized message history from PostgreSQL.
     */
    socket.on(CHAT_EVENTS.GET_HISTORY, async (queryOpts, ackCallback) => {
      const callback = typeof queryOpts === 'function' ? queryOpts : ackCallback;
      const options = typeof queryOpts === 'object' && queryOpts !== null ? queryOpts : {};

      try {
        const history = await getAuthorizedMessages({
          roomName,
          participantIdentity: identity,
          limit: options.limit,
          before: options.before,
          targetType: options.targetType,
          peerIdentity: options.peerIdentity,
        });

        const unread = await getUnreadCounts(roomName, identity);

        const response = {
          success: true,
          messages: history.messages,
          hasMore: history.hasMore,
          nextCursor: history.nextCursor,
          unread,
        };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('chat:history', response);
        }
      } catch (err) {
        console.error('[Relay Chat Socket] Error fetching history:', err.message);
        const errResponse = {
          success: false,
          error: 'Failed to retrieve chat history.',
          messages: [],
        };
        if (typeof callback === 'function') {
          callback(errResponse);
        } else {
          socket.emit(CHAT_EVENTS.ERROR, errResponse);
        }
      }
    });

    /**
     * Handle read receipt / mark read state.
     */
    socket.on(CHAT_EVENTS.MARK_READ, async (payload, ackCallback) => {
      try {
        const { targetType = CHAT_MESSAGE_TYPES.EVERYONE, peerIdentity = '', lastReadMessageId = null } =
          payload || {};

        await markReadState({
          roomName,
          participantIdentity: identity,
          targetType,
          peerIdentity,
          lastReadMessageId,
        });

        const unread = await getUnreadCounts(roomName, identity);
        socket.emit(CHAT_EVENTS.UNREAD_UPDATE, unread);

        if (typeof ackCallback === 'function') {
          ackCallback({ success: true, unread });
        }
      } catch (err) {
        console.warn('[Relay Chat Socket] Mark read error:', err.message);
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    /**
     * AI Assistant socket event handlers
     */
    socket.on(AI_EVENTS.GET_STATE, async ackCallback => {
      try {
        const state = await aiManager.getRoomState(roomName);
        if (typeof ackCallback === 'function') {
          ackCallback({ success: true, state });
        } else {
          socket.emit(AI_EVENTS.STATUS_UPDATE, state);
        }
      } catch (err) {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    socket.on(AI_EVENTS.TOGGLE_STATE, async (payload, ackCallback) => {
      try {
        const result = await aiManager.toggleAIState(roomName, {
          isActive: payload?.isActive,
          consentGranted: payload?.consentGranted,
          requestedByIdentity: identity,
          requestedByName: name,
        });
        if (typeof ackCallback === 'function') {
          ackCallback(result);
        }
      } catch (err) {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    /**
     * Resolves verified speaker identity and display name for incoming audio/transcript chunks.
     * Prevents attributing other participants' audio to the socket owner.
     */
    const resolveSpeakerAttribution = async (payloadIdentity, payloadName) => {
      const cleanIdentity = payloadIdentity ? String(payloadIdentity).trim() : identity;
      let cleanName = payloadName ? String(payloadName).trim() : '';

      // If this audio is from the socket authenticated user, use their verified JWT name
      if (cleanIdentity === identity) {
        return {
          speakerIdentity: cleanIdentity,
          speakerName: name || cleanName || 'Unknown speaker',
        };
      }

      // If audio is from a remote participant, look up their registered name in this meeting
      if (!cleanName || cleanName === 'undefined') {
        try {
          const membership = await getParticipantMembership(roomName, cleanIdentity);
          if (membership?.participantName) {
            cleanName = membership.participantName;
          }
        } catch {
          // Ignore
        }
      }

      return {
        speakerIdentity: cleanIdentity,
        speakerName: cleanName || 'Unknown speaker',
      };
    };

    socket.on(AI_EVENTS.TRANSCRIPT_CHUNK, async (payload, ackCallback) => {
      try {
        const { speakerIdentity, speakerName } = await resolveSpeakerAttribution(
          payload?.speakerIdentity,
          payload?.speakerName
        );

        const segment = await aiManager.handleTranscriptSegment({
          id: payload?.id || payload?.segmentId,
          roomName,
          speakerIdentity,
          speakerName,
          text: payload?.text,
          startTimeMs: payload?.startTimeMs,
          endTimeMs: payload?.endTimeMs,
        });
        if (typeof ackCallback === 'function') {
          ackCallback({ success: Boolean(segment), segment });
        }
      } catch (err) {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    socket.on(AI_EVENTS.AUDIO_CHUNK, async (payload, ackCallback) => {
      try {
        const { speakerIdentity, speakerName } = await resolveSpeakerAttribution(
          payload?.speakerIdentity,
          payload?.speakerName
        );

        const result = await aiManager.handleAudioChunk({
          id: payload?.id || payload?.segmentId,
          roomName,
          audioBuffer: payload?.audio,
          speakerIdentity,
          speakerName,
          startTimeMs: payload?.startTimeMs,
          endTimeMs: payload?.endTimeMs,
        });
        if (typeof ackCallback === 'function') {
          ackCallback(result);
        }
      } catch (err) {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    socket.on(AI_EVENTS.REQUEST_SUMMARY, async ackCallback => {
      try {
        await aiManager.maybeTriggerSummary(roomName, true);
        if (typeof ackCallback === 'function') {
          ackCallback({ success: true });
        }
      } catch (err) {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    socket.on('disconnect', () => {

      socket.leave(roomChannel);
      socket.leave(userChannel);
    });
  });

  return io;
};
