import React, { useState, useEffect, useRef } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import {
  X,
  MessageSquare,
  Send,
  Lock,
  Users,
  AlertCircle,
  Loader2,
  ChevronDown,
  ArrowDown,
  MessageCircle,
} from 'lucide-react';
import { CHAT_MESSAGE_TYPES, CHAT_CONFIG } from '@relay/shared';

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const ChatPanel = ({
  isOpen,
  onClose,
  messages = [],
  sendMessage,
  isConnected = true,
  isConnecting = false,
  connectionError = null,
  preselectedRecipient = null,
  onClearPreselectedRecipient,
  hasMore = false,
  isLoadingOlder = false,
  loadOlderMessages,
  unreadByPeer = {},
  markConversationRead,
}) => {
  const { localParticipant } = useLocalParticipant();
  const allParticipants = useParticipants();

  // Active view tab: 'everyone' | 'direct'
  const [activeTab, setActiveTab] = useState('everyone');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [showConversationList, setShowConversationList] = useState(false);

  // Scroll tracking state to avoid forcing users away when reading older messages
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [hasNewMessagesScrolledUp, setHasNewMessagesScrolledUp] = useState(false);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);

  const localIdentity = localParticipant?.identity || '';
  const remoteParticipants = allParticipants.filter(
    p => !p.isLocal && p.identity !== localIdentity
  );

  // If a preselected recipient was passed (e.g. from participants panel quick message action)
  useEffect(() => {
    if (preselectedRecipient?.identity) {
      setSelectedRecipientId(preselectedRecipient.identity);
      setActiveTab('direct');
      onClearPreselectedRecipient?.();
    }
  }, [preselectedRecipient, onClearPreselectedRecipient]);

  // Set default direct recipient if none selected and remote participants exist
  useEffect(() => {
    if (!selectedRecipientId && remoteParticipants.length > 0) {
      setSelectedRecipientId(remoteParticipants[0].identity);
    }
  }, [selectedRecipientId, remoteParticipants]);

  // Mark read when switching tabs or recipient
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'everyone') {
        markConversationRead?.({ targetType: CHAT_MESSAGE_TYPES.EVERYONE });
      } else if (activeTab === 'direct' && selectedRecipientId) {
        markConversationRead?.({
          targetType: CHAT_MESSAGE_TYPES.DIRECT,
          peerIdentity: selectedRecipientId,
        });
      }
    }
  }, [isOpen, activeTab, selectedRecipientId, markConversationRead]);

  // Handle user scrolling
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distanceFromBottom > 70;
    setIsScrolledUp(scrolledUp);
    if (!scrolledUp) {
      setHasNewMessagesScrolledUp(false);
    }
  };

  // Auto-scroll on new messages unless user intentionally scrolled up
  useEffect(() => {
    if (!isOpen) return;

    const newCount = messages.length;
    const isNew = newCount > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = newCount;

    if (isNew && isScrolledUp) {
      setHasNewMessagesScrolledUp(true);
    } else {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      setHasNewMessagesScrolledUp(false);
    }
  }, [messages, isOpen, activeTab, selectedRecipientId, isScrolledUp]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    setIsScrolledUp(false);
    setHasNewMessagesScrolledUp(false);
  };

  if (!isOpen) return null;

  const currentRecipient = remoteParticipants.find(p => p.identity === selectedRecipientId);
  const recipientName = currentRecipient?.name || currentRecipient?.identity || 'Participant';
  const recipientLeft = selectedRecipientId && !currentRecipient;

  // Filter messages based on active tab
  const displayedMessages = messages.filter(msg => {
    if (activeTab === 'everyone') {
      return msg.targetType === CHAT_MESSAGE_TYPES.EVERYONE;
    }
    if (activeTab === 'direct') {
      if (!selectedRecipientId) return msg.targetType === CHAT_MESSAGE_TYPES.DIRECT;
      return (
        msg.targetType === CHAT_MESSAGE_TYPES.DIRECT &&
        (msg.senderIdentity === selectedRecipientId ||
          msg.recipientIdentity === selectedRecipientId)
      );
    }
    return true;
  });

  // Calculate message counts and conversation list data
  const directMessagesCount = messages.filter(
    m => m.targetType === CHAT_MESSAGE_TYPES.DIRECT
  ).length;
  const everyoneMessagesCount = messages.filter(
    m => m.targetType === CHAT_MESSAGE_TYPES.EVERYONE
  ).length;

  // Build conversation list for remote participants with latest message preview & unread counts
  const conversationsList = remoteParticipants.map(participant => {
    const peerDirectMessages = messages.filter(
      m =>
        m.targetType === CHAT_MESSAGE_TYPES.DIRECT &&
        (m.senderIdentity === participant.identity || m.recipientIdentity === participant.identity)
    );
    const lastMsg = peerDirectMessages[peerDirectMessages.length - 1];
    const peerUnread = unreadByPeer[participant.identity] || 0;

    return {
      participant,
      lastMessage: lastMsg?.content || 'No messages yet',
      lastMessageTime: lastMsg?.timestamp,
      unreadCount: peerUnread,
    };
  });

  const handleSend = async e => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || isSending) return;

    const maxLen = CHAT_CONFIG.MAX_CONTENT_LENGTH || 2000;
    if (content.length > maxLen) {
      setSendError(`Message exceeds maximum length of ${maxLen} characters.`);
      return;
    }

    if (activeTab === 'direct' && !selectedRecipientId) {
      setSendError('Please select a participant to send a direct message.');
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const payload = {
        content,
        targetType:
          activeTab === 'direct' ? CHAT_MESSAGE_TYPES.DIRECT : CHAT_MESSAGE_TYPES.EVERYONE,
        recipientIdentity: activeTab === 'direct' ? selectedRecipientId : null,
        recipientName: activeTab === 'direct' ? recipientName : null,
      };

      const result = await sendMessage(payload);
      if (result.success) {
        setInputText('');
        scrollToBottom();
      } else {
        setSendError(result.error || 'Failed to send message.');
      }
    } catch (err) {
      setSendError(err.message || 'Error delivering message.');
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const maxLength = CHAT_CONFIG.MAX_CONTENT_LENGTH || 2000;
  const charCount = inputText.length;
  const isNearLimit = charCount > maxLength * 0.9;
  const isOverLimit = charCount > maxLength;

  return (
    <aside
      aria-label="Meeting chat panel"
      className="w-full sm:w-80 md:w-96 bg-relay-900 border-l border-relay-800 flex flex-col h-full shrink-0 select-none z-20 animate-in slide-in-from-right duration-200"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-relay-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center text-brand-light">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">In-Meeting Chat</h2>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              ) : isConnecting ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Connecting
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Offline
                </span>
              )}
            </div>
            <p className="text-[10px] text-relay-400">Everyone and Private direct messages</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-relay-400 hover:text-white hover:bg-relay-800 transition-colors"
          aria-label="Close chat panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Connection Warning Banner */}
      {connectionError && (
        <div className="p-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-[11px] flex-1">{connectionError}</span>
        </div>
      )}

      {/* Navigation Tabs (Everyone vs Direct Messages) */}
      <div className="flex items-center border-b border-relay-800 px-3 pt-2 gap-1 bg-relay-950/40 text-xs shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('everyone');
            setShowConversationList(false);
            setSendError(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'everyone'
              ? 'border-brand text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Everyone</span>
          {everyoneMessagesCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-relay-800 text-relay-300 font-mono">
              {everyoneMessagesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('direct');
            setSendError(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'direct'
              ? 'border-brand text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Direct Messages</span>
          {directMessagesCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              {directMessagesCount}
            </span>
          )}
        </button>
      </div>

      {/* Recipient Selector / Conversation Switcher (in Direct Messages mode) */}
      {activeTab === 'direct' && (
        <div className="p-2.5 bg-relay-950/60 border-b border-relay-800 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-medium text-relay-400 mb-1">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              Private chat with:
            </span>
            {remoteParticipants.length > 1 && (
              <button
                type="button"
                onClick={() => setShowConversationList(prev => !prev)}
                className="text-[10px] text-brand-light hover:underline flex items-center gap-0.5"
              >
                <MessageCircle className="w-3 h-3" />
                {showConversationList ? 'Hide List' : 'All Conversations'}
              </button>
            )}
            {remoteParticipants.length === 0 && (
              <span className="text-[10px] text-relay-500">No other participants</span>
            )}
          </div>

          {remoteParticipants.length > 0 ? (
            <div className="relative">
              <select
                id="direct-recipient-select"
                aria-label="Direct message recipient"
                value={selectedRecipientId}
                onChange={e => {
                  setSelectedRecipientId(e.target.value);
                  setSendError(null);
                  setShowConversationList(false);
                }}
                className="w-full bg-relay-850 border border-relay-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand appearance-none pr-8 cursor-pointer"
              >
                {remoteParticipants.map(p => {
                  const isHost = p.attributes?.role === 'host';
                  const unread = unreadByPeer[p.identity] || 0;
                  return (
                    <option key={p.identity} value={p.identity}>
                      {p.name || p.identity} {isHost ? '(Host)' : ''} {unread > 0 ? `(${unread} new)` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-relay-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="p-2 rounded bg-relay-900 border border-relay-800 text-[11px] text-relay-400 italic">
              You are the only participant in this meeting. Invite others to start private chats.
            </div>
          )}

          {/* Conversation List Drawer for Zoom-like overview */}
          {showConversationList && remoteParticipants.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto bg-relay-900 p-1.5 rounded-lg border border-relay-800">
              {conversationsList.map(c => {
                const isSelected = c.participant.identity === selectedRecipientId;
                return (
                  <button
                    key={c.participant.identity}
                    type="button"
                    onClick={() => {
                      setSelectedRecipientId(c.participant.identity);
                      setShowConversationList(false);
                    }}
                    className={`w-full text-left p-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                      isSelected ? 'bg-brand/20 text-white' : 'hover:bg-relay-800 text-relay-300'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="font-medium text-[11px] text-white flex items-center gap-1">
                        <span>{c.participant.name || c.participant.identity}</span>
                        {c.participant.attributes?.role === 'host' && (
                          <span className="text-[9px] text-brand-light font-mono">(Host)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-relay-400 truncate">{c.lastMessage}</div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-relay-950 shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {recipientLeft && (
            <div className="mt-2 p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>The selected participant has left the meeting.</span>
            </div>
          )}
        </div>
      )}

      {/* Message Feed Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 relative"
      >
        {/* Load Older Messages pagination trigger */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={isLoadingOlder}
              className="px-3 py-1 text-[11px] font-medium text-relay-300 bg-relay-800/80 hover:bg-relay-700/80 rounded-full border border-relay-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isLoadingOlder ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-brand" />
                  <span>Loading older messages...</span>
                </>
              ) : (
                <span>Load older messages</span>
              )}
            </button>
          </div>
        )}

        {isConnecting && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-relay-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand mb-2" />
            <p className="text-xs">Connecting to meeting chat...</p>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-relay-400">
            {activeTab === 'everyone' ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-relay-800/80 border border-relay-700/60 flex items-center justify-center text-relay-400 mb-3">
                  <Users className="w-6 h-6 text-brand-light" />
                </div>
                <h3 className="text-xs font-semibold text-white mb-1">Everyone Chat</h3>
                <p className="text-[11px] text-relay-400 max-w-[200px]">
                  No messages yet. Messages sent here will be visible to all current participants.
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-semibold text-white mb-1">Private Direct Messages</h3>
                <p className="text-[11px] text-relay-400 max-w-[200px]">
                  {remoteParticipants.length > 0
                    ? `No private messages with ${recipientName} yet. Direct messages are visible only to you and ${recipientName}.`
                    : 'Invite others to the meeting to exchange private direct messages.'}
                </p>
              </>
            )}
          </div>
        ) : (
          displayedMessages.map(msg => {
            const isLocal = msg.senderIdentity === localIdentity;
            const isDirect = msg.targetType === CHAT_MESSAGE_TYPES.DIRECT;

            return (
              <div
                key={msg.id}
                className={`flex flex-col group ${isLocal ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Info Header */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                  <span
                    className={`font-medium ${isLocal ? 'text-brand-light' : 'text-relay-200'}`}
                  >
                    {isLocal ? 'You' : msg.senderName}
                  </span>

                  {/* Direct Message Tag */}
                  {isDirect && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-300/90 font-medium bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded">
                      <Lock className="w-2.5 h-2.5" />
                      {isLocal ? `to ${msg.recipientName || 'Participant'}` : '(Private)'}
                    </span>
                  )}

                  <span className="text-[10px] text-relay-500 font-mono">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message Bubble (safely rendered string, no raw HTML) */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm transition-colors ${
                    isDirect
                      ? isLocal
                        ? 'bg-amber-950/40 border border-amber-500/30 text-amber-100'
                        : 'bg-amber-950/30 border border-amber-500/25 text-amber-100'
                      : isLocal
                        ? 'bg-brand text-white'
                        : 'bg-relay-800 border border-relay-700/80 text-relay-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap select-text">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />

        {/* Floating "Jump to latest" pill when scrolled up */}
        {hasNewMessagesScrolledUp && (
          <div className="sticky bottom-2 flex justify-center z-10 pointer-events-none">
            <button
              type="button"
              onClick={scrollToBottom}
              className="pointer-events-auto px-3 py-1 bg-brand text-white rounded-full text-xs font-medium shadow-lg shadow-brand/20 flex items-center gap-1 hover:bg-brand-hover transition-all animate-bounce"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>New messages below</span>
            </button>
          </div>
        )}
      </div>

      {/* Input / Composition Area */}
      <footer className="p-3 bg-relay-950/90 border-t border-relay-800 shrink-0">
        {sendError && (
          <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px]">{sendError}</span>
            </div>
            <button
              onClick={() => setSendError(null)}
              className="text-red-400 hover:text-red-200 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Zoom-like recipient indicator */}
        <div className="flex items-center justify-between text-[11px] mb-1.5 text-relay-400">
          <span className="flex items-center gap-1">
            <span>To:</span>
            {activeTab === 'everyone' ? (
              <span className="text-white font-medium flex items-center gap-1">
                <Users className="w-3 h-3 text-brand-light" />
                Everyone
              </span>
            ) : (
              <span className="text-amber-300 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                {recipientName} (Direct Message)
              </span>
            )}
          </span>

          <span
            className={`text-[10px] font-mono ${
              isOverLimit
                ? 'text-red-400 font-bold'
                : isNearLimit
                  ? 'text-amber-400'
                  : 'text-relay-500'
            }`}
          >
            {charCount}/{maxLength}
          </span>
        </div>

        <form onSubmit={handleSend} className="relative">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              if (sendError) setSendError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTab === 'everyone'
                ? 'Type a message to everyone... (Enter to send)'
                : `Direct message to ${recipientName}... (Enter to send)`
            }
            disabled={activeTab === 'direct' && remoteParticipants.length === 0}
            className="w-full bg-relay-850 border border-relay-700 rounded-xl px-3 py-2 text-xs text-white placeholder-relay-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand resize-none transition-all disabled:opacity-50"
          />

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-relay-500 hidden sm:inline">
              Press{' '}
              <kbd className="bg-relay-800 px-1 py-0.5 rounded text-[9px] border border-relay-700">
                Enter
              </kbd>{' '}
              to send,{' '}
              <kbd className="bg-relay-800 px-1 py-0.5 rounded text-[9px] border border-relay-700">
                Shift+Enter
              </kbd>{' '}
              for new line
            </span>

            <button
              type="submit"
              disabled={
                !inputText.trim() ||
                isSending ||
                isOverLimit ||
                (activeTab === 'direct' && remoteParticipants.length === 0)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-medium shadow-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </footer>
    </aside>
  );
};
