import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Sparkles, Shield, Info, ArrowRight, User } from 'lucide-react';

export const CreateMeetingModal = ({ isOpen, onClose, onCreateRoom }) => {
  const [meetingTitle, setMeetingTitle] = useState('Sprint Architecture Review');
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('relay_displayName') || 'Alex Rivers'
  );
  const [enableAssistant, setEnableAssistant] = useState(true);
  const [demoRoomId] = useState(() => `rel-room-${Math.floor(1000 + Math.random() * 9000)}`);

  const handleCreate = e => {
    e.preventDefault();
    if (displayName.trim()) {
      localStorage.setItem('relay_displayName', displayName.trim());
    }
    onCreateRoom(demoRoomId, displayName.trim() || 'Host User');
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
              placeholder="e.g. Alex Rivers"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-400 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        {/* Meeting Title Input */}
        <div>
          <label className="block text-xs font-medium text-relay-300 mb-1.5">Meeting Subject</label>
          <input
            type="text"
            value={meetingTitle}
            onChange={e => setMeetingTitle(e.target.value)}
            placeholder="e.g. Weekly Executive Review"
            className="w-full px-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-400 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            required
          />
        </div>

        {/* Generated Room ID pill */}
        <div className="p-3 rounded-lg bg-relay-800/80 border border-relay-700/80 flex items-center justify-between text-xs">
          <span className="text-relay-400">Room Identifier:</span>
          <span className="font-mono text-brand-light font-semibold bg-brand/15 px-2 py-0.5 rounded border border-brand/30">
            {demoRoomId}
          </span>
        </div>

        {/* Feature toggles */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between p-3 rounded-lg bg-relay-800/60 border border-relay-700/60">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-ai-accent" />
              <div>
                <div className="text-xs font-medium text-white">AI Assistant Copilot</div>
                <div className="text-[11px] text-relay-400">
                  Ready for live synthesis in Phase 4
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
