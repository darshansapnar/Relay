import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { PhoneOff, AlertTriangle, Users } from 'lucide-react';
import { endMeeting } from '../../api/meetingApi.js';

export const LeaveMeetingDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isHost = false,
  token,
  roomName,
}) => {
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(null);

  const handleEndMeeting = async () => {
    setEndError(null);
    setEnding(true);
    try {
      await endMeeting(roomName, token);
      // Every participant, including this host, receives LiveKit's
      // Disconnected event shortly after the room is torn down server-side --
      // that's what actually navigates everyone away (see MeetingPage's
      // onDisconnected handling), so there's nothing further to do here.
      onClose();
    } catch (err) {
      setEndError(err.message || 'Could not end the meeting. Please try again.');
      setEnding(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave Meeting?"
      subtitle="Are you sure you want to disconnect from this conference room?"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold block text-white">Exiting Demo Room</span>
            You will leave this meeting room and return to the Relay home page. You can rejoin at
            any time using the room ID.
          </div>
        </div>

        {isHost && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs leading-relaxed">
            <Users className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <span className="font-semibold block text-white">You're the host</span>
              You can leave and let the meeting continue without you, or end it for every
              participant right now.
            </div>
          </div>
        )}

        {endError && <p className="text-xs text-red-400">{endError}</p>}

        <div className="flex flex-col gap-2 pt-3 border-t border-relay-800">
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={ending}>
              Stay in Meeting
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={PhoneOff}
              onClick={onConfirm}
              disabled={ending}
            >
              Leave Meeting
            </Button>
          </div>
          {isHost && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                icon={Users}
                onClick={handleEndMeeting}
                disabled={ending}
                className="border-red-500/40 text-red-300 hover:text-red-200 hover:border-red-500/60"
              >
                {ending ? 'Ending Meeting...' : 'End Meeting for Everyone'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
