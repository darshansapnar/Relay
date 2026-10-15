import { TrackSource } from 'livekit-server-sdk';
import { config } from '../config/index.js';
import {
  getRoomServiceClient,
  authorizeHostRequest,
  verifyParticipantToken,
} from '../services/livekitAdmin.js';
import { chatStore } from '../services/chatStore.js';
import { accessControlService } from '../services/accessControlService.js';

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

export const computeAllowedSources = ({ micDisabled, cameraDisabled }) =>
  ALL_PUBLISHABLE_SOURCES.filter(source => {
    if (micDisabled && source === TrackSource.MICROPHONE) return false;
    if (cameraDisabled && source === TrackSource.CAMERA) return false;
    return true;
  });

const boolAttr = value => value === 'true';

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
 * Host-only. Disconnects target participant from room and records removal to prevent rejoining.
 */
export const removeParticipantFromRoom = async (req, res, next) => {
  try {
    if (!config.livekit.isConfigured) return unconfiguredResponse(res);

    const { roomName, identity } = req.params;
    const { participantName } = req.body || {};
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

    // 1. Record participant as removed in accessControlService
    await accessControlService.removeParticipant(roomName, identity, participantName || 'Participant');

    // 2. Disconnect participant from LiveKit
    try {
      await getRoomServiceClient().removeParticipant(roomName, identity);
    } catch (lkErr) {
      console.warn(`[Relay Host] LiveKit removal warning for ${identity}:`, lkErr.message);
    }

    return res.status(200).json({ success: true, identity });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/lock
 * Host-only. Locks or unlocks the meeting room.
 */
export const setMeetingLock = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    const { locked } = req.body || {};

    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName is required.', statusCode: 400 },
      });
    }
    if (typeof locked !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: '`locked` must be a boolean.', statusCode: 400 },
      });
    }

    await authorizeHostRequest(req, roomName);
    const result = await accessControlService.setMeetingLocked(roomName, locked);

    return res.status(200).json({ success: true, isLocked: result.isLocked });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * GET /api/meetings/:roomName/access-state
 * Allows any authenticated meeting participant to check current room lock and waiting-room status.
 */
export const getMeetingAccessStateEndpoint = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName is required.', statusCode: 400 },
      });
    }

    const participant = await verifyParticipantToken(req, roomName);
    const state = await accessControlService.getAccessState(roomName);

    return res.status(200).json({
      success: true,
      waitingRoomEnabled: state.waitingRoomEnabled,
      isLocked: state.isLocked,
      isHost: participant.isHost,
    });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * GET /api/meetings/:roomName/waiting-room
 * Host-only. Returns the list of currently waiting participants.
 */
export const getWaitingParticipantsEndpoint = async (req, res, next) => {
  try {
    const { roomName } = req.params;
    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName is required.', statusCode: 400 },
      });
    }

    await authorizeHostRequest(req, roomName);
    const waitingParticipants = await accessControlService.getWaitingParticipants(roomName);

    return res.status(200).json({ success: true, waitingParticipants });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/waiting-room/:identity/admit
 * Host-only. Admits a waiting participant into the meeting.
 */
export const admitWaitingParticipantEndpoint = async (req, res, next) => {
  try {
    const { roomName, identity } = req.params;
    if (!roomName || !identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName and identity are required.', statusCode: 400 },
      });
    }

    await authorizeHostRequest(req, roomName);
    const result = await accessControlService.admitParticipant(roomName, identity);

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};

/**
 * POST /api/meetings/:roomName/waiting-room/:identity/reject
 * Host-only. Declines admission for a waiting participant.
 */
export const rejectWaitingParticipantEndpoint = async (req, res, next) => {
  try {
    const { roomName, identity } = req.params;
    if (!roomName || !identity) {
      return res.status(400).json({
        success: false,
        error: { message: 'roomName and identity are required.', statusCode: 400 },
      });
    }

    await authorizeHostRequest(req, roomName);
    const result = await accessControlService.rejectParticipant(roomName, identity);

    return res.status(200).json({ success: true, ...result });
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

    await accessControlService.clearRoom(roomName);
    await getRoomServiceClient().deleteRoom(roomName);
    chatStore.clearRoom(roomName);

    return res.status(200).json({ success: true });
  } catch (err) {
    if (sendAuthzError(res, err)) return undefined;
    return next(err);
  }
};
