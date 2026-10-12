import React from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { PhoneOff, AlertTriangle } from 'lucide-react';

export const LeaveMeetingDialog = ({ isOpen, onClose, onConfirm }) => {
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

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-relay-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Stay in Meeting
          </Button>
          <Button variant="danger" size="sm" icon={PhoneOff} onClick={onConfirm}>
            Leave Meeting
          </Button>
        </div>
      </div>
    </Modal>
  );
};
