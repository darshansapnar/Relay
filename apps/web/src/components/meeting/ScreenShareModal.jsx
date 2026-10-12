import React from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Info, MonitorPlay } from 'lucide-react';

export const ScreenShareModal = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Screen Share Demo"
      subtitle="WebRTC display capture preview"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-brand/10 border border-brand/20 text-brand-light text-xs leading-relaxed">
          <Info className="w-5 h-5 shrink-0 text-brand-light mt-0.5" />
          <div>
            <span className="font-semibold block text-white">Client-Side UI Demo</span>
            Screen sharing media stream capture via browser APIs (
            <code className="text-white">getDisplayMedia</code>) is planned for an upcoming phase.
            For this phase, no real screen media is being broadcast or transmitted.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-relay-800/80 border border-relay-700/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-relay-750 mx-auto flex items-center justify-center text-brand-light">
            <MonitorPlay className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-semibold text-white">Display Capture Staged</h4>
          <p className="text-[11px] text-relay-400">
            Permissions dialog and stream canvas will be wired to the video pipeline in future
            milestones.
          </p>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-relay-800">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Demo Notice
          </Button>
        </div>
      </div>
    </Modal>
  );
};
