import React, { useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
} from '@livekit/components-react';
import { MeetingHeader } from './MeetingHeader.jsx';
import { LiveParticipantGrid } from './LiveParticipantGrid.jsx';
import { LiveMeetingControls } from './LiveMeetingControls.jsx';
import { LiveParticipantsPanel } from './LiveParticipantsPanel.jsx';
import { AssistantPanel } from './AssistantPanel.jsx';
import { LeaveMeetingDialog } from './LeaveMeetingDialog.jsx';
import { Radio } from 'lucide-react';

// Inner component with access to LiveKit room context
function MeetingRoomInner({ onLeaveRoom }) {
  const room = useRoomContext();
  const participants = useParticipants();

  const [activePanel, setActivePanel] = useState(null); // 'participants' | 'assistant' | null
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const handleTogglePanel = panelName => {
    setActivePanel(prev => (prev === panelName ? null : panelName));
  };

  const handleConfirmLeave = () => {
    setShowLeaveDialog(false);
    if (room) {
      room.disconnect();
    }
    onLeaveRoom();
  };

  const handleCopyLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-relay-950 text-relay-100 overflow-hidden font-sans">
      {/* Real-time status banner */}
      <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-4 py-1 text-center text-xs text-emerald-300 flex items-center justify-center gap-2 shrink-0">
        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
        <span className="truncate">
          <strong>Live WebRTC Stream:</strong> Connected to room <strong>{room?.name}</strong>.
          Media is encrypted and routed via LiveKit SFU.
        </span>
      </div>

      {/* Header */}
      <MeetingHeader
        roomId={room?.name}
        participantCount={participants.length}
        onLeaveClick={() => setShowLeaveDialog(true)}
      />

      {/* Main Workspace (Grid + Panels) */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0 bg-relay-950/90 relative overflow-hidden">
          <LiveParticipantGrid onCopyLink={handleCopyLink} />
        </main>

        {/* Right side panels */}
        <LiveParticipantsPanel
          isOpen={activePanel === 'participants'}
          onClose={() => setActivePanel(null)}
        />

        <AssistantPanel isOpen={activePanel === 'assistant'} onClose={() => setActivePanel(null)} />
      </div>

      {/* Bottom Meeting Controls */}
      <LiveMeetingControls
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onLeaveClick={() => setShowLeaveDialog(true)}
        showMoreOptions={showMoreOptions}
        onToggleMoreOptions={setShowMoreOptions}
      />

      {/* Leave Meeting Confirmation Dialog */}
      <LeaveMeetingDialog
        isOpen={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        onConfirm={handleConfirmLeave}
      />
    </div>
  );
}

export const MeetingRoomLive = ({
  token,
  serverUrl,
  audio = true,
  video = true,
  onDisconnected,
  onError,
  onLeave,
}) => {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={audio}
      video={video}
      onDisconnected={onDisconnected}
      onError={onError}
      className="h-screen w-screen flex flex-col overflow-hidden"
    >
      {/* Background audio renderer playing all remote audio streams */}
      <RoomAudioRenderer />
      <MeetingRoomInner onLeaveRoom={onLeave} />
    </LiveKitRoom>
  );
};
