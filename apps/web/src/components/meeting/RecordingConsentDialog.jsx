import React from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Disc, ShieldAlert } from 'lucide-react';

/**
 * The consent workflow for starting a recording: the host must explicitly
 * confirm here -- starting is never a single accidental click -- and every
 * connected participant is notified the instant it actually starts (see
 * RecordingStatusBanner.jsx, broadcast peer-to-peer over LiveKit's data
 * channel the moment the mixer starts -- see MeetingRoomLive.jsx). There is
 * no way to start a recording that stays hidden from participants, and any
 * participant can withdraw consent afterwards to force it to stop.
 */
export const RecordingConsentDialog = ({ isOpen, onClose, onConfirm, starting = false, error }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Start Recording?"
    subtitle="Records audio for everyone currently in the meeting, mixed and saved locally in your browser."
    maxWidth="max-w-md"
  >
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs leading-relaxed">
        <ShieldAlert className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
        <div>
          <span className="font-semibold block text-white">Everyone will be notified</span>
          Every participant sees a recording indicator the moment it starts, and it cannot be hidden
          from them. Anyone who joins while recording is active is notified immediately on joining,
          and anyone can withdraw consent at any time to stop it.
        </div>
      </div>

      <p className="text-xs text-relay-400 leading-relaxed">
        This recording happens entirely in your browser -- audio is mixed locally and saved as a
        file to your device when you stop. Nothing is uploaded anywhere.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-relay-800">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={starting}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" icon={Disc} onClick={onConfirm} disabled={starting}>
          {starting ? 'Starting...' : 'Start Recording'}
        </Button>
      </div>
    </div>
  </Modal>
);
