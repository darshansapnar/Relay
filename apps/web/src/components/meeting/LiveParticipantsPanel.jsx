import React, { useState } from 'react';
import { useParticipants } from '@livekit/components-react';
import { X, Mic, MicOff, Video, VideoOff, Crown, Search, UserCheck } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const LiveParticipantsPanel = ({ isOpen, onClose }) => {
  const participants = useParticipants();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = participants.filter(p => {
    const name = p.name || p.identity || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
        {filtered.map((participant, index) => {
          const name = participant.name || participant.identity || 'Participant';
          const isLocal = Boolean(participant.isLocal);
          const isMicOn = Boolean(participant.isMicrophoneEnabled);
          const isCamOn = Boolean(participant.isCameraEnabled);
          const initials = getInitials(name);

          return (
            <div
              key={participant.identity}
              className="flex items-center justify-between p-2.5 rounded-xl bg-relay-850/80 border border-relay-800/80 hover:border-relay-700 hover:bg-relay-800 transition-colors"
            >
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
                    {index === 0 && (
                      <span className="text-[10px] text-amber-400 flex items-center gap-0.5 font-medium">
                        <Crown className="w-2.5 h-2.5" /> Host
                      </span>
                    )}
                    {index !== 0 && (
                      <span className="text-[10px] text-relay-400 truncate">Participant</span>
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
                  title={isMicOn ? 'Microphone Active' : 'Microphone Muted'}
                >
                  {!isMicOn ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </span>

                <span
                  className={`p-1 rounded-md ${
                    !isCamOn ? 'text-relay-500 bg-relay-800' : 'text-emerald-400 bg-emerald-500/10'
                  }`}
                  title={isCamOn ? 'Video Active' : 'Video Off'}
                >
                  {!isCamOn ? (
                    <VideoOff className="w-3.5 h-3.5" />
                  ) : (
                    <Video className="w-3.5 h-3.5" />
                  )}
                </span>
              </div>
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
