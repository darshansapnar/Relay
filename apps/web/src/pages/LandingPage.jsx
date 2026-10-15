import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar.jsx';
import { HeroSection } from '../components/sections/HeroSection.jsx';
import { MeetingPreview } from '../components/sections/MeetingPreview.jsx';
import { FeaturesSection } from '../components/sections/FeaturesSection.jsx';
import { SystemDiagnosticsSection } from '../components/sections/SystemDiagnosticsSection.jsx';
import { Footer } from '../components/layout/Footer.jsx';
import { CreateMeetingModal } from '../components/modals/CreateMeetingModal.jsx';
import { JoinMeetingModal } from '../components/modals/JoinMeetingModal.jsx';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [prefilledJoinCode, setPrefilledJoinCode] = useState('');

  const handleCreateRoom = (roomId, displayName, options = {}) => {
    setCreateModalOpen(false);
    navigate(`/meeting/${roomId}`, {
      state: {
        displayName,
        autoJoin: true,
        waitingRoomEnabled: Boolean(options.waitingRoomEnabled),
      },
    });
  };

  const handleJoinRoom = (roomId, displayName) => {
    setJoinModalOpen(false);
    navigate(`/meeting/${roomId}`, { state: { displayName, autoJoin: true } });
  };

  const handleJoinWithCode = code => {
    setPrefilledJoinCode(code);
    setJoinModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-relay-950 text-relay-100 flex flex-col selection:bg-brand/30 selection:text-white">
      <Navbar
        onCreateMeeting={() => setCreateModalOpen(true)}
        onJoinMeeting={() => {
          setPrefilledJoinCode('');
          setJoinModalOpen(true);
        }}
      />

      <main className="flex-1">
        <HeroSection
          onCreateMeeting={() => setCreateModalOpen(true)}
          onJoinMeeting={() => {
            setPrefilledJoinCode('');
            setJoinModalOpen(true);
          }}
          onJoinWithCode={handleJoinWithCode}
        />
        <MeetingPreview />
        <FeaturesSection />
        <SystemDiagnosticsSection />
      </main>

      <Footer />

      {/* Modals for Create and Join LiveKit Room */}
      <CreateMeetingModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreateRoom={handleCreateRoom}
      />
      <JoinMeetingModal
        isOpen={joinModalOpen}
        initialCode={prefilledJoinCode}
        onClose={() => setJoinModalOpen(false)}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
};
