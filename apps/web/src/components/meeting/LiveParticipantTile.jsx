import React from 'react';
import { VideoTrack } from '@livekit/components-react';
import { Mic, MicOff, VideoOff, UserRound, Crown } from 'lucide-react';

// Deterministic gradient generator based on participant identity/name
const GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-violet-600 to-purple-600',
  'from-emerald-600 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-rose-600 to-pink-600',
  'from-cyan-600 to-blue-600',
];

function getGradient(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const LiveParticipantTile = ({ trackRef, isScreenShare = false }) => {
  const participant = trackRef?.participant;
  const name = participant?.name || participant?.identity || 'Participant';
  // LiveKit's own Participant.isLocal flag -- not a display-name comparison --
  // is the only reliable way to tell "this browser's user" apart from a
  // remote participant, since two people can pick the same display name.
  const isLocal = Boolean(participant?.isLocal);
  // Host status is assigned once, server-side, at token mint time and
  // broadcast to every participant via LiveKit's participant attributes --
  // never derived from render/array order (see apps/api/src/controllers/
  // meeting.controller.js and the docs on isLocal above).
  const isParticipantHost = participant?.attributes?.role === 'host';
  const isMutedByHost = participant?.attributes?.mutedByHost === 'true';
  const isCameraDisabledByHost = participant?.attributes?.cameraDisabledByHost === 'true';
  const isSpeaking = Boolean(participant?.isSpeaking);
  const isMicrophoneEnabled = Boolean(participant?.isMicrophoneEnabled);
  const isCameraEnabled = Boolean(
    participant?.isCameraEnabled && trackRef?.publication?.track && !trackRef?.publication?.isMuted
  );

  const initials = getInitials(name);
  const gradient = getGradient(name);

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-relay-900 border transition-all duration-300 flex items-center justify-center select-none shadow-lg ${
        isSpeaking && !isScreenShare
          ? 'border-brand ring-2 ring-brand/40 shadow-glow-brand'
          : 'border-relay-800/90 hover:border-relay-700'
      }`}
    >
      {/* Real Video Track or Avatar Fallback */}
      {isCameraEnabled || (isScreenShare && trackRef?.publication?.track) ? (
        <div className="absolute inset-0 w-full h-full">
          <VideoTrack
            trackRef={trackRef}
            className={`w-full h-full ${
              isScreenShare ? 'object-contain bg-relay-950' : 'object-cover'
            }`}
          />
          {/* Subtle overlay vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-relay-950/80 via-transparent to-transparent pointer-events-none z-10" />
        </div>
      ) : (
        <div className="relative z-20 flex flex-col items-center justify-center p-4 text-center">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl ring-4 ring-relay-800/80 transition-transform hover:scale-105 duration-300`}
          >
            {initials}
          </div>

          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-relay-400 bg-relay-800/80 px-2.5 py-0.5 rounded-full border border-relay-700/60">
            <VideoOff className="w-3 h-3 text-relay-400" />
            {isCameraDisabledByHost ? 'Camera Disabled by Host' : 'Camera Off'}
          </span>
        </div>
      )}

      {/* Top Left: Active Speaker audio wave badge */}
      {isSpeaking && !isScreenShare && (
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-1.5 bg-brand/25 border border-brand/40 backdrop-blur-md px-2.5 py-1 rounded-full animate-in fade-in">
          <div className="flex items-center gap-0.5">
            <div className="w-1 bg-brand-light rounded animate-wave-1" />
            <div className="w-1 bg-brand-light rounded animate-wave-2" />
            <div className="w-1 bg-brand-light rounded animate-wave-3" />
            <div className="w-1 bg-brand-light rounded animate-wave-4" />
          </div>
          <span className="text-[10px] font-medium text-brand-light tracking-wide uppercase">
            Speaking
          </span>
        </div>
      )}

      {/* Screen share badge */}
      {isScreenShare && (
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-medium px-2.5 py-1 rounded-full backdrop-blur-md">
          <span>Screen Share • {name}</span>
        </div>
      )}

      {/* Top Right: Host / local-participant tag. isParticipantHost and isLocal
          both come straight from the LiveKit SDK's own participant state --
          never "whichever tile happened to render first". */}
      {!isScreenShare &&
        (isParticipantHost ? (
          <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1 bg-relay-800/80 border border-relay-700 text-amber-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
            <Crown className="w-3 h-3 text-amber-400" />
            <span>Host</span>
          </div>
        ) : (
          isLocal && (
            <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1 bg-brand/15 border border-brand/30 text-brand-light text-[10px] font-medium px-2 py-0.5 rounded-md">
              <UserRound className="w-3 h-3 text-brand-light" />
              <span>You</span>
            </div>
          )
        ))}

      {/* Bottom Bar: Name & Mic status */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 truncate max-w-[80%] bg-relay-950/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-relay-800/80">
          <span className="font-semibold text-white truncate">{name}</span>
          {isLocal && (
            <span className="text-[11px] text-brand-light font-medium shrink-0">(You)</span>
          )}
        </div>

        {!isScreenShare && (
          <div
            className={`p-1.5 rounded-lg backdrop-blur-md border transition-colors ${
              !isMicrophoneEnabled
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : 'bg-relay-800/80 border-relay-700/80 text-emerald-400'
            }`}
            title={
              isMutedByHost
                ? 'Muted by host'
                : isMicrophoneEnabled
                  ? 'Microphone Active'
                  : 'Microphone Muted'
            }
          >
            {!isMicrophoneEnabled ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
