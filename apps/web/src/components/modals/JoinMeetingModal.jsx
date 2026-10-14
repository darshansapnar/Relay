import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { KeyRound, Info, ArrowRight, User, AlertCircle } from 'lucide-react';

export const JoinMeetingModal = ({ isOpen, onClose, onJoinRoom, initialCode = '' }) => {
  const [meetingCode, setMeetingCode] = useState(initialCode || '');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  // Reset fields to empty when dialog opens (or sync initialCode if provided from quick join)
  useEffect(() => {
    if (isOpen) {
      setMeetingCode(initialCode || '');
      setDisplayName('');
      setError('');
    }
  }, [isOpen, initialCode]);

  const handleJoin = e => {
    e.preventDefault();
    const trimmedCode = meetingCode.trim();
    const trimmedName = displayName.trim();

    if (!trimmedCode && !trimmedName) {
      setError('Please enter a meeting code and your display name.');
      return;
    }
    if (!trimmedCode) {
      setError('Please enter a meeting code or room ID.');
      return;
    }
    if (!trimmedName) {
      setError('Please enter your display name.');
      return;
    }

    setError('');
    localStorage.setItem('relay_displayName', trimmedName);
    onJoinRoom(trimmedCode, trimmedName);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join Meeting Room"
      subtitle="Enter a Relay meeting room code to connect via LiveKit"
    >
      <form onSubmit={handleJoin} className="space-y-4">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-relay-800 border border-relay-700 text-relay-300 text-xs leading-relaxed">
          <Info className="w-5 h-5 shrink-0 text-brand-light mt-0.5" />
          <div>
            <span className="font-semibold block text-white">Real-Time WebRTC Connection</span>
            Connects to the LiveKit video room. Both audio and video streams are transmitted to
            other connected participants.
          </div>
        </div>

        {/* Validation Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/70 text-red-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Meeting Code Input */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">
            Meeting Code or Room ID <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-relay-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={meetingCode}
              onChange={e => {
                setMeetingCode(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter meeting code or room ID"
              required
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-500 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-mono"
            />
          </div>
        </div>

        {/* Display Name Input */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">
            Your Display Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-relay-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              required
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter your name"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-500 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        {/* Quick Suggested Rooms (Optional shortcuts that fill only the meeting code field) */}
        <div>
          <label className="block text-[11px] font-medium text-relay-400 mb-1.5">
            Sample Rooms:
          </label>
          <div className="flex flex-wrap gap-2">
            {['rel-product-sync', 'rel-team-standup', 'rel-weekly-sync'].map(room => (
              <button
                key={room}
                type="button"
                onClick={() => {
                  setMeetingCode(room);
                  if (error) setError('');
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                  meetingCode === room
                    ? 'bg-brand/20 border-brand text-brand-light'
                    : 'bg-relay-800/80 border-relay-700 text-relay-300 hover:border-relay-600 hover:text-white'
                }`}
              >
                {room}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-relay-800">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" icon={ArrowRight} iconPosition="right">
            Join Meeting Room
          </Button>
        </div>
      </form>
    </Modal>
  );
};
