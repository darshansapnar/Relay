import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { KeyRound, Info, ArrowRight, User } from 'lucide-react';

export const JoinMeetingModal = ({ isOpen, onClose, onJoinRoom, initialCode = '' }) => {
  const [meetingCode, setMeetingCode] = useState(initialCode || 'rel-product-sync');
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('relay_displayName') || 'Guest Participant'
  );

  React.useEffect(() => {
    if (isOpen && initialCode) {
      setMeetingCode(initialCode);
    }
  }, [isOpen, initialCode]);

  const handleJoin = e => {
    e.preventDefault();
    if (!meetingCode.trim()) return;
    if (displayName.trim()) {
      localStorage.setItem('relay_displayName', displayName.trim());
    }
    onJoinRoom(meetingCode.trim(), displayName.trim() || 'Guest');
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

        {/* Meeting Code Input */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">
            Meeting Code or Room ID
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-relay-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={meetingCode}
              onChange={e => setMeetingCode(e.target.value)}
              placeholder="e.g. rel-product-sync"
              required
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-400 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-mono"
            />
          </div>
        </div>

        {/* Display Name Input */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">
            Your Display Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-relay-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Sarah Connor"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-400 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        {/* Quick Suggested Rooms */}
        <div>
          <label className="block text-[11px] font-medium text-relay-400 mb-1.5">
            Sample Rooms:
          </label>
          <div className="flex flex-wrap gap-2">
            {['rel-product-sync', 'rel-team-standup', 'rel-weekly-sync'].map(room => (
              <button
                key={room}
                type="button"
                onClick={() => setMeetingCode(room)}
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
