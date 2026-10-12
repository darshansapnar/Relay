import React, { useEffect, useRef } from 'react';
import { Settings, Keyboard, Info, AlertCircle, Sparkles } from 'lucide-react';

export const MoreOptionsMenu = ({ isOpen, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-16 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-64 bg-relay-900 border border-relay-700/80 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-2 text-[11px] font-semibold text-relay-400 uppercase tracking-wider border-b border-relay-800">
        Meeting Options
      </div>

      <div className="py-1">
        <button
          onClick={() => {
            alert('Audio & Video settings configuration will be available in future phases.');
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-relay-300 hover:text-white hover:bg-relay-800 transition-colors text-left"
        >
          <Settings className="w-4 h-4 text-relay-400" />
          <span>Device Settings (Demo)</span>
        </button>

        <button
          onClick={() => {
            alert(
              'Keyboard Shortcuts:\n• M: Toggle Microphone\n• V: Toggle Camera\n• P: Toggle Participants\n• A: Toggle Assistant'
            );
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-relay-300 hover:text-white hover:bg-relay-800 transition-colors text-left"
        >
          <Keyboard className="w-4 h-4 text-relay-400" />
          <span>Keyboard Shortcuts</span>
        </button>

        <button
          onClick={() => {
            alert(
              'Relay Client UI Demo • Phase 2\nFrontend: React + Vite\nArchitecture: npm workspaces'
            );
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-relay-300 hover:text-white hover:bg-relay-800 transition-colors text-left"
        >
          <Info className="w-4 h-4 text-relay-400" />
          <span>Meeting Details</span>
        </button>

        <button
          onClick={() => {
            alert('AI Assistant settings will be configurable in Phase 3.');
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-relay-300 hover:text-white hover:bg-relay-800 transition-colors text-left"
        >
          <Sparkles className="w-4 h-4 text-ai-accent" />
          <span>AI Summarization Rules</span>
        </button>
      </div>

      <div className="pt-1 border-t border-relay-800">
        <button
          onClick={() => {
            alert('Thank you! Feedback reported to the development team.');
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-relay-400 hover:text-white hover:bg-relay-800 transition-colors text-left"
        >
          <AlertCircle className="w-4 h-4 text-relay-500" />
          <span>Report an Issue</span>
        </button>
      </div>
    </div>
  );
};
