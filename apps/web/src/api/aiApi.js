/**
 * Client API for AI Meeting Assistant endpoints.
 */

const getApiBaseUrl = () => {
  if (import.meta.env.DEV) return '';
  const url = import.meta.env.VITE_API_URL || '';
  return url.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

/**
 * Retrieves current AI assistant state for a meeting.
 */
export const getAIState = async (roomName, token) => {
  const res = await fetch(`${getApiBaseUrl()}/api/meetings/${encodeURIComponent(roomName)}/ai/state`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch AI state: ${res.statusText}`);
  }

  return res.json();
};

/**
 * Toggles AI assistant state (active / inactive) with consent.
 */
export const toggleAIState = async (roomName, token, { isActive, consentGranted }) => {
  const res = await fetch(`${getApiBaseUrl()}/api/meetings/${encodeURIComponent(roomName)}/ai/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive, consentGranted }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to toggle AI state: ${res.statusText}`);
  }

  return res.json();
};

/**
 * Retrieves meeting transcripts.
 */
export const getTranscripts = async (roomName, token, { limit = 100, offset = 0 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(
    `${getApiBaseUrl()}/api/meetings/${encodeURIComponent(roomName)}/ai/transcripts?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch transcripts: ${res.statusText}`);
  }

  return res.json();
};

/**
 * Triggers an immediate summary generation.
 */
export const triggerSummary = async (roomName, token) => {
  const res = await fetch(
    `${getApiBaseUrl()}/api/meetings/${encodeURIComponent(roomName)}/ai/summary/trigger`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to trigger summary: ${res.statusText}`);
  }

  return res.json();
};
