import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Sparkles, Shield, Info, ArrowRight, User, KeyRound, AlertCircle, Users } from 'lucide-react';

export const CreateMeetingModal = ({ isOpen, onClose, onCreateRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [enableAssistant, setEnableAssistant] = useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [error, setError] = useState('');

  // Reset all fields to empty when dialog opens
  useEffect(() => {
    if (isOpen) {
      setRoomId('');
      setDisplayName('');
      setMeetingTitle('');
      setWaitingRoomEnabled(false);
      setError('');
    }
  }, [isOpen]);

  const handleCreate = e => {
    e.preventDefault();
    const trimmedRoom = roomId.trim();
    const trimmedName = displayName.trim();

    if (!trimmedRoom && !trimmedName) {
      setError('Please enter a room ID and your display name.');
      return;
    }
    if (!trimmedRoom) {
      setError('Please enter a meeting code or room ID.');
      return;
    }
    if (!trimmedName) {
      setError('Please enter your display name.');
      return;
    }

    setError('');
    localStorage.setItem('relay_displayName', trimmedName);
    onCreateRoom(trimmedRoom, trimmedName, { waitingRoomEnabled });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Meeting Room"
      subtitle="Launch an encrypted real-time video conference"
    >
      <form onSubmit={handleCreate} className="space-y-4">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-brand/10 border border-brand/20 text-brand-light text-xs leading-relaxed">
          <Info className="w-5 h-5 shrink-0 text-brand-light mt-0.5" />
          <div>
            <span className="font-semibold block text-white">LiveKit Real-Time WebRTC</span>
            Connects audio and video through LiveKit Cloud. Anyone with this Room ID can join from
            another browser window.
          </div>
        </div>

        {/* Validation Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/70 text-red-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Meeting Code / Room ID Input */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">
            Meeting Code / Room ID <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-relay-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              required
              value={roomId}
              onChange={e => {
                setRoomId(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter room ID (e.g. sprint-review)"
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

        {/* Meeting Title Input (Optional) */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">
            Meeting Subject <span className="text-relay-500 text-[11px]">(optional)</span>
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={e => setMeetingTitle(e.target.value)}
            placeholder="e.g. Architecture Review"
            className="w-full px-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-500 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        {/* Feature toggles */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between p-3 rounded-lg bg-relay-800/60 border border-relay-700/60">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-ai-accent" />
              <div>
                <div className="text-xs font-medium text-white">AI Assistant Copilot</div>
                <div className="text-[11px] text-relay-400">
                  Ready for live synthesis and structured summaries
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableAssistant}
              onChange={e => setEnableAssistant(e.target.checked)}
              className="rounded bg-relay-700 border-relay-600 text-brand focus:ring-brand h-4 w-4"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-relay-800/60 border border-relay-700/60">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-brand-light" />
              <div>
                <div className="text-xs font-medium text-white">Enable Waiting Room</div>
                <div className="text-[11px] text-relay-400">
                  Participants must wait for host approval before entering
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              id="enable-waiting-room"
              checked={waitingRoomEnabled}
              onChange={e => setWaitingRoomEnabled(e.target.checked)}
              className="rounded bg-relay-700 border-relay-600 text-brand focus:ring-brand h-4 w-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-relay-800/60 border border-relay-700/60">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-xs font-medium text-white">LiveKit SFU Encryption</div>
                <div className="text-[11px] text-relay-400">WebRTC media stream encryption</div>
              </div>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Active</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-relay-800">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" icon={ArrowRight} iconPosition="right">
            Create & Enter Room
          </Button>
        </div>
      </form>
    </Modal>
  );
};
