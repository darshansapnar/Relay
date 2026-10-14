async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data?.error?.message || `Server returned ${response.status} ${response.statusText}`;
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    error.code = data?.error?.code;
    error.details = data;
    throw error;
  }

  return data;
}

/**
 * Fetches authorized chat history for the meeting participant.
 *
 * @param {string} roomName
 * @param {string} token - Caller's verified LiveKit JWT access token
 * @param {object} [params] - Optional query parameters { limit, before, targetType, peerIdentity }
 * @returns {Promise<{ success: boolean, messages: Array<object>, hasMore: boolean, nextCursor: string|null, participantIdentity: string }>}
 */
export async function fetchMeetingMessages(roomName, token, params = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.before) query.set('before', String(params.before));
  if (params.targetType) query.set('targetType', params.targetType);
  if (params.peerIdentity) query.set('peerIdentity', params.peerIdentity);

  const qs = query.toString();
  const endpoint = `/api/meetings/${encodeURIComponent(roomName)}/messages${qs ? `?${qs}` : ''}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse(response);
}

/**
 * Sends a chat message via HTTP REST endpoint.
 *
 * @param {string} roomName
 * @param {string} token - Caller's verified LiveKit JWT access token
 * @param {object} payload - { content, targetType, recipientIdentity, recipientName, clientMessageId }
 * @returns {Promise<{ success: boolean, message: object }>}
 */
export async function sendMeetingMessageRest(roomName, token, payload) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(roomName)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
}
