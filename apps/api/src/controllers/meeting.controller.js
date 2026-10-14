import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import {
  getRoomServiceClient,
  buildRoomMetadata,
  parseRoomMetadata,
} from '../services/livekitAdmin.js';

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
    const sanitizedParticipant = trimmedParticipant.replace(/[<>]/g, '').slice(0, 64);

    // 4. Generate unique server-side participant identity
    const participantIdentity = `user_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // 5. Determine host status server-side: whoever is first to request a
    // token for a room with no recorded host claims it, and that claim is
    // recorded in the room's own metadata (not trusted from the client) so
    // every later participant -- and the backend, when authorizing
    // moderation actions -- can agree on who the host is.
    //
    // This deliberately keys off the metadata claim, not live participant
    // count: numParticipants reflects who has actually completed a LiveKit
    // connection, which lags token issuance (page load, media permissions,
    // etc). Keying off numParticipants would let a second, faster-connecting
    // requester steal host from someone whose token was already issued but
    // hadn't connected yet.
    //
    // If this check fails for any reason (LiveKit admin API hiccup), fail
    // open to "not host" rather than blocking the join entirely.
    let isHost = false;
    try {
      const roomService = getRoomServiceClient();
      const existingRooms = await roomService.listRooms([sanitizedRoom]);
      const { hostIdentity: existingHostIdentity } = parseRoomMetadata(existingRooms[0]?.metadata);

      if (!existingHostIdentity) {
        await roomService.createRoom({
          name: sanitizedRoom,
          metadata: buildRoomMetadata({ hostIdentity: participantIdentity }),
        });

        // Close the time-of-check-to-time-of-use gap between the listRooms
        // read above and this createRoom write: if a second token request
        // for the same brand-new room (e.g. two tabs, or React StrictMode
        // double-invoking an auto-join effect in development -- see
        // MeetingPage.jsx) raced in and its own createRoom call landed
        // after ours, room metadata now reflects *their* identity as host,
        // not ours. Re-reading here is what makes the token we're about to
        // mint agree with whatever authorizeHostRequest() will see later;
        // without it, a participant's own browser could believe it's host
        // (isHost: true baked into its token) while every moderation
        // request it makes is correctly rejected server-side -- the exact
        // "You/Host badge but backend says no" bug this guards against.
        const confirmedRooms = await roomService.listRooms([sanitizedRoom]);
        const { hostIdentity: confirmedHostIdentity } = parseRoomMetadata(
          confirmedRooms[0]?.metadata
        );
        isHost = confirmedHostIdentity === participantIdentity;
      }
    } catch (err) {
      console.warn('[Relay API] Host determination failed, continuing as non-host:', err.message);
    }

    // 6. Construct LiveKit Access Token. `attributes` is synced to every
    // participant in the room in real time via LiveKit, so this is how all
    // clients -- not just this one -- learn who the host is.
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
      // Lets a participant update their own attributes (e.g. the host
      // flagging "a local recording is in progress" -- see
      // apps/web/src/components/meeting/MeetingRoomLive.jsx). Denied by
      // default in LiveKit; each participant can still only ever write
      // their own attributes, never anyone else's.
      canUpdateOwnMetadata: true,
    });

    const token = await at.toJwt();

    // 7. Return only the safe connection details needed by the browser
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
