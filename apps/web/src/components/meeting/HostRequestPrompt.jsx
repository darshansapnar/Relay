import React from 'react';
import { Mic, Video, Check, X } from 'lucide-react';

// Shown to a participant when the host asks them (over LiveKit's real-time
// data channel, not a fake local-only state) to unmute their microphone or
// turn their camera back on. The host can revoke publish permission, but
// only this participant's own browser can actually turn a device on, so
// accepting here is what triggers the real getUserMedia()/publish call.
export const HostRequestPrompt = ({ request, onAccept, onDecline, busy = false }) => {
  if (!request) return null;

  const isCamera = request.action === 'enable-camera';
  const Icon = isCamera ? Video : Mic;
  const label = isCamera ? 'turn your camera back on' : 'unmute your microphone';

  return (
    <div
      role="alert"
      className="shrink-0 flex items-start gap-3 px-4 py-2.5 bg-brand/10 border-b border-brand/30 text-xs"
    >
      <Icon className="w-4 h-4 shrink-0 text-brand-light mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-white">
          {request.fromName || 'The host'} is asking you to {label}.
        </span>
        <p className="text-relay-300 mt-0.5">
          Accepting will request browser permission if needed and start sending your{' '}
          {isCamera ? 'video' : 'audio'} again.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand hover:bg-brand-hover text-white text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          <span>{busy ? 'Working...' : isCamera ? 'Turn On Camera' : 'Unmute'}</span>
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-relay-800 hover:bg-relay-700 border border-relay-700 text-relay-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          <span>Dismiss</span>
        </button>
      </div>
    </div>
  );
};
