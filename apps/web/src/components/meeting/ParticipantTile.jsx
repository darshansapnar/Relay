import React from 'react';
import { Mic, MicOff, VideoOff, Crown } from 'lucide-react';

export const ParticipantTile = ({
  participant,
  isSpeaking = false,
  isMuted = false,
  isVideoOff = false,
  isLocal = false,
}) => {
  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-relay-900 border transition-all duration-300 flex items-center justify-center group select-none shadow-lg ${
        isSpeaking
          ? 'border-brand ring-2 ring-brand/40 shadow-glow-brand'
          : 'border-relay-800/90 hover:border-relay-700'
      }`}
    >
      {/* Background container / simulated video surface */}
      <div className="absolute inset-0 bg-gradient-to-b from-relay-900/60 via-relay-950/40 to-relay-950/90 pointer-events-none z-10" />

      {/* Main Avatar / Placeholder */}
      <div className="relative z-20 flex flex-col items-center justify-center p-4 text-center">
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-tr ${participant.avatarGradient || 'from-blue-600 to-indigo-600'} flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl ring-4 ring-relay-800/80 transition-transform group-hover:scale-105 duration-300`}
        >
          {participant.initials}
        </div>

        {isVideoOff && (
          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-relay-400 bg-relay-800/80 px-2.5 py-0.5 rounded-full border border-relay-700/60">
            <VideoOff className="w-3 h-3 text-relay-400" />
            Camera Off
          </span>
        )}
      </div>

      {/* Top Left: Active Speaker audio wave badge */}
      {isSpeaking && (
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-1.5 bg-brand/20 border border-brand/40 backdrop-blur-md px-2.5 py-1 rounded-full animate-in fade-in">
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

      {/* Top Right: Host / Role badge */}
      {participant.role === 'Host' && (
        <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1 bg-relay-800/80 border border-relay-700 text-amber-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
          <Crown className="w-3 h-3 text-amber-400" />
          <span>Host</span>
        </div>
      )}

      {/* Bottom Bar: Name & Mic status */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 truncate max-w-[80%] bg-relay-950/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-relay-800/80">
          <span className="font-semibold text-white truncate">{participant.name}</span>
          {isLocal && (
            <span className="text-[11px] text-brand-light font-medium shrink-0">(You)</span>
          )}
        </div>

        <div
          className={`p-1.5 rounded-lg backdrop-blur-md border transition-colors ${
            isMuted
              ? 'bg-red-500/20 border-red-500/30 text-red-400'
              : 'bg-relay-800/80 border-relay-700/80 text-emerald-400'
          }`}
          title={isMuted ? 'Microphone Muted' : 'Microphone Active'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
};
