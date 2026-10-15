import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import {
  getRoomServiceClient,
  buildRoomMetadata,
  parseRoomMetadata,
} from '../services/livekitAdmin.js';
import { accessControlService } from '../services/accessControlService.js';

export const createMeetingToken = async (req, res, next) => {
  try {
    // 1. Verify LiveKit server environment configuration
    if (!config.livekit.isConfigured) {
      return res.status(503).json({
        success: false,
        error: {
          message: `LiveKit server configuration is incomplete on the backend. Missing environment variables: ${config.livekit.missingVars.join(
            ', '
          )} in ${config.envPaths.apiEnvPath}.`,
          missingVariables: config.livekit.missingVars,
          statusCode: 503,
        },
      });
    }

    const {
      roomName,
      participantName,
      waitingRoomEnabled = false,
      participantIdentity: clientIdentity,
    } = req.body || {};

    // 2. Validate room name
    if (!roomName || typeof roomName !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Room name is required and must be a string.',
          statusCode: 400,
        },
      });
    }

    const trimmedRoom = roomName.trim();
    if (trimmedRoom.length < 1 || trimmedRoom.length > 64) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Room name must be between 1 and 64 characters.',
          statusCode: 400,
        },
      });
    }

    // Sanitize room name to alphanumeric, dashes, dots, and underscores
    const sanitizedRoom = trimmedRoom.replace(/[^a-zA-Z0-9_\-.]/g, '-');
    if (!sanitizedRoom) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Room name contains only invalid characters.',
          statusCode: 400,
        },
      });
    }

    // 3. Validate participant display name
    if (!participantName || typeof participantName !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Participant name is required and must be a string.',
          statusCode: 400,
        },
      });
    }

    const trimmedParticipant = participantName.trim();
    if (trimmedParticipant.length < 1 || trimmedParticipant.length > 64) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Participant name must be between 1 and 64 characters.',
          statusCode: 400,
        },
      });
    }

    // Strip HTML/control characters for safety
    const sanitizedParticipant = trimmedParticipant.replace(/[<>]/g, '').slice(0, 64);

    // 4. Determine or maintain unique server-side participant identity
    const participantIdentity =
      typeof clientIdentity === 'string' && clientIdentity.trim().length > 0
        ? clientIdentity.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
        : `user_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // 5. Determine host status server-side
    let isHost = false;
    try {
      const roomService = getRoomServiceClient();
      const accessState = await accessControlService.getAccessState(sanitizedRoom).catch(() => ({}));
      let existingHostIdentity = accessState?.hostIdentity;

      if (!existingHostIdentity) {
        try {
          const existingRooms = await roomService.listRooms([sanitizedRoom]);
          existingHostIdentity = parseRoomMetadata(existingRooms[0]?.metadata).hostIdentity;
        } catch (lkErr) {
          console.warn('[Relay API] listRooms notice:', lkErr.message);
        }
      }

      if (!existingHostIdentity) {
        try {
          await roomService.createRoom({
            name: sanitizedRoom,
            metadata: buildRoomMetadata({ hostIdentity: participantIdentity }),
          });
        } catch (createErr) {
          console.warn('[Relay API] createRoom notice:', createErr.message);
        }

        isHost = true;

        // Initialize meeting access controls in accessControlService
        await accessControlService.initializeMeeting({
          roomName: sanitizedRoom,
          hostIdentity: participantIdentity,
          waitingRoomEnabled: Boolean(waitingRoomEnabled),
        });
      } else {
        isHost = existingHostIdentity === participantIdentity;
      }
    } catch (err) {
      console.warn('[Relay API] Host determination failed, continuing as non-host:', err.message);
    }

    // 6. If requester is not the host, enforce access controls (removal, lock, waiting room)
    if (!isHost) {
      const admission = await accessControlService.evaluateJoinRequest({
        roomName: sanitizedRoom,
        participantIdentity,
        participantName: sanitizedParticipant,
        isHost: false,
      });

      if (!admission.allowed) {
        if (admission.waiting) {
          // Unapproved participant is placed in the waiting room and granted NO LiveKit token
          return res.status(200).json({
            success: true,
            waiting: true,
            status: 'waiting',
            roomName: sanitizedRoom,
            participantIdentity,
            participantName: sanitizedParticipant,
            message: admission.message,
          });
        }

        return res.status(admission.statusCode || 403).json({
          success: false,
          error: {
            message: admission.message,
            code: admission.reason?.toUpperCase() || 'ACCESS_DENIED',
            statusCode: admission.statusCode || 403,
          },
        });
      }
    }

    // 7. Construct LiveKit Access Token
    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: participantIdentity,
      name: sanitizedParticipant,
      ttl: '2h', // Short-lived token valid for 2 hours
      attributes: { role: isHost ? 'host' : 'participant' },
    });

    at.addGrant({
      room: sanitizedRoom,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });

    const token = await at.toJwt();

    // 8. Return safe connection details needed by the browser
    return res.status(200).json({
      success: true,
      token,
      url: config.livekit.url,
      roomName: sanitizedRoom,
      participantIdentity,
      participantName: sanitizedParticipant,
      isHost,
    });
  } catch (err) {
    return next(err);
  }
};
