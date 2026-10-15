import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  useDataChannel,
} from '@livekit/components-react';
import { Room, RoomEvent } from 'livekit-client';
import { MeetingHeader } from './MeetingHeader.jsx';
import { LiveParticipantGrid } from './LiveParticipantGrid.jsx';
import { LiveMeetingControls } from './LiveMeetingControls.jsx';
import { LiveParticipantsPanel } from './LiveParticipantsPanel.jsx';
import { AssistantPanel } from './AssistantPanel.jsx';
import { useAIAssistant } from '../../hooks/useAIAssistant.js';
import { ChatPanel } from './ChatPanel.jsx';
import { useChat } from '../../hooks/useChat.js';
import { LeaveMeetingDialog } from './LeaveMeetingDialog.jsx';
import { MediaDeviceWarningBanner } from './MediaDeviceWarningBanner.jsx';
import { HostRequestPrompt } from './HostRequestPrompt.jsx';
import { RecordingStatusBanner, RecordingErrorBanner } from './RecordingStatusBanner.jsx';
import { RecordingConsentDialog } from './RecordingConsentDialog.jsx';
import { Radio, UserX } from 'lucide-react';
import { useAccessControl } from '../../hooks/useAccessControl.js';
import { describeMediaDeviceFailure, isMediaDeviceError } from '../../utils/mediaErrors.js';
import {
  HOST_CONTROL_TOPIC,
  REQUEST_ACTIONS,
  RESPONSE_STATUSES,
  LOCAL_REQUEST_STATUSES,
  REQUEST_RESPONSE_TIMEOUT_MS,
  encodeHostMessage,
  decodeHostMessage,
  buildRequestMessage,
  buildResponseMessage,
  isRequestMessage,
  isResponseMessage,
} from '../../utils/hostRequests.js';
import {
  LOCAL_RECORDING_TOPIC,
  LOCAL_RECORDING_STATUS,
  encodeRecordingMessage,
  decodeRecordingMessage,
  buildConsentDeclineMessage,
  isConsentDeclineMessage,
} from '../../utils/recordingProtocol.js';
import {
  isLocalRecordingSupported,
  LocalAudioMixRecorder,
  downloadRecordingBlob,
  buildRecordingFilename,
} from '../../utils/localAudioRecorder.js';

// Inner component with access to LiveKit room context
function MeetingRoomInner({
  token,
  roomName,
  onLeaveRoom,
  mediaWarnings,
  onDismissWarning,
  onRetryDevice,
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  // Host status is assigned once, server-side, at token mint time (see
  // apps/api/src/controllers/meeting.controller.js) and broadcast to every
  // participant via LiveKit's participant attributes -- it is never derived
  // from array position or display name.
  const isHost = localParticipant?.attributes?.role === 'host';

  const [activePanel, setActivePanel] = useState(null); // 'participants' | 'assistant' | 'chat' | null
  const [preselectedChatRecipient, setPreselectedChatRecipient] = useState(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // In-meeting real-time chat with Socket.IO and LiveKit token authentication
  const {
    messages: chatMessages,
    isConnected: isChatConnected,
    isConnecting: isChatConnecting,
    connectionError: chatConnectionError,
    unreadCount: chatUnreadCount,
    unreadPrivateCount: chatUnreadPrivateCount,
    unreadByPeer: chatUnreadByPeer,
    hasMore: chatHasMore,
    isLoadingOlder: chatIsLoadingOlder,
    loadOlderMessages: chatLoadOlderMessages,
    markConversationRead: chatMarkConversationRead,
    sendMessage: sendChatMessage,
  } = useChat({
    token,
    roomName: room?.name || roomName,
    isPanelOpen: activePanel === 'chat',
    localParticipantIdentity: localParticipant?.identity,
  });

  const ai = useAIAssistant({
    token,
    roomName: room?.name || roomName,
    isHost,
    localParticipant,
    participants,
    room,
  });

  const [removedNotice, setRemovedNotice] = useState(null);

  const handleRemovedSelf = useCallback(data => {
    console.warn('[Relay Access] Local participant was removed by host:', data);
    setRemovedNotice(data?.message || 'You have been removed from the meeting by the host.');
    room?.disconnect();
  }, [room]);

  const access = useAccessControl({
    token,
    roomName: room?.name || roomName,
    isHost,
    localParticipantIdentity: localParticipant?.identity,
    onParticipantRemovedSelf: handleRemovedSelf,
  });


  // A request currently awaiting THIS participant's response (host asked
  // them to unmute / turn camera on), and per-identity+action status for the
  // host's own side of the conversation ('sent' | 'accepted' | 'declined' |
  // 'failed'), so the panel can show real feedback instead of firing and
  // forgetting.
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [acceptingRequest, setAcceptingRequest] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [requestStatusByKey, setRequestStatusByKey] = useState({});
  // Pending "did they ever respond" timers, keyed the same as
  // requestStatusByKey, so a late-arriving response (or unmount) can cancel
  // the "no response" fallback instead of leaving a stray timer running.
  const pendingResponseTimersRef = useRef({});

  useEffect(() => {
    const timers = pendingResponseTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Local meeting recording: audio is mixed in this browser with the Web
  // Audio API and encoded by MediaRecorder (see utils/localAudioRecorder.js)
  // -- there is no backend involved, no upload, and no LiveKit Egress. The
  // mixer instance itself lives in a ref, not state, since it's an
  // imperative resource (audio graph + MediaRecorder), not something React
  // should re-render around; `recording` below is the small bit of state
  // that IS meant to drive the UI.
  const recorderRef = useRef(null);
  const [recording, setRecording] = useState({ status: LOCAL_RECORDING_STATUS.IDLE });
  const [recordingError, setRecordingError] = useState(null);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const [startingRecording, setStartingRecording] = useState(false);
  const [stoppingRecording, setStoppingRecording] = useState(false);
  const [decliningConsent, setDecliningConsent] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recordingSupported = useMemo(() => isLocalRecordingSupported(), []);

  // The room's one authoritative host, the same way every other host-gated
  // feature in this app determines it (attributes.role is assigned once,
  // server-side, at token mint time -- see meeting.controller.js -- and
  // broadcast to everyone by LiveKit; it cannot be forged by a participant's
  // own client).
  const hostParticipant = participants.find(p => p.attributes?.role === 'host');
  const hostLocalRecordingFlag = hostParticipant?.attributes?.localRecording;
  const hostLocalRecordingStartedAt = hostParticipant?.attributes?.localRecordingStartedAt;
  const hostLocalRecordingHostName = hostParticipant?.attributes?.localRecordingHostName;

  // For every participant EXCEPT the host, "is the room being recorded"
  // comes from the host's own LiveKit participant attributes, not a one-
  // shot broadcast -- attributes are synced by LiveKit on every change AND
  // as part of a participant's initial room-state sync on connect, which is
  // what lets someone who joins mid-recording see the banner immediately
  // (see recordingProtocol.js's doc comment for why a data-channel message
  // alone can't do that). The host drives its own `recording` state
  // directly and optimistically in the handlers below instead of looping
  // back through its own attribute change.
  useEffect(() => {
    if (isHost) return;
    if (hostLocalRecordingFlag === 'true') {
      setRecording({
        status: LOCAL_RECORDING_STATUS.RECORDING,
        startedAt: Number(hostLocalRecordingStartedAt) || Date.now(),
        requestedByName: hostLocalRecordingHostName,
      });
    } else {
      setRecording(prev =>
        prev.status === LOCAL_RECORDING_STATUS.RECORDING
          ? { status: LOCAL_RECORDING_STATUS.STOPPED }
          : prev
      );
    }
  }, [isHost, hostLocalRecordingFlag, hostLocalRecordingStartedAt, hostLocalRecordingHostName]);

  // Recomputes the full set of audio tracks that should currently be in the
  // mix (this browser's own mic + every subscribed remote audio track) and
  // reconciles the recorder's audio graph against it. A full reconcile
  // rather than an incremental add/remove -- see LocalAudioMixRecorder's
  // own doc comment for why that's what actually stays correct across
  // mute/unmute, republish-after-reconnect, and ordinary join/leave.
  const resyncRecordingTracks = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isActive || !room) return;
    const activeTracks = [];
    const allParticipants = [room.localParticipant, ...room.remoteParticipants.values()];
    for (const participant of allParticipants) {
      for (const publication of participant.audioTrackPublications.values()) {
        if (publication.track?.mediaStreamTrack) {
          activeTracks.push({
            key: `${participant.identity}:${publication.trackSid}`,
            mediaStreamTrack: publication.track.mediaStreamTrack,
          });
        }
      }
    }
    recorder.syncTracks(activeTracks);
  }, [room]);

  // Explicit RoomEvent listeners rather than relying on useParticipants()'s
  // own re-renders: that hook's default event list does not include
  // RoomEvent.TrackSubscribed/TrackUnsubscribed, which is exactly the
  // moment a remote participant's audio becomes available or unavailable --
  // the one thing this feature cannot afford to miss. Registered for the
  // component's whole lifetime (cheap no-ops via the isActive check above
  // when nothing is recording) rather than only while recording, so there's
  // one lifecycle to reason about instead of two.
  useEffect(() => {
    if (!room) return undefined;
    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.Reconnected,
    ];
    events.forEach(event => room.on(event, resyncRecordingTracks));
    return () => {
      events.forEach(event => room.off(event, resyncRecordingTracks));
    };
  }, [room, resyncRecordingTracks]);

  const handleStopRecording = useCallback(
    async ({ silent = false } = {}) => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      setStoppingRecording(true);
      try {
        const blob = await recorder.stop();
        if (blob && blob.size > 0) {
          downloadRecordingBlob(blob, buildRecordingFilename(roomName));
        }
      } catch (err) {
        console.warn('Failed to finalize local recording:', err);
        setRecordingError(err.message || 'Could not finalize the recording.');
      } finally {
        recorder.cleanup();
        recorderRef.current = null;
        setStoppingRecording(false);
        setRecording({ status: LOCAL_RECORDING_STATUS.STOPPED });
        if (!silent && room) {
          // Clearing this is what every other participant's sync effect
          // above reacts to -- there is no separate "stopped" broadcast to
          // send.
          room.localParticipant.setAttributes({ localRecording: 'false' }).catch(() => {});
        }
      }
    },
    [roomName, room]
  );

  const handleRecordingMessage = useCallback(
    msg => {
      const message = decodeRecordingMessage(msg.payload);
      if (!message) return;

      if (isConsentDeclineMessage(message) && isHost) {
        // Any participant can withdraw consent at any time; the host's
        // client reacts by stopping immediately, regardless of who clicked
        // Start. The sender's identity is attached by the LiveKit SFU
        // itself (msg.from), not supplied by the client, so this can't be
        // spoofed.
        handleStopRecording();
      }
    },
    [isHost, handleStopRecording]
  );

  // This client only needs to listen on this topic -- outgoing messages are
  // sent directly via room.localParticipant.publishData() below, not via
  // this hook's `send` (kept out of other callbacks' dependency chains,
  // since handleStopRecording above needs to exist before
  // handleRecordingMessage can reference it).
  useDataChannel(LOCAL_RECORDING_TOPIC, handleRecordingMessage);

  // Stop (and best-effort download/notify) if the room disconnects while
  // recording is active -- e.g. the host leaves, loses connection, or ends
  // the meeting for everyone -- instead of silently discarding whatever was
  // captured.
  useEffect(() => {
    if (!room) return undefined;
    const handleRoomDisconnected = () => {
      if (recorderRef.current) {
        handleStopRecording({ silent: true });
      }
    };
    room.on(RoomEvent.Disconnected, handleRoomDisconnected);
    return () => room.off(RoomEvent.Disconnected, handleRoomDisconnected);
  }, [room, handleStopRecording]);

  // Warn before an accidental tab close/refresh loses an in-progress,
  // not-yet-downloaded recording.
  useEffect(() => {
    const handleBeforeUnload = e => {
      if (recorderRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Final safety net: if this component unmounts (navigating away, the
  // LiveKitRoom tears down, ...) while a recorder is still running, tear
  // down its audio nodes/MediaStream/AudioContext rather than leaking them.
  useEffect(() => {
    return () => {
      recorderRef.current?.cleanup();
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (recording.status !== LOCAL_RECORDING_STATUS.RECORDING || !recording.startedAt) {
      setElapsedMs(0);
      return undefined;
    }
    setElapsedMs(Date.now() - recording.startedAt);
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - recording.startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [recording.status, recording.startedAt]);

  const handleOpenRecordingConsent = useCallback(() => {
    setRecordingError(null);
    setShowRecordingConsent(true);
  }, []);

  const handleConfirmStartRecording = useCallback(async () => {
    setStartingRecording(true);
    setRecordingError(null);
    try {
      if (!recordingSupported) {
        throw new Error(
          'This browser does not support local audio recording (requires MediaRecorder with WebM/Opus support).'
        );
      }
      const recorder = new LocalAudioMixRecorder();
      recorder.start();
      recorderRef.current = recorder;

      const startedAt = Date.now();
      const requestedByName = localParticipant?.name || localParticipant?.identity || 'The host';
      setRecording({ status: LOCAL_RECORDING_STATUS.RECORDING, startedAt, requestedByName });
      setShowRecordingConsent(false);

      // Sync immediately so currently-published tracks are captured from
      // the first instant, not only once the next room event happens to fire.
      resyncRecordingTracks();

      // This is what every other participant's sync effect above reacts to
      // -- including someone who joins after this point, since LiveKit
      // delivers current attributes as part of their initial room sync.
      await room.localParticipant.setAttributes({
        localRecording: 'true',
        localRecordingStartedAt: String(startedAt),
        localRecordingHostName: requestedByName,
      });
    } catch (err) {
      recorderRef.current?.cleanup();
      recorderRef.current = null;
      setRecording({ status: LOCAL_RECORDING_STATUS.IDLE });
      setRecordingError(err.message || 'Could not start local recording.');
    } finally {
      setStartingRecording(false);
    }
  }, [recordingSupported, localParticipant, resyncRecordingTracks, room]);

  const handleDeclineConsent = useCallback(async () => {
    if (!room) return;
    setDecliningConsent(true);
    try {
      await room.localParticipant.publishData(
        encodeRecordingMessage(buildConsentDeclineMessage()),
        {
          reliable: true,
          topic: LOCAL_RECORDING_TOPIC,
        }
      );
    } catch (err) {
      console.warn('Failed to send consent withdrawal:', err);
    } finally {
      setDecliningConsent(false);
    }
  }, [room]);

  const handleDismissRecordingBanner = useCallback(() => {
    setRecording({ status: LOCAL_RECORDING_STATUS.IDLE });
  }, []);

  const handleDataMessage = useCallback(msg => {
    const message = decodeHostMessage(msg.payload);
    if (!message) return;

    if (isRequestMessage(message)) {
      setAcceptError(null);
      setIncomingRequest({
        requestId: message.requestId,
        action: message.action,
        fromIdentity: msg.from?.identity,
        fromName: msg.from?.name || msg.from?.identity || 'The host',
      });
    } else if (isResponseMessage(message) && msg.from?.identity) {
      const key = `${msg.from.identity}:${message.action}`;
      clearTimeout(pendingResponseTimersRef.current[key]);
      delete pendingResponseTimersRef.current[key];
      setRequestStatusByKey(prev => ({ ...prev, [key]: message.status }));
    }
  }, []);

  const { send: sendHostControlMessage } = useDataChannel(HOST_CONTROL_TOPIC, handleDataMessage);

  // Used by the host-side participant panel: ask a participant to unmute or
  // re-enable their camera. This only ever notifies -- it never flips the
  // participant's device on by itself.
  //
  // LiveKit's data API has no delivery acknowledgement: publishData()
  // resolves once the message reaches the SFU, not once (or whether) the
  // recipient -- who may have gone offline, or simply never act on it --
  // actually sees it. So "sent" is deliberately never presented as
  // "delivered": if no accepted/declined response arrives within
  // REQUEST_RESPONSE_TIMEOUT_MS, the status moves to "no-response" so the
  // host isn't left looking at a request that will never resolve.
  const sendHostRequest = useCallback(
    async (identity, action) => {
      const requestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const key = `${identity}:${action}`;

      await sendHostControlMessage(encodeHostMessage(buildRequestMessage({ requestId, action })), {
        reliable: true,
        destinationIdentities: [identity],
        topic: HOST_CONTROL_TOPIC,
      });
      setRequestStatusByKey(prev => ({ ...prev, [key]: LOCAL_REQUEST_STATUSES.SENT }));

      clearTimeout(pendingResponseTimersRef.current[key]);
      pendingResponseTimersRef.current[key] = setTimeout(() => {
        delete pendingResponseTimersRef.current[key];
        setRequestStatusByKey(prev =>
          prev[key] === LOCAL_REQUEST_STATUSES.SENT
            ? { ...prev, [key]: LOCAL_REQUEST_STATUSES.NO_RESPONSE }
            : prev
        );
      }, REQUEST_RESPONSE_TIMEOUT_MS);
    },
    [sendHostControlMessage]
  );

  const respondToRequest = useCallback(
    async status => {
      if (!incomingRequest) return;
      await sendHostControlMessage(
        encodeHostMessage(
          buildResponseMessage({
            requestId: incomingRequest.requestId,
            action: incomingRequest.action,
            status,
          })
        ),
        {
          reliable: true,
          destinationIdentities: [incomingRequest.fromIdentity],
          topic: HOST_CONTROL_TOPIC,
        }
      );
    },
    [incomingRequest, sendHostControlMessage]
  );

  const handleAcceptRequest = useCallback(async () => {
    if (!incomingRequest || !room) return;
    setAcceptingRequest(true);
    try {
      if (incomingRequest.action === REQUEST_ACTIONS.ENABLE_CAMERA) {
        await room.localParticipant.setCameraEnabled(true);
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      await respondToRequest(RESPONSE_STATUSES.ACCEPTED);
    } catch (err) {
      console.warn('Failed to accept host request:', err);
      await respondToRequest(RESPONSE_STATUSES.FAILED);
      // The host finding out via "Failed to enable" isn't enough -- the
      // participant who actually hit the browser permission prompt (or
      // device-in-use error) needs to know why accepting didn't work too,
      // not just see the banner silently vanish.
      setAcceptError(
        isMediaDeviceError(err)
          ? describeMediaDeviceFailure(
              err.name === 'NotAllowedError' ? 'PermissionDenied' : 'Other',
              incomingRequest.action === REQUEST_ACTIONS.ENABLE_CAMERA ? 'videoinput' : 'audioinput'
            )
          : `Could not turn that on: ${err.message || 'unknown error'}`
      );
    } finally {
      setAcceptingRequest(false);
      setIncomingRequest(null);
    }
  }, [incomingRequest, room, respondToRequest]);

  const handleDeclineRequest = useCallback(async () => {
    await respondToRequest(RESPONSE_STATUSES.DECLINED);
    setIncomingRequest(null);
  }, [respondToRequest]);

  // Auto-dismiss the "accept failed" explanation so it doesn't linger
  // forever once the participant has had a chance to read it.
  useEffect(() => {
    if (!acceptError) return undefined;
    const timer = setTimeout(() => setAcceptError(null), 8000);
    return () => clearTimeout(timer);
  }, [acceptError]);

  const handleTogglePanel = panelName => {
    setActivePanel(prev => (prev === panelName ? null : panelName));
  };

  const handleConfirmLeave = () => {
    setShowLeaveDialog(false);
    if (room) {
      room.disconnect();
    }
    onLeaveRoom();
  };

  const handleCopyLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-relay-950 text-relay-100 overflow-hidden font-sans">
      {/* Real-time status banner */}
      <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-4 py-1 text-center text-xs text-emerald-300 flex items-center justify-center gap-2 shrink-0">
        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
        <span className="truncate">
          <strong>Live WebRTC Stream:</strong> Connected to room <strong>{room?.name}</strong>.
          Media is encrypted and routed via LiveKit SFU.
        </span>
      </div>

      {/* Recording status -- visible to every participant, not just the
          host. This is the notification half of the consent workflow: the
          host sees Stop, everyone else sees Withdraw Consent (see
          RecordingStatusBanner.jsx). */}
      <RecordingStatusBanner
        recording={recording}
        isHost={isHost}
        elapsedMs={elapsedMs}
        starting={startingRecording}
        onStop={() => handleStopRecording()}
        stopping={stoppingRecording}
        onDecline={handleDeclineConsent}
        declining={decliningConsent}
        onDismiss={handleDismissRecordingBanner}
      />

      <RecordingErrorBanner message={recordingError} onDismiss={() => setRecordingError(null)} />

      {/* Host asking this participant to unmute / re-enable their camera --
          delivered over LiveKit's real-time data channel, see useDataChannel
          above, never a fake notification that only exists in local state. */}
      <HostRequestPrompt
        request={incomingRequest}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
        busy={acceptingRequest}
      />

      {/* Shown to the participant themselves when accepting a host request
          failed (permission denied, device in use, etc) -- the host sees
          "Failed to enable" in the panel, but the person who actually hit
          the browser prompt needs to know why too. */}
      {acceptError && (
        <div
          role="alert"
          className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-red-950/40 border-b border-red-800/40 text-xs text-red-200"
        >
          <span>{acceptError}</span>
          <button
            type="button"
            onClick={() => setAcceptError(null)}
            className="text-red-300 hover:text-white transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Non-blocking camera/mic device warnings (e.g. camera in use elsewhere) */}
      {mediaWarnings.length > 0 && (
        <div className="shrink-0 flex flex-col gap-1.5 px-4 py-2 bg-amber-950/30">
          {mediaWarnings.map(warning => (
            <MediaDeviceWarningBanner
              key={warning.kind}
              warning={warning}
              onDismiss={() => onDismissWarning(warning.kind)}
              onRetry={() => onRetryDevice(warning.kind)}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <MeetingHeader
        roomId={room?.name}
        participantCount={participants.length}
        onLeaveClick={() => setShowLeaveDialog(true)}
        isLocked={access.isLocked}
      />

      {/* Main Workspace (Grid + Panels) */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0 bg-relay-950/90 relative overflow-hidden">
          <LiveParticipantGrid onCopyLink={handleCopyLink} />
        </main>

        {/* Right side panels */}
        <LiveParticipantsPanel
          isOpen={activePanel === 'participants'}
          onClose={() => setActivePanel(null)}
          isHost={isHost}
          token={token}
          roomName={room?.name || roomName}
          isLocked={access.isLocked}
          waitingRoomEnabled={access.waitingRoomEnabled}
          waitingParticipants={access.waitingParticipants}
          onToggleLock={access.toggleLock}
          onAdmitWaiting={access.admit}
          onRejectWaiting={access.reject}
          onAdmitAllWaiting={access.admitAll}
          onRemoveParticipant={access.removeParticipantAction}
          requestStatusByKey={requestStatusByKey}
          onSendRequest={sendHostRequest}
          onDirectMessage={participant => {
            setPreselectedChatRecipient(participant);
            setActivePanel('chat');
          }}
        />

        <AssistantPanel
          isOpen={activePanel === 'assistant'}
          onClose={() => setActivePanel(null)}
          isActive={ai.isActive}
          consentGranted={ai.consentGranted}
          transcriptionStatus={ai.transcriptionStatus}
          summaryStatus={ai.summaryStatus}
          pauseReason={ai.pauseReason}
          transcriptionPauseReason={ai.transcriptionPauseReason}
          transcripts={ai.transcripts}
          latestSummary={ai.latestSummary}
          isGeneratingSummary={ai.isGeneratingSummary}
          audioStreamingActive={ai.audioStreamingActive}
          onToggleAI={ai.toggleAI}
          onTriggerSummary={ai.triggerSummary}
          isHost={isHost}
        />

        <ChatPanel
          isOpen={activePanel === 'chat'}
          onClose={() => setActivePanel(null)}
          messages={chatMessages}
          sendMessage={sendChatMessage}
          isConnected={isChatConnected}
          isConnecting={isChatConnecting}
          connectionError={chatConnectionError}
          preselectedRecipient={preselectedChatRecipient}
          onClearPreselectedRecipient={() => setPreselectedChatRecipient(null)}
          hasMore={chatHasMore}
          isLoadingOlder={chatIsLoadingOlder}
          loadOlderMessages={chatLoadOlderMessages}
          unreadByPeer={chatUnreadByPeer}
          unreadCount={chatUnreadCount}
          unreadPrivateCount={chatUnreadPrivateCount}
          markConversationRead={chatMarkConversationRead}
        />
      </div>

      {/* Bottom Meeting Controls */}
      <LiveMeetingControls
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onLeaveClick={() => setShowLeaveDialog(true)}
        showMoreOptions={showMoreOptions}
        onToggleMoreOptions={setShowMoreOptions}
        isHost={isHost}
        recordingStatus={recording.status}
        recordingSupported={recordingSupported}
        startingRecording={startingRecording}
        onStartRecordingClick={handleOpenRecordingConsent}
        onStopRecordingClick={() => handleStopRecording()}
        stoppingRecording={stoppingRecording}
        unreadCount={chatUnreadCount}
        unreadPrivateCount={chatUnreadPrivateCount}
        isAIActive={ai.isActive}
        waitingCount={access.waitingParticipants.length}
      />

      {/* Leave Meeting Confirmation Dialog */}
      <LeaveMeetingDialog
        isOpen={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        onConfirm={handleConfirmLeave}
        isHost={isHost}
        token={token}
        roomName={room?.name}
      />

      {/* Recording consent workflow: the host must explicitly confirm here
          before a recording starts (see RecordingConsentDialog.jsx) -- it is
          never started by a single accidental click. */}
      <RecordingConsentDialog
        isOpen={showRecordingConsent}
        onClose={() => setShowRecordingConsent(false)}
        onConfirm={handleConfirmStartRecording}
        starting={startingRecording}
        error={recordingError}
      />

      {/* Notice shown when this participant is removed by the host */}
      {removedNotice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-relay-900 border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <UserX className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Removed from Meeting</h2>
              <p className="text-xs text-relay-400 leading-relaxed">
                {removedNotice} You cannot rejoin this meeting unless permitted by the host.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onLeaveRoom?.()}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow-lg shadow-red-600/30"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const MeetingRoomLive = ({
  token,
  serverUrl,
  roomName,
  audio = true,
  video = true,
  onDisconnected,
  onError,
  onLeave,
}) => {
  // A single Room instance for the lifetime of this component. Without this,
  // LiveKitRoom creates its own Room internally on every effect mount; under
  // React.StrictMode (apps/web/src/main.jsx) that effect is intentionally
  // mounted twice in development, which previously produced two independent
  // Room instances that each tried to acquire the camera at (almost) the same
  // time. On Windows in particular only one tab/session may hold a camera at
  // once, so the second concurrent getUserMedia() call failed with
  // `NotReadableError: Could not start video source`. Passing a stable Room
  // here means LiveKitRoom's connect effect re-runs against the same
  // instance, and Room.connect()/track publish are idempotent for a given
  // instance, so there is only ever one real connection and one real camera
  // acquisition attempt.
  const room = useMemo(() => new Room(), []);

  // Non-blocking camera/mic warnings, keyed by device kind so a camera and a
  // microphone failure can be shown independently without clobbering each
  // other. A camera failure must never tear down an otherwise-working
  // audio+connection session.
  const [mediaWarnings, setMediaWarnings] = useState([]);

  const handleMediaDeviceFailure = useCallback((failure, kind) => {
    if (kind !== 'videoinput' && kind !== 'audioinput') return;
    setMediaWarnings(prev => {
      const message = describeMediaDeviceFailure(failure, kind);
      const next = prev.filter(w => w.kind !== kind);
      return [...next, { kind, failure, message }];
    });
  }, []);

  const handleDismissWarning = useCallback(kind => {
    setMediaWarnings(prev => prev.filter(w => w.kind !== kind));
  }, []);

  const handleRetryDevice = useCallback(
    async kind => {
      try {
        if (kind === 'videoinput') {
          await room.localParticipant.setCameraEnabled(true);
        } else if (kind === 'audioinput') {
          await room.localParticipant.setMicrophoneEnabled(true);
        }
        // setCameraEnabled/setMicrophoneEnabled resolving means the device
        // started; handleMediaDeviceFailure will re-add the warning if it
        // fails again, so it's safe to clear it optimistically here.
        setMediaWarnings(prev => prev.filter(w => w.kind !== kind));
      } catch (err) {
        // onMediaDeviceFailure (wired to RoomEvent.MediaDevicesError) also
        // fires for this failure and will refresh the warning with the
        // up-to-date reason, so no separate handling is needed here.
        console.warn(`Retry failed for ${kind}:`, err);
      }
    },
    [room]
  );

  // Only genuine LiveKit connection failures (bad token, unreachable server,
  // signaling errors, ...) should bubble up to the parent and knock the user
  // back to the pre-join screen. getUserMedia()-flavored errors (permission
  // denied, device in use, no device) are already surfaced gracefully via
  // onMediaDeviceFailure/handleMediaDeviceFailure above and must not also
  // tear down an otherwise-live room.
  const handleError = useCallback(
    error => {
      if (isMediaDeviceError(error)) {
        console.warn('Media device error handled as a non-fatal warning:', error);
        return;
      }
      onError?.(error);
    },
    [onError]
  );

  return (
    <LiveKitRoom
      room={room}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={audio}
      video={video}
      onDisconnected={onDisconnected}
      onError={handleError}
      onMediaDeviceFailure={handleMediaDeviceFailure}
      className="h-screen w-screen flex flex-col overflow-hidden"
    >
      {/* Background audio renderer playing all remote audio streams */}
      <RoomAudioRenderer />
      <MeetingRoomInner
        token={token}
        roomName={roomName}
        onLeaveRoom={onLeave}
        mediaWarnings={mediaWarnings}
        onDismissWarning={handleDismissWarning}
        onRetryDevice={handleRetryDevice}
      />
    </LiveKitRoom>
  );
};
