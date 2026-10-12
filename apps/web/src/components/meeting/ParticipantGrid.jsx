import React from 'react';
import { ParticipantTile } from './ParticipantTile.jsx';

export const ParticipantGrid = ({
  participants = [],
  localMuted = false,
  localVideoOff = false,
}) => {
  const count = participants.length;

  // Grid layout styles based on count
  const getGridClasses = () => {
    switch (count) {
      case 1:
        return 'grid grid-cols-1 max-w-4xl mx-auto h-full';
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 gap-4 h-full';
      case 3:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full';
      case 4:
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 gap-4 h-full';
    }
  };

  return (
    <div className="w-full h-full p-3 sm:p-5 flex flex-col justify-center overflow-hidden">
      <div className={`w-full ${getGridClasses()}`}>
        {participants.map(participant => {
          const isLocal = participant.isLocal;
          const isMuted = isLocal ? localMuted : participant.isMuted;
          const isVideoOff = isLocal ? localVideoOff : participant.isVideoOff;
          const isSpeaking = isLocal
            ? !localMuted && participant.isSpeaking
            : participant.isSpeaking;

          return (
            <div
              key={participant.id}
              className={`min-h-[200px] sm:min-h-[240px] md:min-h-[280px] h-full ${
                count === 3 && participant.id === participants[2].id
                  ? 'sm:col-span-2 lg:col-span-1 sm:max-w-md sm:mx-auto lg:max-w-none lg:mx-0 w-full'
                  : ''
              }`}
            >
              <ParticipantTile
                participant={participant}
                isLocal={isLocal}
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                isSpeaking={isSpeaking}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
