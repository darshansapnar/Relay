import { randomUUID } from 'crypto';
import { CHAT_MESSAGE_TYPES, CHAT_CONFIG } from '@relay/shared';
import { query } from './index.js';

/**
 * Transforms a raw PostgreSQL row from chat_messages into the application message contract.
 *
 * @param {object} row
 * @returns {object}
 */
export const formatMessageRow = row => {
  if (!row) return null;
  const createdAtDate = new Date(row.created_at);
  const timestamp = createdAtDate.getTime();

  return {
    id: row.id,
    clientMessageId: row.client_message_id || null,
    roomName: row.room_name,
    targetType: row.target_type,
    senderIdentity: row.sender_identity,
    senderName: row.sender_name,
    recipientIdentity: row.recipient_identity || null,
    recipientName: row.recipient_name || null,
    content: row.content,
    timestamp,
    createdAt: createdAtDate.toISOString(),
  };
};

/**
 * Registers or updates a participant's meeting membership record in PostgreSQL.
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {string} params.participantIdentity
 * @param {string} params.participantName
 * @param {boolean} [params.isHost=false]
 * @returns {Promise<object>}
 */
export const registerMembership = async ({
  roomName,
  participantIdentity,
  participantName,
  isHost = false,
}) => {
  const sql = `
    INSERT INTO meeting_memberships (
      room_name,
      participant_identity,
      participant_name,
      is_host,
      first_joined_at,
      last_seen_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (room_name, participant_identity)
    DO UPDATE SET
      participant_name = EXCLUDED.participant_name,
      is_host = EXCLUDED.is_host,
      last_seen_at = NOW()
    RETURNING *;
  `;

  const { rows } = await query(sql, [roomName, participantIdentity, participantName, isHost]);
  return rows[0];
};

/**
 * Verifies whether a participant has joined / been recorded in the meeting.
 *
 * @param {string} roomName
 * @param {string} participantIdentity
 * @returns {Promise<boolean>}
 */
export const isParticipantInMeeting = async (roomName, participantIdentity) => {
  if (!roomName || !participantIdentity) return false;
  const sql = `
    SELECT 1 FROM meeting_memberships
    WHERE room_name = $1 AND participant_identity = $2
    LIMIT 1;
  `;
  const { rows } = await query(sql, [roomName, participantIdentity]);
  return rows.length > 0;
};

/**
 * Retrieves a participant's registered membership record including verified display name.
 *
 * @param {string} roomName
 * @param {string} participantIdentity
 * @returns {Promise<{ participantName: string, isHost: boolean } | null>}
 */
export const getParticipantMembership = async (roomName, participantIdentity) => {
  if (!roomName || !participantIdentity) return null;
  const sql = `
    SELECT 
      participant_name AS "participantName",
      is_host AS "isHost"
    FROM meeting_memberships
    WHERE room_name = $1 AND participant_identity = $2
    LIMIT 1;
  `;
  const { rows } = await query(sql, [roomName, participantIdentity]);
  return rows[0] || null;
};

/**
 * Persists a validated chat message into PostgreSQL with deduplication support.
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {string} [params.clientMessageId]
 * @param {string} params.targetType - 'everyone' | 'direct'
 * @param {string} params.senderIdentity - Verified sender identity
 * @param {string} params.senderName - Verified sender display name
 * @param {string|null} [params.recipientIdentity] - Verified recipient identity (direct only)
 * @param {string|null} [params.recipientName] - Verified recipient display name (direct only)
 * @param {string} params.content - Validated, sanitized message content
 * @returns {Promise<object>} The persisted message
 */
export const saveMessage = async ({
  roomName,
  clientMessageId = null,
  targetType = CHAT_MESSAGE_TYPES.EVERYONE,
  senderIdentity,
  senderName,
  recipientIdentity = null,
  recipientName = null,
  content,
}) => {
  if (!roomName || !senderIdentity || !content) {
    throw new Error('Missing required message parameters.');
  }

  const id = `msg_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const cleanRecipientId = targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientIdentity : null;
  const cleanRecipientName = targetType === CHAT_MESSAGE_TYPES.DIRECT ? recipientName : null;

  // Insert query with ON CONFLICT DO NOTHING for deduplicating retried sends
  const insertSql = `
    INSERT INTO chat_messages (
      id,
      client_message_id,
      room_name,
      target_type,
      sender_identity,
      sender_name,
      recipient_identity,
      recipient_name,
      content,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (room_name, sender_identity, client_message_id) 
    WHERE client_message_id IS NOT NULL
    DO NOTHING
    RETURNING *;
  `;

  const { rows } = await query(insertSql, [
    id,
    clientMessageId,
    roomName,
    targetType,
    senderIdentity,
    senderName,
    cleanRecipientId,
    cleanRecipientName,
    content,
  ]);

  if (rows.length > 0) {
    return formatMessageRow(rows[0]);
  }

  // If a duplicate clientMessageId was submitted within the room, fetch and return the existing message
  if (clientMessageId) {
    const existingSql = `
      SELECT * FROM chat_messages
      WHERE room_name = $1 AND sender_identity = $2 AND client_message_id = $3
      LIMIT 1;
    `;
    const existing = await query(existingSql, [roomName, senderIdentity, clientMessageId]);
    if (existing.rows.length > 0) {
      return formatMessageRow(existing.rows[0]);
    }
  }

  throw new Error('Failed to persist message.');
};

/**
 * Retrieves authorized messages for a participant with pagination.
 * Guarantees that private messages between other participants are NEVER included.
 *
 * @param {object} options
 * @param {string} options.roomName
 * @param {string} options.participantIdentity
 * @param {number} [options.limit=50]
 * @param {string|number} [options.before] - Cursor: retrieve messages older than this timestamp/ISO
 * @param {string} [options.targetType] - 'everyone' | 'direct' (optional filter)
 * @param {string} [options.peerIdentity] - Direct conversation peer identity (optional filter)
 * @returns {Promise<{ messages: Array<object>, hasMore: boolean, nextCursor: string|null }>}
 */
export const getAuthorizedMessages = async ({
  roomName,
  participantIdentity,
  limit = CHAT_CONFIG.DEFAULT_PAGE_SIZE || 50,
  before = null,
  targetType = null,
  peerIdentity = null,
}) => {
  if (!roomName || !participantIdentity) {
    return { messages: [], hasMore: false, nextCursor: null };
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
  const values = [roomName, participantIdentity];
  let paramIdx = 3;

  // Security boundary: caller only sees Everyone messages or Direct messages where they are sender or recipient
  let whereClauses = `
    room_name = $1 AND (
      target_type = 'everyone' OR
      (target_type = 'direct' AND (sender_identity = $2 OR recipient_identity = $2))
    )
  `;

  if (targetType === CHAT_MESSAGE_TYPES.EVERYONE) {
    whereClauses += ` AND target_type = 'everyone'`;
  } else if (targetType === CHAT_MESSAGE_TYPES.DIRECT) {
    whereClauses += ` AND target_type = 'direct'`;
    if (peerIdentity) {
      whereClauses += ` AND ((sender_identity = $2 AND recipient_identity = $${paramIdx}) OR (sender_identity = $${paramIdx} AND recipient_identity = $2))`;
      values.push(peerIdentity);
      paramIdx++;
    }
  }

  if (before) {
    const beforeDate = new Date(isNaN(Number(before)) ? before : Number(before));
    if (!isNaN(beforeDate.getTime())) {
      whereClauses += ` AND created_at < $${paramIdx}`;
      values.push(beforeDate.toISOString());
      paramIdx++;
    }
  }

  // Fetch limit + 1 to reliably determine hasMore
  values.push(safeLimit + 1);
  const sql = `
    SELECT * FROM chat_messages
    WHERE ${whereClauses}
    ORDER BY created_at DESC
    LIMIT $${paramIdx};
  `;

  const { rows } = await query(sql, values);
  const hasMore = rows.length > safeLimit;
  const resultRows = hasMore ? rows.slice(0, safeLimit) : rows;

  // Reverse so client receives chronological order (oldest to newest)
  resultRows.reverse();
  const messages = resultRows.map(formatMessageRow);
  const nextCursor = hasMore && messages.length > 0 ? messages[0].createdAt : null;

  return {
    messages,
    hasMore,
    nextCursor,
  };
};

/**
 * Updates a participant's read state for a conversation.
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {string} params.participantIdentity
 * @param {string} params.targetType - 'everyone' | 'direct'
 * @param {string} [params.peerIdentity='']
 * @param {string} [params.lastReadMessageId=null]
 * @returns {Promise<void>}
 */
export const markReadState = async ({
  roomName,
  participantIdentity,
  targetType,
  peerIdentity = '',
  lastReadMessageId = null,
}) => {
  const sql = `
    INSERT INTO chat_read_states (
      room_name,
      participant_identity,
      target_type,
      peer_identity,
      last_read_message_id,
      last_read_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (room_name, participant_identity, target_type, peer_identity)
    DO UPDATE SET
      last_read_message_id = EXCLUDED.last_read_message_id,
      last_read_at = NOW();
  `;
  await query(sql, [roomName, participantIdentity, targetType, peerIdentity, lastReadMessageId]);
};

/**
 * Calculates unread message counts for a participant.
 *
 * @param {string} roomName
 * @param {string} participantIdentity
 * @returns {Promise<{ everyone: number, directTotal: number, directByPeer: Record<string, number> }>}
 */
export const getUnreadCounts = async (roomName, participantIdentity) => {
  if (!roomName || !participantIdentity) {
    return { everyone: 0, directTotal: 0, directByPeer: {} };
  }

  // 1. Everyone unread count
  const everyoneSql = `
    SELECT COUNT(*)::int AS count
    FROM chat_messages m
    WHERE m.room_name = $1
      AND m.target_type = 'everyone'
      AND m.sender_identity != $2
      AND m.created_at > COALESCE(
        (SELECT last_read_at FROM chat_read_states r
         WHERE r.room_name = $1 AND r.participant_identity = $2 AND r.target_type = 'everyone' AND r.peer_identity = ''),
        '1970-01-01'::timestamptz
      );
  `;
  const { rows: everyoneRows } = await query(everyoneSql, [roomName, participantIdentity]);
  const everyoneUnread = everyoneRows[0]?.count || 0;

  // 2. Direct unread counts grouped by sender peer
  const directSql = `
    SELECT m.sender_identity, COUNT(*)::int AS count
    FROM chat_messages m
    WHERE m.room_name = $1
      AND m.target_type = 'direct'
      AND m.recipient_identity = $2
      AND m.created_at > COALESCE(
        (SELECT last_read_at FROM chat_read_states r
         WHERE r.room_name = $1 AND r.participant_identity = $2 AND r.target_type = 'direct' AND r.peer_identity = m.sender_identity),
        '1970-01-01'::timestamptz
      )
    GROUP BY m.sender_identity;
  `;
  const { rows: directRows } = await query(directSql, [roomName, participantIdentity]);

  const directByPeer = {};
  let directTotal = 0;
  for (const row of directRows) {
    directByPeer[row.sender_identity] = row.count;
    directTotal += row.count;
  }

  return {
    everyone: everyoneUnread,
    directTotal,
    directByPeer,
  };
};

/**
 * Clears room chat data (used for testing or host cleanup).
 *
 * @param {string} roomName
 * @returns {Promise<void>}
 */
export const clearRoomData = async roomName => {
  await query('DELETE FROM chat_messages WHERE room_name = $1;', [roomName]);
  await query('DELETE FROM chat_read_states WHERE room_name = $1;', [roomName]);
  await query('DELETE FROM meeting_memberships WHERE room_name = $1;', [roomName]);
};
