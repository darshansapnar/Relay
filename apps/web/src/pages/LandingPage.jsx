import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar.jsx';
import { HeroSection } from '../components/sections/HeroSection.jsx';
import { MeetingPreview } from '../components/sections/MeetingPreview.jsx';
import { FeaturesSection } from '../components/sections/FeaturesSection.jsx';
import { BackendHealthSection } from '../components/sections/BackendHealthSection.jsx';
import { ArchitectureSection } from '../components/sections/ArchitectureSection.jsx';
import { Footer } from '../components/layout/Footer.jsx';
import { CreateMeetingModal } from '../components/modals/CreateMeetingModal.jsx';
import { JoinMeetingModal } from '../components/modals/JoinMeetingModal.jsx';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const handleCreateRoom = (roomId, displayName) => {
    setCreateModalOpen(false);
    navigate(`/meeting/${roomId}`, { state: { displayName, autoJoin: true } });
  };

  const handleJoinRoom = (roomId, displayName) => {
    setJoinModalOpen(false);
    navigate(`/meeting/${roomId}`, { state: { displayName, autoJoin: true } });
  };

  return (
    <div className="min-h-screen bg-relay-950 text-relay-100 flex flex-col">
      <Navbar
        onCreateMeeting={() => setCreateModalOpen(true)}
        onJoinMeeting={() => setJoinModalOpen(true)}
      />

      <main className="flex-1">
        <HeroSection
          onCreateMeeting={() => setCreateModalOpen(true)}
          onJoinMeeting={() => setJoinModalOpen(true)}
        />
        <MeetingPreview />
        <FeaturesSection />
        <BackendHealthSection />
        <ArchitectureSection />
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
        onClose={() => setJoinModalOpen(false)}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
};
