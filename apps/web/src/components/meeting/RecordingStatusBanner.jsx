import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { LOCAL_RECORDING_STATUS } from '../../utils/recordingProtocol.js';

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Visible to every participant, not just the host -- this is the
 * notification half of the recording consent workflow (see
 * RecordingConsentDialog.jsx for the confirmation half). It renders purely
 * from the recording state MeetingRoomLive.jsx maintains from the server
 * (initial status fetch + live data-channel push), so a participant who
 * joins mid-recording sees this immediately rather than only "whoever was
 * connected when the host clicked Start".
 *
 * The host sees a Stop control; everyone else sees a Withdraw Consent
 * control instead, which sends a decline message the host's client reacts
 * to by stopping the recording -- consent can be pulled at any time, by
 * anyone, not just granted once at the start.
 */
export const RecordingStatusBanner = ({
  recording,
  isHost,
  elapsedMs,
  starting,
  onStop,
  stopping,
  onDecline,
  declining,
  onDismiss,
}) => {
  const status = recording?.status || LOCAL_RECORDING_STATUS.IDLE;

  if (starting) {
    return (
      <div
        role="status"
        className="shrink-0 flex items-center gap-2.5 px-4 py-2 bg-red-950/40 border-b border-red-800/40 text-xs text-red-200"
      >
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>Starting recording...</span>
      </div>
    );
  }

  if (status === LOCAL_RECORDING_STATUS.RECORDING) {
    return (
      <div
        role="status"
        className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 bg-red-950/40 border-b border-red-800/40 text-xs text-red-200"
      >
        <span className="flex items-center gap-1.5 font-semibold text-white shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          Recording
        </span>
        <span className="font-mono text-[11px] bg-red-900/40 border border-red-800/50 px-2 py-0.5 rounded-md">
          {formatElapsed(elapsedMs)}
        </span>
        <span className="text-red-300/90">
          {recording.requestedByName ? `Started by ${recording.requestedByName}. ` : ''}
          Recorded locally in the host's browser. By staying in this meeting you consent to this
          recording.
        </span>
        {isHost ? (
          <button
            type="button"
            onClick={onStop}
            disabled={stopping}
            className="ml-auto shrink-0 px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50"
          >
            {stopping ? 'Stopping...' : 'Stop Recording'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onDecline}
            disabled={declining}
            className="ml-auto shrink-0 px-2.5 py-1 rounded-md bg-relay-800 hover:bg-relay-700 border border-relay-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50"
          >
            {declining ? 'Sending...' : 'Withdraw Consent'}
          </button>
        )}
      </div>
    );
  }

  if (status === LOCAL_RECORDING_STATUS.STOPPED) {
    return (
      <div
        role="status"
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-emerald-950/30 border-b border-emerald-800/40 text-xs text-emerald-200"
      >
        <span>Recording stopped{isHost ? ' and saved to your device.' : '.'}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-emerald-300 hover:text-white transition-colors shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
};

export const RecordingErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-red-950/40 border-b border-red-800/40 text-xs text-red-200"
    >
      <span className="flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        {message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-300 hover:text-white transition-colors shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
};
