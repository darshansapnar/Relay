import React, { useState } from 'react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Video, Copy, Check, PhoneOff, Users } from 'lucide-react';

export const MeetingHeader = ({
  roomId,
  participantCount,
  onParticipantCountChange,
  onLeaveClick,
  isLive = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const inviteUrl = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-relay-950/90 border-b border-relay-800 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Brand and Room Info */}
      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand to-ai flex items-center justify-center text-white shadow-sm">
            <Video className="w-4 h-4" />
          </div>
          <span className="font-bold text-white text-base tracking-tight hidden sm:inline">
            Relay
          </span>
        </div>

        <div className="h-5 w-px bg-relay-800 hidden sm:block" />

        {/* Room Name & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-[220px]">
                {roomId || 'Relay Room'}
              </h1>
              {isLive ? (
                <Badge variant="success" size="sm" dot dotColor="bg-emerald-400">
                  Live WebRTC
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" dot dotColor="bg-amber-400">
                  UI Demo Mode
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-relay-400 truncate hidden md:block">
              {isLive
                ? `LiveKit SFU • ${participantCount || 1} participant${participantCount !== 1 ? 's' : ''} in room`
                : 'Client-side mock interface • No real stream active'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mock Participant Count Switcher (Only in mock demo mode) */}
        {!isLive && onParticipantCountChange && (
          <div className="hidden lg:flex items-center gap-1 bg-relay-900 border border-relay-800 rounded-lg p-1 text-xs">
            <span className="text-[11px] text-relay-400 px-2 flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5" />
              Grid:
            </span>
            {[1, 2, 3, 4].map(count => (
              <button
                key={count}
                onClick={() => onParticipantCountChange(count)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  participantCount === count
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-relay-400 hover:text-white hover:bg-relay-800'
                }`}
                title={`View ${count} mock participant${count > 1 ? 's' : ''}`}
              >
                {count}P
              </button>
            ))}
          </div>
        )}

        {/* Copy Link Button */}
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? Check : Copy}
          onClick={handleCopyLink}
          className={copied ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : ''}
          title="Copy meeting invite link to clipboard"
        >
          <span className="hidden sm:inline">{copied ? 'Link Copied!' : 'Copy Link'}</span>
        </Button>

        {/* Leave Meeting action */}
        <Button
          variant="danger"
          size="sm"
          icon={PhoneOff}
          onClick={onLeaveClick}
          className="bg-red-600/90 hover:bg-red-600"
          title="Exit meeting room"
        >
          <span className="hidden sm:inline">Leave</span>
        </Button>
      </div>
    </header>
  );
};
