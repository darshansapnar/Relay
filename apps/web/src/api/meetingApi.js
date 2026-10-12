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
