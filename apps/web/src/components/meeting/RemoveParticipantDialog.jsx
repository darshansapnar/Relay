import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { UserX, AlertTriangle } from 'lucide-react';

export const RemoveParticipantDialog = ({
  isOpen,
  onClose,
  participant,
  onConfirm,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !participant) return null;

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(participant.identity, participant.name);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to remove participant.');
    } finally {
      setSubmitting(false);
    }
  };

  const name = participant.name || participant.identity || 'Participant';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Participant?"
      subtitle={`Are you sure you want to remove ${name} from this meeting?`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs leading-relaxed">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
          <div>
            <span className="font-semibold block text-white">Removal is Permanent</span>
            <span className="font-medium text-white">{name}</span> will be immediately disconnected
            from audio, video, and chat. They will be blocked from rejoining this meeting.
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-relay-800">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={UserX}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Removing...' : 'Remove Participant'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
