import React from 'react';
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
} from 'lucide-react';
import { MoreOptionsMenu } from './MoreOptionsMenu.jsx';

export const MeetingControls = ({
  isMuted,
  onToggleMic,
  isVideoOff,
  onToggleVideo,
  onScreenShareClick,
  activePanel,
  onTogglePanel,
  participantCount,
  onLeaveClick,
  showMoreOptions,
  onToggleMoreOptions,
}) => {
  return (
    <footer className="relative h-20 px-4 bg-relay-950/95 border-t border-relay-800 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left Spacer (matches right controls width on desktop for center alignment) */}
      <div className="hidden md:flex items-center gap-2 w-48 text-xs text-relay-400">
        <span className="font-mono text-[11px] bg-relay-900 border border-relay-800 px-2.5 py-1 rounded-md">
          {isMuted ? 'Mic Off' : 'Mic On'} • {isVideoOff ? 'Cam Off' : 'Cam On'}
        </span>
      </div>

      {/* Center: Audio / Video / Screen Share / Controls */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-1 md:flex-initial">
        {/* Microphone Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-relay-950 ${
            isMuted
              ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25 focus:ring-red-500'
              : 'bg-relay-850 border-relay-700/80 text-white hover:bg-relay-800 hover:border-relay-600 focus:ring-brand'
          }`}
          title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleVideo}
          aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-relay-950 ${
            isVideoOff
              ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25 focus:ring-red-500'
              : 'bg-relay-850 border-relay-700/80 text-white hover:bg-relay-800 hover:border-relay-600 focus:ring-brand'
          }`}
          title={isVideoOff ? 'Start Video (V)' : 'Stop Video (V)'}
        >
          {isVideoOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5 text-emerald-400" />
          )}
        </button>

        {/* Screen Share (UI Demo) */}
        <button
          type="button"
          onClick={onScreenShareClick}
          aria-label="Share screen (Demo)"
          className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-relay-850 border border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800 hover:border-relay-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand"
          title="Share Screen (Demo)"
        >
          <Share2 className="w-5 h-5" />
        </button>

        <div className="h-7 w-px bg-relay-800 mx-1 hidden sm:block" />

        {/* Leave Meeting (Center on mobile, prominent red button) */}
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

      {/* Right: Panels & More options */}
      <div className="relative flex items-center justify-end gap-2 w-auto md:w-48">
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
            {participantCount}
          </span>
        </button>

        {/* AI Assistant Panel Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel('assistant')}
          aria-label="Toggle AI assistant panel"
          className={`relative p-3 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai ${
            activePanel === 'assistant'
              ? 'bg-ai text-white border-ai shadow-glow-ai'
              : 'bg-relay-850 border-relay-700/80 text-relay-300 hover:text-white hover:bg-relay-800'
          }`}
          title="Relay AI Assistant Copilot"
        >
          <Sparkles className="w-5 h-5 text-ai-accent" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ai rounded-full ring-2 ring-relay-950 animate-pulse" />
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
