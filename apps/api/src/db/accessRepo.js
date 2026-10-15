import { query } from './index.js';

/**
 * Persists or updates the meeting access state (host identity, waiting room, lock state).
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {string} params.hostIdentity
 * @param {boolean} [params.waitingRoomEnabled=false]
 * @param {boolean} [params.isLocked=false]
 * @returns {Promise<object>}
 */
export const saveMeetingAccessState = async ({
  roomName,
  hostIdentity,
  waitingRoomEnabled = false,
  isLocked = false,
}) => {
  const sql = `
    INSERT INTO meeting_access_states (room_name, host_identity, waiting_room_enabled, is_locked, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (room_name)
    DO UPDATE SET
      waiting_room_enabled = EXCLUDED.waiting_room_enabled,
      is_locked = EXCLUDED.is_locked,
      host_identity = COALESCE(meeting_access_states.host_identity, EXCLUDED.host_identity),
      updated_at = NOW()
    RETURNING room_name AS "roomName",
              host_identity AS "hostIdentity",
              waiting_room_enabled AS "waitingRoomEnabled",
              is_locked AS "isLocked",
              created_at AS "createdAt",
              updated_at AS "updatedAt";
  `;
  const { rows } = await query(sql, [roomName, hostIdentity, waitingRoomEnabled, isLocked]);
  return rows[0] || null;
};

/**
 * Retrieves the access state for a given room.
 *
 * @param {string} roomName
 * @returns {Promise<object | null>}
 */
export const getMeetingAccessState = async roomName => {
  const sql = `
    SELECT room_name AS "roomName",
           host_identity AS "hostIdentity",
           waiting_room_enabled AS "waitingRoomEnabled",
           is_locked AS "isLocked",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
    FROM meeting_access_states
    WHERE room_name = $1;
  `;
  const { rows } = await query(sql, [roomName]);
  return rows[0] || null;
};

/**
 * Updates the lock state of a meeting.
 *
 * @param {string} roomName
 * @param {boolean} isLocked
 * @returns {Promise<object | null>}
 */
export const setMeetingLockState = async (roomName, isLocked) => {
  const sql = `
    UPDATE meeting_access_states
    SET is_locked = $2,
        updated_at = NOW()
    WHERE room_name = $1
    RETURNING room_name AS "roomName",
              host_identity AS "hostIdentity",
              waiting_room_enabled AS "waitingRoomEnabled",
              is_locked AS "isLocked",
              created_at AS "createdAt",
              updated_at AS "updatedAt";
  `;
  const { rows } = await query(sql, [roomName, isLocked]);
  return rows[0] || null;
};

/**
 * Saves or updates a participant access entry (status: 'waiting' | 'approved' | 'rejected' | 'removed').
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {string} params.participantIdentity
 * @param {string} params.participantName
 * @param {string} params.status
 * @returns {Promise<object>}
 */
export const saveAccessEntry = async ({
  roomName,
  participantIdentity,
  participantName,
  status = 'waiting',
}) => {
  const sql = `
    INSERT INTO meeting_access_entries (room_name, participant_identity, participant_name, status, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (room_name, participant_identity)
    DO UPDATE SET
      status = EXCLUDED.status,
      participant_name = EXCLUDED.participant_name,
      updated_at = NOW()
    RETURNING room_name AS "roomName",
              participant_identity AS "participantIdentity",
              participant_name AS "participantName",
              status,
              created_at AS "createdAt",
              updated_at AS "updatedAt";
  `;
  const { rows } = await query(sql, [roomName, participantIdentity, participantName, status]);
  return rows[0] || null;
};

/**
 * Retrieves the access entry for a specific participant in a room.
 *
 * @param {string} roomName
 * @param {string} participantIdentity
 * @returns {Promise<object | null>}
 */
export const getAccessEntry = async (roomName, participantIdentity) => {
  const sql = `
    SELECT room_name AS "roomName",
           participant_identity AS "participantIdentity",
           participant_name AS "participantName",
           status,
           created_at AS "createdAt",
           updated_at AS "updatedAt"
    FROM meeting_access_entries
    WHERE room_name = $1 AND participant_identity = $2;
  `;
  const { rows } = await query(sql, [roomName, participantIdentity]);
  return rows[0] || null;
};

/**
 * Retrieves all currently waiting participants in a room.
 *
 * @param {string} roomName
 * @returns {Promise<Array<object>>}
 */
export const getWaitingEntries = async roomName => {
  const sql = `
    SELECT participant_identity AS "identity",
           participant_name AS "name",
           status,
           created_at AS "createdAt",
           updated_at AS "updatedAt"
    FROM meeting_access_entries
    WHERE room_name = $1 AND status = 'waiting'
    ORDER BY created_at ASC;
  `;
  const { rows } = await query(sql, [roomName]);
  return rows || [];
};

/**
 * Updates the access status of a participant (e.g. 'approved', 'rejected', 'removed').
 *
 * @param {string} roomName
 * @param {string} participantIdentity
 * @param {string} status
 * @returns {Promise<object | null>}
 */
export const updateAccessEntryStatus = async (roomName, participantIdentity, status) => {
  const sql = `
    UPDATE meeting_access_entries
    SET status = $3,
        updated_at = NOW()
    WHERE room_name = $1 AND participant_identity = $2
    RETURNING room_name AS "roomName",
              participant_identity AS "participantIdentity",
              participant_name AS "participantName",
              status,
              created_at AS "createdAt",
              updated_at AS "updatedAt";
  `;
  const { rows } = await query(sql, [roomName, participantIdentity, status]);
  return rows[0] || null;
};

/**
 * Clears access data for a deleted/ended meeting room.
 *
 * @param {string} roomName
 * @returns {Promise<void>}
 */
export const deleteMeetingAccess = async roomName => {
  await query('DELETE FROM meeting_access_entries WHERE room_name = $1;', [roomName]);
  await query('DELETE FROM meeting_access_states WHERE room_name = $1;', [roomName]);
};
