import { TrackSource } from 'livekit-server-sdk';
import { config } from '../config/index.js';
import { getRoomServiceClient, authorizeHostRequest } from '../services/livekitAdmin.js';
import { chatStore } from '../services/chatStore.js';

const sendAuthzError = (res, err) => {
  if (err.statusCode) {
    res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, statusCode: err.statusCode },
    });
    return true;
  }
  return false;
};

const unconfiguredResponse = res =>
  res.status(503).json({
    success: false,
    error: {
      message: 'LiveKit server configuration is incomplete on the backend.',
      statusCode: 503,
    },
  });

const ALL_PUBLISHABLE_SOURCES = [
  TrackSource.CAMERA,
  TrackSource.MICROPHONE,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

/**
 * Both a mic restriction and a camera restriction are expressed through the
 * same `canPublishSources` allow-list, and LiveKit's updateParticipant
 * replaces that list atomically (it does not merge with what's already
 * there -- see the SDK's own doc comment on UpdateParticipantOptions). So
 * every write here must start from the target's *current* restriction state
 * for the other track, not just the one being changed, or e.g. muting
 * someone's mic would silently also lift an existing camera restriction.
 */
export const computeAllowedSources = ({ micDisabled, cameraDisabled }) =>
  ALL_PUBLISHABLE_SOURCES.filter(source => {
    if (micDisabled && source === TrackSource.MICROPHONE) return false;
    if (cameraDisabled && source === TrackSource.CAMERA) return false;
    return true;
  });

const boolAttr = value => value === 'true';

/**
 * Looks up a participant in the room and applies a host-controlled
 * restriction to one of their track sources: mutes/unmutes their current
 * published track of that kind (if any) and persists the publish
 * restriction via canPublishSources, preserving whatever restriction
 * already applies to their *other* track kind.
 */
const applyHostTrackRestriction = async ({ roomService, roomName, identity, source, disabled }) => {
  const participants = await roomService.listParticipants(roomName);
  const target = participants.find(p => p.identity === identity);
  if (!target) {
    const err = new Error('Participant not found in this room.');
    err.statusCode = 404;
    throw err;
  }

  const currentlyMicDisabled = boolAttr(target.attributes?.mutedByHost);
  const currentlyCameraDisabled = boolAttr(target.attributes?.cameraDisabledByHost);
  const micDisabled = source === TrackSource.MICROPHONE ? disabled : currentlyMicDisabled;
  const cameraDisabled = source === TrackSource.CAMERA ? disabled : currentlyCameraDisabled;

  const liveTrack = target.tracks.find(t => t.source === source);
  if (liveTrack) {
    await roomService.mutePublishedTrack(roomName, identity, liveTrack.sid, disabled);
  }

  await roomService.updateParticipant(roomName, identity, {
    attributes: {
      mutedByHost: micDisabled ? 'true' : 'false',
      cameraDisabledByHost: cameraDisabled ? 'true' : 'false',
    },
    permission: {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: computeAllowedSources({ micDisabled, cameraDisabled }),
    },
  });
};

/**
 * POST /api/meetings/:roomName/participants/:identity/mute
 * Body: { muted: boolean }
 *
 * Host-only. Immediately mutes (or restores) the target's current
 * microphone track, and -- unlike a participant muting themselves --
 * persists the restriction server-side via `canPublishSources` so the
 * participant cannot simply republish/unmute their own microphone while the
 * host has silenced them. `muted: false` lifts that restriction again (used
 * by the "request to unmute" workflow before asking the participant to
 * unmute themselves -- the host can lift the block, but only the
 * participant's own browser can actually (re)activate their microphone).
 */
export const setParticipantMuted = async (req, res, next) => {
  try {
    if (!config.livekit.isConfigured) return unconfiguredResponse(res);

    const { roomName, identity } = req.params;
    const { muted } = req.body || {};
    if (!roomName || !identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName and identity are required.', statusCode: 400 },
      });
    }
    if (typeof muted !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: '`muted` must be a boolean.', statusCode: 400 },
      });
    }

    const { identity: requesterIdentity } = await authorizeHostRequest(req, roomName);
    if (requesterIdentity === identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'The host cannot moderate their own microphone.', statusCode: 400 },
      });
    }

    const roomService = getRoomServiceClient();
    await applyHostTrackRestriction({
      roomService,
      roomName,
      identity,
      source: TrackSource.MICROPHONE,
      disabled: muted,
    });

    return res.status(200).json({ success: true, identity, muted });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/participants/:identity/camera
 * Body: { disabled: boolean }
 *
 * Host-only. Mirrors setParticipantMuted but for the camera track. Disabling
 * someone's camera does not, and cannot, imply it is still "active" in any
 * sense visible to Relay -- the participant's published camera track is
 * muted/unpublished and canPublishSources blocks republishing until the
 * host (directly, or via a "request to enable camera") lifts it.
 */
export const setParticipantCameraDisabled = async (req, res, next) => {
  try {
    if (!config.livekit.isConfigured) return unconfiguredResponse(res);

    const { roomName, identity } = req.params;
    const { disabled } = req.body || {};
    if (!roomName || !identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName and identity are required.', statusCode: 400 },
      });
    }
    if (typeof disabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: '`disabled` must be a boolean.', statusCode: 400 },
      });
    }

    const { identity: requesterIdentity } = await authorizeHostRequest(req, roomName);
    if (requesterIdentity === identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'The host cannot moderate their own camera.', statusCode: 400 },
      });
    }

    const roomService = getRoomServiceClient();
    await applyHostTrackRestriction({
      roomService,
      roomName,
      identity,
      source: TrackSource.CAMERA,
      disabled,
    });

    return res.status(200).json({ success: true, identity, disabled });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/participants/:identity/remove
 * Host-only. Disconnects the target participant from the room.
 */
export const removeParticipantFromRoom = async (req, res, next) => {
  try {
    if (!config.livekit.isConfigured) return unconfiguredResponse(res);

    const { roomName, identity } = req.params;
    if (!roomName || !identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName and identity are required.', statusCode: 400 },
      });
    }

    const { identity: requesterIdentity } = await authorizeHostRequest(req, roomName);
    if (requesterIdentity === identity) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'The host cannot remove themselves. Use Leave or End Meeting instead.',
          statusCode: 400,
        },
      });
    }

    await getRoomServiceClient().removeParticipant(roomName, identity);

    return res.status(200).json({ success: true, identity });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/end
 * Host-only. Ends the meeting for every participant, including the host.
 */
export const endMeetingForEveryone = async (req, res, next) => {
  try {
    if (!config.livekit.isConfigured) return unconfiguredResponse(res);

    const { roomName } = req.params;
    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName is required.', statusCode: 400 },
      });
    }

    await authorizeHostRequest(req, roomName);

    // Attempt final meeting summary if transcript exists and quota permits
    try {
      const { aiManager } = await import('../services/aiManager.js');
      await aiManager.maybeTriggerSummary(roomName, { force: false, isMeetingEnd: true });
    } catch (summaryErr) {
      console.warn(`[Relay AI] Final meeting summary attempt noticed for ${roomName}:`, summaryErr.message);
    }

    await getRoomServiceClient().deleteRoom(roomName);
    chatStore.clearRoom(roomName);

    return res.status(200).json({ success: true });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};
