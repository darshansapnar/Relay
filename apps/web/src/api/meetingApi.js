async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data?.error?.message || `Server returned ${response.status} ${response.statusText}`;
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

/**
 * API client helper to request a LiveKit access token from the Relay backend
 */
export async function requestMeetingToken(roomName, participantName) {
  const response = await fetch('/api/meetings/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomName,
      participantName,
    }),
  });

  return parseJsonResponse(response);
}

/**
 * Host-only moderation calls. Each requires the caller's own LiveKit access
 * token (issued by requestMeetingToken) as proof of identity -- the backend
 * verifies it's genuinely signed by our server and that the identity it
 * contains matches the room's recorded host before doing anything. A
 * non-host token, or no token, is rejected server-side regardless of what
 * the UI shows.
 */
export async function muteParticipant(roomName, identity, muted, hostToken) {
  const response = await fetch(
    `/api/meetings/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}/mute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ muted }),
    }
  );

  return parseJsonResponse(response);
}

export async function setParticipantCamera(roomName, identity, disabled, hostToken) {
  const response = await fetch(
    `/api/meetings/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}/camera`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ disabled }),
    }
  );

  return parseJsonResponse(response);
}

export async function removeParticipant(roomName, identity, hostToken) {
  const response = await fetch(
    `/api/meetings/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}/remove`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    }
  );

  return parseJsonResponse(response);
}

export async function endMeeting(roomName, hostToken) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(roomName)}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hostToken}` },
  });

  return parseJsonResponse(response);
}

// Meeting recording is browser-local (Web Audio mixing + MediaRecorder,
// see utils/localAudioRecorder.js) -- there is no backend involvement and
// so no API calls for it here.
