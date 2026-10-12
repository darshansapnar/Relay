import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';

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

    const { roomName, participantName } = req.body || {};

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
    const sanitizedParticipant = trimmedParticipant
      .replace(/[<>]/g, '')
      .slice(0, 64);

    // 4. Generate unique server-side participant identity
    const participantIdentity = `user_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // 5. Construct LiveKit Access Token
    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: participantIdentity,
      name: sanitizedParticipant,
      ttl: '2h', // Short-lived token valid for 2 hours
    });

    at.addGrant({
      room: sanitizedRoom,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // 6. Return only the safe connection details needed by the browser
    return res.status(200).json({
      success: true,
      token,
      url: config.livekit.url,
      roomName: sanitizedRoom,
      participantIdentity,
      participantName: sanitizedParticipant,
    });
  } catch (err) {
    return next(err);
  }
};
