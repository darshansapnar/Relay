import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { CHAT_EVENTS, CHAT_MESSAGE_TYPES } from '@relay/shared';
import { fetchMeetingMessages, sendMeetingMessageRest } from '../api/chatApi.js';

/**
 * Custom React hook for real-time meeting chat via Socket.IO with PostgreSQL-backed history.
 *
 * @param {object} params
 * @param {string} params.token - Caller's verified LiveKit JWT access token
 * @param {string} params.roomName - Current meeting room name
 * @param {boolean} [params.isPanelOpen=false] - Whether the chat sidebar is currently visible
 * @param {string} [params.localParticipantIdentity=''] - Current user's identity
 */
export const useChat = ({
  token,
  roomName,
  isPanelOpen = false,
  localParticipantIdentity = '',
}) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  // Unread state tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadPrivateCount, setUnreadPrivateCount] = useState(0);
  const [unreadByPeer, setUnreadByPeer] = useState({});

  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const socketRef = useRef(null);
  const isPanelOpenRef = useRef(isPanelOpen);
  isPanelOpenRef.current = isPanelOpen;

  // Helper to merge new messages without duplicates while preserving chronological sort
  const mergeMessages = useCallback(incomingList => {
    if (!Array.isArray(incomingList) || incomingList.length === 0) return;

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const existingClientIds = new Set(prev.map(m => m.clientMessageId).filter(Boolean));

      const novel = incomingList.filter(
        m =>
          !existingIds.has(m.id) &&
          (!m.clientMessageId || !existingClientIds.has(m.clientMessageId))
      );

      if (novel.length === 0) return prev;

      const combined = [...prev, ...novel];
      combined.sort((a, b) => a.timestamp - b.timestamp);
      return combined;
    });
  }, []);

  // Fetch initial history from REST or Socket
  const loadHistory = useCallback(async () => {
    if (!token || !roomName) return;
    try {
      const result = await fetchMeetingMessages(roomName, token, { limit: 50 });
      if (result?.messages) {
        mergeMessages(result.messages);
        setHasMore(Boolean(result.hasMore));
      }
      if (result?.unread) {
        setUnreadCount((result.unread.everyone || 0) + (result.unread.directTotal || 0));
        setUnreadPrivateCount(result.unread.directTotal || 0);
        setUnreadByPeer(result.unread.directByPeer || {});
      }
    } catch (err) {
      console.warn('[Relay Chat] Initial history fetch notice:', err.message);
    }
  }, [token, roomName, mergeMessages]);

  // Load older paginated messages
  const loadOlderMessages = useCallback(async () => {
    if (!token || !roomName || isLoadingOlder || !hasMore || messages.length === 0) return;

    setIsLoadingOlder(true);
    try {
      const oldestMessage = messages[0];
      const beforeCursor = oldestMessage.createdAt || oldestMessage.timestamp;

      const result = await fetchMeetingMessages(roomName, token, {
        limit: 50,
        before: beforeCursor,
      });

      if (result?.messages && result.messages.length > 0) {
        mergeMessages(result.messages);
        setHasMore(Boolean(result.hasMore));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('[Relay Chat] Error loading older messages:', err.message);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [token, roomName, isLoadingOlder, hasMore, messages, mergeMessages]);

  // Mark a conversation as read
  const markConversationRead = useCallback(
    ({ targetType = CHAT_MESSAGE_TYPES.EVERYONE, peerIdentity = '' }) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(CHAT_EVENTS.MARK_READ, { targetType, peerIdentity });
      }

      if (targetType === CHAT_MESSAGE_TYPES.EVERYONE) {
        setUnreadCount(prev => Math.max(0, prev - (prev - unreadPrivateCount)));
      } else if (targetType === CHAT_MESSAGE_TYPES.DIRECT && peerIdentity) {
        const peerCount = unreadByPeer[peerIdentity] || 0;
        setUnreadPrivateCount(prev => Math.max(0, prev - peerCount));
        setUnreadCount(prev => Math.max(0, prev - peerCount));
        setUnreadByPeer(prev => {
          const next = { ...prev };
          delete next[peerIdentity];
          return next;
        });
      }
    },
    [unreadPrivateCount, unreadByPeer]
  );

  // Clear unread counts when panel is opened
  useEffect(() => {
    if (isPanelOpen) {
      markConversationRead({ targetType: CHAT_MESSAGE_TYPES.EVERYONE });
    }
  }, [isPanelOpen, markConversationRead]);

  useEffect(() => {
    if (!token || !roomName) {
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    // Initial message load over REST
    loadHistory();

    // Connect Socket.IO
    const socket = io('/', {
      auth: { token, roomName },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);

      // Re-sync history on connection/reconnection
      socket.emit(CHAT_EVENTS.GET_HISTORY, { limit: 50 }, res => {
        if (res?.success && Array.isArray(res.messages)) {
          mergeMessages(res.messages);
          setHasMore(Boolean(res.hasMore));
        }
        if (res?.unread) {
          setUnreadCount((res.unread.everyone || 0) + (res.unread.directTotal || 0));
          setUnreadPrivateCount(res.unread.directTotal || 0);
          setUnreadByPeer(res.unread.directByPeer || {});
        }
      });
    });

    socket.on('connect_error', err => {
      console.warn('[Relay Chat Socket] Connection notice:', err.message);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(err.message || 'Connection lost. Reconnecting...');
    });

    socket.on('disconnect', reason => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        setConnectionError('Session disconnected by server.');
      }
    });

    // Handle incoming chat messages
    socket.on(CHAT_EVENTS.NEW_MESSAGE, incomingMessage => {
      if (!incomingMessage || !incomingMessage.id) return;

      mergeMessages([incomingMessage]);

      // If panel is closed and message is from another participant, increment unread counters
      if (!isPanelOpenRef.current && incomingMessage.senderIdentity !== localParticipantIdentity) {
        setUnreadCount(prev => prev + 1);
        if (incomingMessage.targetType === CHAT_MESSAGE_TYPES.DIRECT) {
          setUnreadPrivateCount(prev => prev + 1);
          setUnreadByPeer(prev => ({
            ...prev,
            [incomingMessage.senderIdentity]: (prev[incomingMessage.senderIdentity] || 0) + 1,
          }));
        }
      }
    });

    // Handle unread updates
    socket.on(CHAT_EVENTS.UNREAD_UPDATE, unreadData => {
      if (unreadData) {
        setUnreadCount((unreadData.everyone || 0) + (unreadData.directTotal || 0));
        setUnreadPrivateCount(unreadData.directTotal || 0);
        setUnreadByPeer(unreadData.directByPeer || {});
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, roomName, localParticipantIdentity, loadHistory, mergeMessages]);

  /**
   * Sends a message via Socket.IO with fallback to REST API.
   *
   * @param {object} params
   * @param {string} params.content
   * @param {string} [params.targetType='everyone'] - 'everyone' | 'direct'
   * @param {string|null} [params.recipientIdentity=null]
   * @param {string|null} [params.recipientName=null]
   * @returns {Promise<{ success: boolean, message?: object, error?: string }>}
   */
  const sendMessage = useCallback(
    async ({
      content,
      targetType = CHAT_MESSAGE_TYPES.EVERYONE,
      recipientIdentity = null,
      recipientName = null,
    }) => {
      if (!content || !content.trim()) {
        return { success: false, error: 'Message cannot be empty.' };
      }

      const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        content: content.trim(),
        targetType,
        recipientIdentity,
        recipientName,
        clientMessageId,
      };

      // 1. Try sending via Socket.IO if connected
      const socket = socketRef.current;
      if (socket && socket.connected) {
        return new Promise(resolve => {
          socket.emit(CHAT_EVENTS.SEND_MESSAGE, payload, ack => {
            if (ack && ack.success) {
              if (ack.message) {
                mergeMessages([ack.message]);
              }
              resolve({ success: true, message: ack.message });
            } else {
              resolve({
                success: false,
                error: ack?.error || 'Failed to send message.',
                code: ack?.code,
              });
            }
          });
        });
      }

      // 2. Fallback to HTTP REST endpoint if socket is momentarily disconnected
      try {
        const result = await sendMeetingMessageRest(roomName, token, payload);
        if (result?.success && result.message) {
          mergeMessages([result.message]);
          return { success: true, message: result.message };
        }
        return { success: false, error: 'Failed to deliver message via server fallback.' };
      } catch (err) {
        return {
          success: false,
          error: err.message || 'Network error while delivering message.',
          code: err.code,
        };
      }
    },
    [roomName, token, mergeMessages]
  );

  return {
    messages,
    isConnected,
    isConnecting,
    connectionError,
    unreadCount,
    unreadPrivateCount,
    unreadByPeer,
    hasMore,
    isLoadingOlder,
    loadOlderMessages,
    sendMessage,
    markConversationRead,
    reloadHistory: loadHistory,
    clearUnread: () => {
      setUnreadCount(0);
      setUnreadPrivateCount(0);
      setUnreadByPeer({});
    },
  };
};
