/**
 * Local recording: the room-wide "is this room being recorded" state lives
 * in the host's own LiveKit participant attributes (localRecording /
 * localRecordingStartedAt / localRecordingHostName, set via
 * localParticipant.setAttributes() in MeetingRoomLive.jsx), not here.
 * Attributes are synced by LiveKit to every participant automatically, on
 * every change AND as part of a participant's initial room-state sync when
 * they connect -- which is what lets someone who joins mid-recording see
 * the banner immediately, something a one-shot data-channel broadcast
 * cannot do (there is no "replay the last message" for a participant who
 * subscribes after it was sent).
 *
 * What genuinely needs a point-in-time, peer-to-peer message instead of
 * persistent state is a participant withdrawing consent: it's an action,
 * not a fact about the room, and only the host needs to react to it. That
 * one message type is carried over LiveKit's existing real-time data
 * channel (room.localParticipant.publishData / RoomEvent.DataReceived,
 * exposed in React via useDataChannel -- the same mechanism
 * hostRequests.js uses).
 */

export const LOCAL_RECORDING_TOPIC = 'relay-local-recording';

export const LOCAL_RECORDING_STATUS = Object.freeze({
  IDLE: 'idle',
  RECORDING: 'recording',
  STOPPED: 'stopped',
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeRecordingMessage(message) {
  return encoder.encode(JSON.stringify(message));
}

/** Returns the parsed message object, or null if it isn't one of ours. */
export function decodeRecordingMessage(payload) {
  try {
    const parsed = JSON.parse(decoder.decode(payload));
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed;
    }
  } catch {
    // Not JSON, or not shaped like our protocol -- ignore rather than throw,
    // since the data channel is shared with other message types (see
    // hostRequests.js's HOST_CONTROL_TOPIC).
  }
  return null;
}

/** Any participant -> host: explicit withdrawal of consent; the host must stop immediately. */
export function buildConsentDeclineMessage() {
  return { type: 'relay:local-recording-decline' };
}

export function isConsentDeclineMessage(message) {
  return Boolean(message) && message.type === 'relay:local-recording-decline';
}

export const isActiveRecordingStatus = status => status === LOCAL_RECORDING_STATUS.RECORDING;
