import React, { useState } from 'react';
import { useParticipants } from '@livekit/components-react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Search,
  UserCheck,
  Crown,
  UserX,
  BellRing,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { muteParticipant, setParticipantCamera, removeParticipant } from '../../api/meetingApi.js';
import { REQUEST_ACTIONS } from '../../utils/hostRequests.js';

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// LiveKit's data API has no delivery acknowledgement, so "sent" only ever
// means "handed to the server" -- never claim it was delivered or seen.
const REQUEST_STATUS_LABEL = {
  sent: 'Sent, awaiting response...',
  accepted: 'Accepted',
  declined: 'Declined',
  failed: 'Failed to enable',
  'no-response': 'No response (they may be unavailable)',
};

export const LiveParticipantsPanel = ({
  isOpen,
  onClose,
  isHost = false,
  token,
  roomName,
  requestStatusByKey = {},
  onSendRequest,
  onDirectMessage,
}) => {
  const participants = useParticipants();
  const [searchQuery, setSearchQuery] = useState('');
  // identity -> a short action tag ('mic' | 'camera' | 'remove'), so a slow
  // request only disables that row's own buttons, and errors are per-row.
  const [pendingAction, setPendingAction] = useState({});
  const [rowError, setRowError] = useState({});

  if (!isOpen) return null;

  const filtered = participants.filter(p => {
    const name = p.name || p.identity || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const runAction = async (identity, kind, action) => {
    setRowError(prev => ({ ...prev, [identity]: null }));
    setPendingAction(prev => ({ ...prev, [identity]: kind }));
    try {
      await action();
    } catch (err) {
      setRowError(prev => ({ ...prev, [identity]: err.message || 'Action failed.' }));
    } finally {
      setPendingAction(prev => ({ ...prev, [identity]: null }));
    }
  };

  const handleMute = identity =>
    runAction(identity, 'mic', () => muteParticipant(roomName, identity, true, token));

  // The host can lift the publish restriction they previously set, but only
  // the participant's own browser can actually turn their microphone back
  // on -- so "request to unmute" grants that capability back AND asks them
  // to use it, over the real-time data channel, instead of silently
  // flipping their mic on for them.
  const handleRequestUnmute = identity =>
    runAction(identity, 'mic', async () => {
      await muteParticipant(roomName, identity, false, token);
      await onSendRequest?.(identity, REQUEST_ACTIONS.UNMUTE);
    });

  const handleDisableCamera = identity =>
    runAction(identity, 'camera', () => setParticipantCamera(roomName, identity, true, token));

  const handleRequestCamera = identity =>
    runAction(identity, 'camera', async () => {
      await setParticipantCamera(roomName, identity, false, token);
      await onSendRequest?.(identity, REQUEST_ACTIONS.ENABLE_CAMERA);
    });

  const handleRemove = identity =>
    runAction(identity, 'remove', () => removeParticipant(roomName, identity, token));

  return (
    <aside
      aria-label="Participants panel"
      className="w-full sm:w-80 md:w-96 bg-relay-900 border-l border-relay-800 flex flex-col h-full shrink-0 select-none z-20 animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-relay-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Participants</h2>
          <Badge variant="brand" size="sm">
            {participants.length}
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-relay-400 hover:text-white hover:bg-relay-800 transition-colors"
          aria-label="Close participants panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-relay-800 bg-relay-950/40">
        <div className="relative">
          <Search className="w-4 h-4 text-relay-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-relay-800 border border-relay-700 text-xs text-white placeholder-relay-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      {/* Real Participant List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map(participant => {
          const name = participant.name || participant.identity || 'Participant';
          // participant.isLocal and participant.attributes come straight from
          // the LiveKit SDK -- useParticipants() always returns
          // [localParticipant, ...remoteParticipants], so list position must
          // never be used to infer identity or role. Host status comes from
          // participant.attributes.role, set once server-side at token mint
          // time (see apps/api/src/controllers/meeting.controller.js) and
          // broadcast to every client by LiveKit -- it is not a local guess.
          const isLocal = Boolean(participant.isLocal);
          const isParticipantHost = participant.attributes?.role === 'host';
          const isMicOn = Boolean(participant.isMicrophoneEnabled);
          const isCamOn = Boolean(participant.isCameraEnabled);
          const isMutedByHost = participant.attributes?.mutedByHost === 'true';
          const initials = getInitials(name);
          const busy = pendingAction[participant.identity];
          const error = rowError[participant.identity];
          const micRequestStatus = requestStatusByKey[`${participant.identity}:unmute`];
          const cameraRequestStatus = requestStatusByKey[`${participant.identity}:enable-camera`];

          return (
            <div
              key={participant.identity}
              className="rounded-xl bg-relay-850/80 border border-relay-800/80 hover:border-relay-700 hover:bg-relay-800 transition-colors"
            >
              <div className="flex items-center justify-between p-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-white truncate">{name}</span>
                      {isLocal && (
                        <span className="text-[10px] text-brand-light font-medium bg-brand/10 border border-brand/20 px-1.5 py-0.2 rounded shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isParticipantHost ? (
                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5 font-medium">
                          <Crown className="w-2.5 h-2.5" /> Host
                        </span>
                      ) : (
                        !isLocal && (
                          <span className="text-[10px] text-relay-400 truncate">Participant</span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Icons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`p-1 rounded-md ${
                      !isMicOn ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'
                    }`}
                    title={
                      isMutedByHost
                        ? 'Muted by host'
                        : isMicOn
                          ? 'Microphone Active'
                          : 'Microphone Muted'
                    }
                  >
                    {!isMicOn ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </span>

                  <span
                    className={`p-1 rounded-md ${
                      !isCamOn
                        ? 'text-relay-500 bg-relay-800'
                        : 'text-emerald-400 bg-emerald-500/10'
                    }`}
                    title={isCamOn ? 'Video Active' : 'Video Off'}
                  >
                    {!isCamOn ? (
                      <VideoOff className="w-3.5 h-3.5" />
                    ) : (
                      <Video className="w-3.5 h-3.5" />
                    )}
                  </span>

                  {!isLocal && onDirectMessage && (
                    <button
                      type="button"
                      onClick={() =>
                        onDirectMessage({
                          identity: participant.identity,
                          name: participant.name || participant.identity,
                        })
                      }
                      className="p-1 rounded-md text-relay-400 hover:text-white hover:bg-relay-800 transition-colors"
                      title={`Send direct message to ${participant.name || 'participant'}`}
                      aria-label={`Send direct message to ${participant.name || 'participant'}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-relay-300 hover:text-brand-light" />
                    </button>
                  )}
                </div>
              </div>

              {/* Host-only moderation actions. Hiding these from non-hosts is
                  a UX nicety, not the security boundary -- the backend
                  re-verifies the caller is really the host on every request,
                  and rejects the host targeting their own row. */}
              {isHost && !isLocal && (
                <div className="px-2.5 pb-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {isMicOn ? (
                      <button
                        type="button"
                        onClick={() => handleMute(participant.identity)}
                        disabled={Boolean(busy)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-relay-800 hover:bg-relay-700 border border-relay-700 text-relay-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        <MicOff className="w-3 h-3" />
                        <span>{busy === 'mic' ? 'Working...' : 'Mute'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestUnmute(participant.identity)}
                        disabled={Boolean(busy)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand-light text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{busy === 'mic' ? 'Working...' : 'Request Unmute'}</span>
                      </button>
                    )}

                    {isCamOn ? (
                      <button
                        type="button"
                        onClick={() => handleDisableCamera(participant.identity)}
                        disabled={Boolean(busy)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-relay-800 hover:bg-relay-700 border border-relay-700 text-relay-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        <VideoOff className="w-3 h-3" />
                        <span>{busy === 'camera' ? 'Working...' : 'Camera Off'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestCamera(participant.identity)}
                        disabled={Boolean(busy)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand-light text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{busy === 'camera' ? 'Working...' : 'Request Camera'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(participant.identity)}
                    disabled={Boolean(busy)}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 hover:text-red-200 text-[11px] font-medium transition-colors disabled:opacity-50"
                  >
                    <UserX className="w-3 h-3" />
                    <span>{busy === 'remove' ? 'Working...' : 'Remove'}</span>
                  </button>

                  {(micRequestStatus || cameraRequestStatus) && (
                    <div className="flex items-center gap-2 text-[10px] text-relay-400">
                      {micRequestStatus && (
                        <span>
                          Mic: {REQUEST_STATUS_LABEL[micRequestStatus] || micRequestStatus}
                        </span>
                      )}
                      {cameraRequestStatus && (
                        <span>
                          Camera: {REQUEST_STATUS_LABEL[cameraRequestStatus] || cameraRequestStatus}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {error && <div className="px-2.5 pb-2.5 text-[10px] text-red-400">{error}</div>}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-relay-800 bg-relay-950/60 text-[11px] text-relay-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          LiveKit Roster Sync
        </span>
        <span className="text-relay-500 font-mono text-[10px]">WebRTC SFU</span>
      </div>
    </aside>
  );
};
