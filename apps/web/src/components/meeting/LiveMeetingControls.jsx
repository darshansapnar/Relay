import React, { useState } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  Users,
  Sparkles,
  MoreVertical,
  PhoneOff,
  Disc,
  Square,
  MessageSquare,
} from 'lucide-react';
import { MoreOptionsMenu } from './MoreOptionsMenu.jsx';
import { LOCAL_RECORDING_STATUS, isActiveRecordingStatus } from '../../utils/recordingProtocol.js';

export const LiveMeetingControls = ({
  activePanel,
  onTogglePanel,
  onLeaveClick,
  showMoreOptions,
  onToggleMoreOptions,
  isHost = false,
  recordingStatus = LOCAL_RECORDING_STATUS.IDLE,
  recordingSupported = true,
  startingRecording = false,
  onStartRecordingClick,
  onStopRecordingClick,
  stoppingRecording = false,
  unreadCount = 0,
  unreadPrivateCount = 0,
  isAIActive = false,
}) => {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const participants = useParticipants();

  const [togglingMic, setTogglingMic] = useState(false);
  const [togglingCam, setTogglingCam] = useState(false);
  const [togglingScreen, setTogglingScreen] = useState(false);

  // Set server-side when the host mutes/disables this participant's track
  // (see apps/api/src/controllers/host.controller.js). The host's action
  // also revokes permission to republish that track, so attempting to
  // re-enable it here would just be rejected by the SFU -- check for it up
  // front instead of letting that round-trip fail. Lifted again either
  // directly by the host or via a "request to unmute/enable camera", which
  // the participant sees as a HostRequestPrompt (see MeetingRoomLive.jsx).
  const isMutedByHost = localParticipant?.attributes?.mutedByHost === 'true';
  const isCameraDisabledByHost = localParticipant?.attributes?.cameraDisabledByHost === 'true';

  const handleToggleMic = async () => {
    if (!localParticipant || togglingMic) return;
    if (isMutedByHost && !isMicrophoneEnabled) return;
    setTogglingMic(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
    } finally {
      setTogglingMic(false);
    }
  };

  const handleToggleCam = async () => {
    if (!localParticipant || togglingCam) return;
    if (isCameraDisabledByHost && !isCameraEnabled) return;
    setTogglingCam(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
    } finally {
      setTogglingCam(false);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!localParticipant || togglingScreen) return;
    setTogglingScreen(true);
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      // User cancelled browser screen share dialog or permission denied
      console.warn('Screen share cancelled or failed:', err);
    } finally {
      setTogglingScreen(false);
    }
  };

  return (
    <footer className="relative h-20 px-4 bg-relay-950/95 border-t border-relay-800 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left Status indicator */}
      <div className="hidden md:flex items-center gap-2 w-48 text-xs text-relay-400">
        <span className="font-mono text-[11px] bg-relay-900 border border-relay-800 px-2.5 py-1 rounded-md">
          {isMicrophoneEnabled ? 'Mic Active' : 'Mic Muted'} •{' '}
          {isCameraEnabled ? 'Cam Active' : 'Cam Off'}
        </span>
      </div>

      {/* Center Controls */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-1 md:flex-initial">
        {/* Real Microphone Toggle */}
        <button
          type="button"
          onClick={handleToggleMic}
          disabled={togglingMic || (isMutedByHost && !isMicrophoneEnabled)}
          aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-relay-950 ${
            !isMicrophoneEnabled
              ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25 focus:ring-red-500'
              : 'bg-relay-850 border-relay-700/80 text-white hover:bg-relay-800 hover:border-relay-600 focus:ring-brand'
          }`}
          title={
            isMutedByHost && !isMicrophoneEnabled
              ? 'Muted by host'
              : isMicrophoneEnabled
                ? 'Mute Microphone'
                : 'Unmute Microphone'
          }
        >
          {!isMicrophoneEnabled ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5 text-emerald-400" />
          )}
        </button>

        {/* Real Camera Toggle */}
        <button
          type="button"
          onClick={handleToggleCam}
          disabled={togglingCam || (isCameraDisabledByHost && !isCameraEnabled)}
          aria-label={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-relay-950 ${
            !isCameraEnabled
              ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25 focus:ring-red-500'
              : 'bg-relay-850 border-relay-700/80 text-white hover:bg-relay-800 hover:border-relay-600 focus:ring-brand'
          }`}
          title={
            isCameraDisabledByHost && !isCameraEnabled
              ? 'Camera disabled by host'
              : isCameraEnabled
                ? 'Turn Off Camera'
                : 'Turn On Camera'
          }
        >
          {!isCameraEnabled ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5 text-emerald-400" />
          )}
        </button>

        {/* Real Screen Share Toggle */}
        <button
          type="button"
          onClick={handleToggleScreenShare}
          disabled={togglingScreen}
          aria-label={isScreenShareEnabled ? 'Stop sharing screen' : 'Share screen'}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand ${
            isScreenShareEnabled
              ? 'bg-blue-600 text-white border-blue-500 shadow-glow-brand'
              : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800'
          }`}
          title={isScreenShareEnabled ? 'Stop Sharing Screen' : 'Share Screen'}
        >
          <Share2 className="w-5 h-5" />
        </button>

        {/* Host-only local recording control. This is a browser-local
            feature with no backend route to re-verify -- the authorization
            boundary IS the UI gate here, using the same authoritative,
            server-assigned host identity (`isHost`, derived from
            participant.attributes.role -- see MeetingRoomLive.jsx) as every
            other host-only control in this app. A non-host has no code path
            that can start or stop another participant's local recording;
            the only cross-participant action is withdrawing consent, which
            is intentionally available to everyone (see
            RecordingStatusBanner.jsx). */}
        {isHost && (
          <button
            type="button"
            onClick={
              isActiveRecordingStatus(recordingStatus)
                ? onStopRecordingClick
                : onStartRecordingClick
            }
            disabled={
              isActiveRecordingStatus(recordingStatus)
                ? stoppingRecording
                : !recordingSupported || startingRecording
            }
            aria-label={
              isActiveRecordingStatus(recordingStatus) ? 'Stop recording' : 'Start recording'
            }
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-relay-950 disabled:opacity-40 ${
              isActiveRecordingStatus(recordingStatus)
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/25 focus:ring-red-500'
                : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800 focus:ring-brand'
            }`}
            title={
              !recordingSupported && !isActiveRecordingStatus(recordingStatus)
                ? 'This browser does not support local audio recording (requires MediaRecorder with WebM/Opus support)'
                : isActiveRecordingStatus(recordingStatus)
                  ? 'Stop Recording'
                  : 'Start Recording'
            }
          >
            {isActiveRecordingStatus(recordingStatus) ? (
              <Square className="w-4 h-4 fill-current" />
            ) : (
              <Disc className="w-5 h-5" />
            )}
          </button>
        )}

        <div className="h-7 w-px bg-relay-800 mx-1 hidden sm:block" />

        {/* Leave Meeting action */}
        <button
          type="button"
          onClick={onLeaveClick}
          aria-label="Leave meeting"
          className="flex items-center justify-center gap-2 px-4 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs sm:text-sm shadow-lg shadow-red-600/25 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
          title="Leave Meeting"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>

      {/* Right Panels & Options */}
      <div className="relative flex items-center justify-end gap-2 w-auto md:w-48">
        {/* In-Meeting Chat Panel Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel('chat')}
          aria-label="Toggle chat panel"
          className={`relative p-3 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand ${
            activePanel === 'chat'
              ? 'bg-brand text-white border-brand shadow-glow-brand'
              : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800'
          }`}
          title={
            unreadPrivateCount > 0
              ? `Chat (${unreadPrivateCount} unread direct message${unreadPrivateCount > 1 ? 's' : ''})`
              : unreadCount > 0
                ? `Chat (${unreadCount} unread message${unreadCount > 1 ? 's' : ''})`
                : 'Meeting Chat'
          }
        >
          <MessageSquare className="w-5 h-5" />
          {unreadPrivateCount > 0 ? (
            <span
              data-testid="unread-private-badge"
              className="absolute -top-1 -right-1 px-1 min-w-4 h-4 bg-amber-500 text-[10px] font-bold text-relay-950 rounded-full flex items-center justify-center border border-relay-900 shadow-sm animate-pulse"
            >
              {unreadPrivateCount}
            </span>
          ) : unreadCount > 0 ? (
            <span
              data-testid="unread-badge"
              className="absolute -top-1 -right-1 px-1 min-w-4 h-4 bg-brand text-[10px] font-semibold text-white rounded-full flex items-center justify-center border border-relay-900 shadow-sm"
            >
              {unreadCount}
            </span>
          ) : null}
        </button>

        {/* Participants Panel Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel('participants')}
          aria-label="Toggle participants panel"
          className={`relative p-3 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand ${
            activePanel === 'participants'
              ? 'bg-brand text-white border-brand shadow-glow-brand'
              : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800'
          }`}
          title="Participants list"
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-relay-700 text-[10px] font-semibold text-white rounded-full flex items-center justify-center border border-relay-900">
            {participants.length}
          </span>
        </button>

        {/* AI Assistant Panel Toggle */}
        <button
          id="open-assistant-panel-btn"
          type="button"
          onClick={() => onTogglePanel('assistant')}
          aria-label="Toggle AI assistant panel"
          className={`relative p-3 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai ${
            activePanel === 'assistant'
              ? 'bg-ai text-white border-ai shadow-glow-ai'
              : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800'
          }`}
          title={isAIActive ? 'Relay AI Assistant Copilot (Active)' : 'Relay AI Assistant Copilot'}
        >
          <Sparkles className={`w-5 h-5 ${isAIActive ? 'text-ai-accent' : 'text-relay-400'}`} />
          {isAIActive ? (
            <span
              data-testid="ai-active-indicator"
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-relay-950 animate-pulse"
            />
          ) : (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-relay-600 rounded-full ring-2 ring-relay-950" />
          )}
        </button>


        {/* More Options Dropdown Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMoreOptions}
            aria-label="More meeting options"
            className={`p-3 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand ${
              showMoreOptions
                ? 'bg-relay-800 border-relay-600 text-white'
                : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800'
            }`}
            title="More Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          <MoreOptionsMenu isOpen={showMoreOptions} onClose={() => onToggleMoreOptions(false)} />
        </div>
      </div>
    </footer>
  );
};
