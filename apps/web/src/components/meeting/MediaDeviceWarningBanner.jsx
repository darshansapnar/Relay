import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

// Non-blocking warning shown inside a live meeting when the camera or
// microphone fails to start (permission denied, device in use, no device
// found). The meeting keeps running on whatever media did succeed -- e.g.
// camera-only failures leave the user connected and audible, continuing as
// an audio-only participant instead of being disconnected back to the
// pre-join screen.
export const MediaDeviceWarningBanner = ({ warning, onDismiss, onRetry }) => {
  const isCamera = warning.kind === 'videoinput';
  const deviceName = isCamera ? 'Camera' : 'Microphone';

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold block text-white">{deviceName} unavailable</span>
        <p className="mt-0.5 text-amber-200/90 leading-relaxed">
          {warning.message}
          {isCamera && ' Continuing in the meeting with audio only.'}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-[11px] font-medium transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry {deviceName}</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss warning"
          className="p-1 rounded-md text-amber-300/70 hover:text-white hover:bg-amber-500/15 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
