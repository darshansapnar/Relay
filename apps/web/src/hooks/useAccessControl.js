import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  lockMeeting,
  getMeetingAccessState,
  getWaitingParticipants,
  admitWaitingParticipant,
  rejectWaitingParticipant,
  removeParticipant,
} from '../api/meetingApi.js';

/**
 * Custom React hook for meeting access control:
 * - Room Lock/Unlock state
 * - Waiting room participants and admission/rejection
 * - Participant removal and real-time removal enforcement
 */
export const useAccessControl = ({
  token,
  roomName,
  isHost = false,
  localParticipantIdentity = '',
  onParticipantRemovedSelf,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // Load initial access control state and waiting list
  const refreshAccessState = useCallback(async () => {
    if (!token || !roomName) return;
    try {
      const state = await getMeetingAccessState(roomName, token);
      setIsLocked(Boolean(state.isLocked));
      setWaitingRoomEnabled(Boolean(state.waitingRoomEnabled));
    } catch (err) {
      console.warn('[Relay Access] Initial access-state notice:', err.message);
    }

    if (isHost) {
      try {
        const res = await getWaitingParticipants(roomName, token);
        if (res?.waitingParticipants && Array.isArray(res.waitingParticipants)) {
          setWaitingParticipants(res.waitingParticipants);
        }
      } catch (err) {
        console.warn('[Relay Access] Initial waiting-room fetch notice:', err.message);
      }
    }
  }, [token, roomName, isHost]);

  useEffect(() => {
    refreshAccessState();
  }, [refreshAccessState]);

  // Connect to Socket.IO to receive real-time access events
  useEffect(() => {
    if (!token || !roomName) return;

    const socket = io('/', {
      auth: { token, roomName },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
    });

    socketRef.current = socket;

    socket.on('access:meeting_locked_update', data => {
      console.log('[Relay Access] Real-time lock update:', data);
      setIsLocked(Boolean(data.isLocked));
    });

    socket.on('access:waiting_room_update', data => {
      console.log('[Relay Access] Real-time waiting room update:', data);
      if (Array.isArray(data?.waitingParticipants)) {
        setWaitingParticipants(data.waitingParticipants);
      }
    });

    socket.on('access:participant_removed', data => {
      console.log('[Relay Access] Real-time participant removal event:', data);
      if (data?.participantIdentity === localParticipantIdentity) {
        onParticipantRemovedSelf?.(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, roomName, localParticipantIdentity, onParticipantRemovedSelf]);

  // Action: Toggle Meeting Lock
  const toggleLock = useCallback(
    async newLockedState => {
      if (!isHost || !token || !roomName) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await lockMeeting(roomName, newLockedState, token);
        setIsLocked(Boolean(result.isLocked));
      } catch (err) {
        console.error('[Relay Access] Lock toggle error:', err);
        setError(err.message || 'Failed to toggle meeting lock');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isHost, token, roomName]
  );

  // Action: Admit waiting participant
  const admit = useCallback(
    async identity => {
      if (!isHost || !token || !roomName) return;
      setError(null);
      try {
        await admitWaitingParticipant(roomName, identity, token);
        setWaitingParticipants(prev => prev.filter(p => p.identity !== identity));
      } catch (err) {
        console.error('[Relay Access] Admit participant error:', err);
        setError(err.message || 'Failed to admit participant');
        throw err;
      }
    },
    [isHost, token, roomName]
  );

  // Action: Reject waiting participant
  const reject = useCallback(
    async identity => {
      if (!isHost || !token || !roomName) return;
      setError(null);
      try {
        await rejectWaitingParticipant(roomName, identity, token);
        setWaitingParticipants(prev => prev.filter(p => p.identity !== identity));
      } catch (err) {
        console.error('[Relay Access] Reject participant error:', err);
        setError(err.message || 'Failed to decline participant');
        throw err;
      }
    },
    [isHost, token, roomName]
  );

  // Action: Admit all waiting participants
  const admitAll = useCallback(async () => {
    if (!isHost || !token || !roomName || waitingParticipants.length === 0) return;
    const toAdmit = [...waitingParticipants];
    for (const p of toAdmit) {
      try {
        await admitWaitingParticipant(roomName, p.identity, token);
      } catch (err) {
        console.warn(`[Relay Access] Batch admit failed for ${p.identity}:`, err.message);
      }
    }
    setWaitingParticipants([]);
  }, [isHost, token, roomName, waitingParticipants]);

  // Action: Remove participant from room
  const removeParticipantAction = useCallback(
    async identity => {
      if (!isHost || !token || !roomName) return;
      setError(null);
      try {
        await removeParticipant(roomName, identity, token);
      } catch (err) {
        console.error('[Relay Access] Remove participant error:', err);
        setError(err.message || 'Failed to remove participant');
        throw err;
      }
    },
    [isHost, token, roomName]
  );

  return {
    isLocked,
    waitingRoomEnabled,
    waitingParticipants,
    isLoading,
    error,
    toggleLock,
    admit,
    reject,
    admitAll,
    removeParticipantAction,
    refreshAccessState,
  };
};
