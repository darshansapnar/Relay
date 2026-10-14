import { CHAT_MESSAGE_TYPES, CHAT_EVENTS } from '@relay/shared';
import { verifyParticipantToken } from '../services/livekitAdmin.js';
import { validateChatMessage } from '../services/chatValidator.js';
import { chatRateLimiter } from '../services/chatRateLimiter.js';
import { getSocketIO } from '../services/chatSocket.js';
import {
  saveMessage,
  getAuthorizedMessages,
  registerMembership,
  isParticipantInMeeting,
  getUnreadCounts,
} from '../db/chatRepo.js';

/**
 * GET /api/meetings/:roomName/messages
 * Retrieves authorized chat history for the authenticated participant from PostgreSQL.
 */
export const getMeetingMessages = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName is required.', statusCode: 400 },
      });
    }

    // Verify token matches room and derive caller's verified identity
    const participant = await verifyParticipantToken(req, roomName);

    // Register / update membership
    try {
      await registerMembership({
        roomName,
        participantIdentity: participant.identity,
        participantName: participant.name,
        isHost: participant.isHost,
      });
    } catch (dbErr) {
      console.warn('[Relay Chat API] Membership register warning:', dbErr.message);
    }

    const { limit, before, targetType, peerIdentity } = req.query;

    // Filter messages authoritatively so caller ONLY receives messages they are authorized to see
    const history = await getAuthorizedMessages({
      roomName,
      participantIdentity: participant.identity,
      limit: limit ? parseInt(limit, 10) : undefined,
      before: before || null,
      targetType: targetType || null,
      peerIdentity: peerIdentity || null,
    });

    const unread = await getUnreadCounts(roomName, participant.identity);

    return res.status(200).json({
      success: true,
      messages: history.messages,
      hasMore: history.hasMore,
      nextCursor: history.nextCursor,
      unread,
      participantIdentity: participant.identity,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: { message: err.message, statusCode: err.statusCode },
      });
    }
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/messages
 * Sends a message in the meeting via HTTP (persists to PostgreSQL and broadcasts via Socket.IO).
 */
export const sendMeetingMessage = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName is required.', statusCode: 400 },
      });
    }

    // Authorize sender via LiveKit JWT
    const participant = await verifyParticipantToken(req, roomName);

    const {
      content,
      targetType = CHAT_MESSAGE_TYPES.EVERYONE,
      recipientIdentity = null,
      recipientName = null,
      clientMessageId = null,
    } = req.body || {};

    // Rate limiting check
    const rateLimitResult = chatRateLimiter.checkLimit(roomName, participant.identity);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          message: rateLimitResult.error,
          statusCode: 429,
          code: 'RATE_LIMITED',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
      });
    }

    // Validation
    const validation = validateChatMessage({
      content,
      targetType,
      recipientIdentity,
      senderIdentity: participant.identity,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: validation.error, statusCode: 400, code: 'VALIDATION_ERROR' },
      });
    }

    // For direct messages, verify recipient is an authorized member of this meeting
    if (targetType === CHAT_MESSAGE_TYPES.DIRECT) {
      const isMember = await isParticipantInMeeting(roomName, recipientIdentity);
      if (!isMember) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Recipient is not a member of this meeting room.',
            statusCode: 400,
            code: 'RECIPIENT_NOT_FOUND',
          },
        });
      }
    }

    // Persist to PostgreSQL before broadcasting
    const message = await saveMessage({
      roomName,
      clientMessageId,
      targetType,
      senderIdentity: participant.identity,
      senderName: participant.name,
      recipientIdentity: targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientIdentity : null,
      recipientName: targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientName : null,
      content: validation.sanitizedContent,
    });

    // Broadcast through Socket.IO if active
    const io = getSocketIO();
    if (io) {
      if (targetType === CHAT_MESSAGE_TYPES.EVERYONE) {
        io.to(`room:${roomName}`).emit(CHAT_EVENTS.NEW_MESSAGE, message);
      } else if (targetType === CHAT_MESSAGE_TYPES.DIRECT) {
        io.to(`user:${roomName}:${recipientIdentity}`).emit(CHAT_EVENTS.NEW_MESSAGE, message);
        io.to(`user:${roomName}:${participant.identity}`).emit(CHAT_EVENTS.NEW_MESSAGE, message);
      }
    }

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: { message: err.message, statusCode: err.statusCode },
      });
    }
    return next(err);
  }
};
