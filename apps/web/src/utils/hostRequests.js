/**
 * Payload protocol for the host "request to unmute" / "request to enable
 * camera" workflow, carried over LiveKit's existing real-time data channel
 * (room.localParticipant.publishData / RoomEvent.DataReceived, exposed in
 * React via useDataChannel). The host can revoke a participant's publish
 * permission unilaterally, but can never *grant* it without that
 * participant's own browser acting -- a microphone or camera can only be
 * (re)activated by the person sitting at that device. These messages are
 * how the host asks, and how the participant's accept/decline reaches back
 * to the host, entirely client-to-client -- no fake local-only state.
 */

export const HOST_CONTROL_TOPIC = 'relay-host-control';

export const REQUEST_ACTIONS = Object.freeze({
  UNMUTE: 'unmute',
  ENABLE_CAMERA: 'enable-camera',
});

export const RESPONSE_STATUSES = Object.freeze({
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  FAILED: 'failed',
});

// Client-local UI statuses, never sent over the wire. LiveKit's data API has
// no delivery acknowledgement -- publishData() resolves once the message
// reaches the SFU, not once (or whether) the recipient actually sees it. So
// "sent" must never be presented as "delivered": if no accepted/declined
// response (see RESPONSE_STATUSES above) arrives within this window, the UI
// should say so plainly instead of leaving "Request sent" up indefinitely.
export const LOCAL_REQUEST_STATUSES = Object.freeze({
  SENT: 'sent',
  NO_RESPONSE: 'no-response',
});

export const REQUEST_RESPONSE_TIMEOUT_MS = 20000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeHostMessage(message) {
  return encoder.encode(JSON.stringify(message));
}

/** Returns the parsed message object, or null if it isn't one of ours. */
export function decodeHostMessage(payload) {
  try {
    const parsed = JSON.parse(decoder.decode(payload));
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed;
    }
  } catch {
    // Not JSON, or not shaped like our protocol -- ignore rather than throw,
    // since the data channel is shared and other message types may exist.
  }
  return null;
}

export function buildRequestMessage({ requestId, action }) {
  return { type: 'relay:request', requestId, action };
}

export function buildResponseMessage({ requestId, action, status }) {
  return { type: 'relay:request-response', requestId, action, status };
}

export function isRequestMessage(message) {
  return Boolean(message) && message.type === 'relay:request';
}

export function isResponseMessage(message) {
  return Boolean(message) && message.type === 'relay:request-response';
}
