import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { config } from '../config/index.js';

let roomServiceClient = null;
let tokenVerifier = null;

/**
 * Lazily-constructed RoomServiceClient for server-side room administration
 * (host determination, mute/remove participant, end meeting). Only usable
 * once LIVEKIT_URL/API_KEY/API_SECRET are present -- callers must check
 * config.livekit.isConfigured first, same as the token endpoint does.
 */
export const getRoomServiceClient = () => {
  if (!config.livekit.isConfigured) {
    throw new Error('LiveKit server configuration is incomplete.');
  }
  if (!roomServiceClient) {
    roomServiceClient = new RoomServiceClient(
      config.livekit.url,
      config.livekit.apiKey,
      config.livekit.apiSecret
    );
  }
  return roomServiceClient;
};

/**
 * Lazily-constructed TokenVerifier used to cryptographically verify a
 * participant's own LiveKit access token on moderation requests, so "am I
 * allowed to do this" is proven by a signature only our backend could have
 * issued, rather than trusting a bare identity string supplied by the client.
 */
export const getTokenVerifier = () => {
  if (!config.livekit.isConfigured) {
    throw new Error('LiveKit server configuration is incomplete.');
  }
  if (!tokenVerifier) {
    tokenVerifier = new TokenVerifier(config.livekit.apiKey, config.livekit.apiSecret);
  }
  return tokenVerifier;
};

const ROOM_HOST_METADATA_VERSION = 1;

export const buildRoomMetadata = ({ hostIdentity }) =>
  JSON.stringify({ v: ROOM_HOST_METADATA_VERSION, hostIdentity });

export const parseRoomMetadata = metadata => {
  if (!metadata) return { hostIdentity: null };
  try {
    const parsed = JSON.parse(metadata);
    return { hostIdentity: typeof parsed.hostIdentity === 'string' ? parsed.hostIdentity : null };
  } catch {
    return { hostIdentity: null };
  }
};

export const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/**
 * Verifies that the caller presented -- via `Authorization: Bearer <token>`
 * -- a LiveKit access token our backend actually minted (signature check),
 * scoped to this specific room. This is the baseline proof of "I am a real
 * participant in this room", shared by every moderation/recording route
 * below; it does not by itself prove the caller is the host.
/**
 * Cryptographically verifies a raw LiveKit access token and asserts room scope.
 *
 * @param {string} token - LiveKit JWT token
 * @param {string} [expectedRoomName] - If provided, asserts token is scoped to this room
 * @returns {Promise<{ identity: string, name: string, roomName: string, isHost: boolean, claims: object }>}
 */
export const verifyRawToken = async (token, expectedRoomName) => {
  if (!token || typeof token !== 'string') {
    throw httpError(401, 'Missing or malformed access token.');
  }

  let claims;
  try {
    claims = await getTokenVerifier().verify(token);
  } catch {
    throw httpError(401, 'Invalid or expired access token.');
  }

  const identity = claims.sub;
  if (!identity) {
    throw httpError(401, 'Access token is missing a participant identity.');
  }

  const roomName = claims.video?.room;
  if (expectedRoomName && roomName !== expectedRoomName) {
    throw httpError(403, 'This access token is not scoped to the requested room.');
  }

  const isHost =
    claims.attributes?.role === 'host' ||
    (typeof claims.metadata === 'string' && claims.metadata.includes('host'));

  return {
    identity,
    name: claims.name || identity,
    roomName: roomName || expectedRoomName,
    isHost: Boolean(isHost),
    claims,
  };
};

/**
 * Verifies that the caller presented -- via `Authorization: Bearer <token>`
 * -- a LiveKit access token our backend actually minted (signature check),
 * scoped to this specific room. This is the baseline proof of "I am a real
 * participant in this room", shared by every moderation/recording route
 * below; it does not by itself prove the caller is the host.
 *
 * Returns `{ identity, name }` for the verified requester on success, or
 * throws an Error with a `.statusCode` (401/403) describing why
 * verification failed.
 */
export const verifyParticipantToken = async (req, roomName) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw httpError(401, 'Missing or malformed Authorization header.');
  }

  return verifyRawToken(token, roomName);
};

/**
 * Authorizes a moderation or recording request (mute/remove participant,
 * end meeting, start/stop/download recording).
 *
 * Hiding buttons in the UI is not authorization: anyone can call these HTTP
 * routes directly. verifyParticipantToken() above proves the caller is some
 * real participant in the room; this additionally checks that identity
 * against the host identity recorded in the room's own metadata when the
 * room was created. Only then is the caller treated as the host.
 *
 * Returns `{ identity, name }` for the verified host on success, or throws
 * an Error with a `.statusCode` (401/403/404) describing why authorization
 * failed.
 */
export const authorizeHostRequest = async (req, roomName) => {
  const requester = await verifyParticipantToken(req, roomName);

  let hostIdentity = null;
  try {
    const rooms = await getRoomServiceClient().listRooms([roomName]);
    if (rooms.length > 0) {
      hostIdentity = parseRoomMetadata(rooms[0].metadata).hostIdentity;
    }
  } catch (err) {
    console.warn('[Relay LiveKit] listRooms notice in authorizeHostRequest:', err.message);
  }

  if (!hostIdentity) {
    const { accessControlService } = await import('./accessControlService.js');
    const accessState = await accessControlService.getAccessState(roomName).catch(() => null);
    if (accessState?.hostIdentity) {
      hostIdentity = accessState.hostIdentity;
    }
  }

  if (!hostIdentity) {
    throw httpError(404, 'Room not found.');
  }

  if (hostIdentity !== requester.identity) {
    throw httpError(403, 'Only the meeting host can perform this action.');
  }

  return requester;
};
