import React from 'react';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { LiveParticipantTile } from './LiveParticipantTile.jsx';
import { Users, Copy } from 'lucide-react';

export const LiveParticipantGrid = ({ onCopyLink }) => {
  // Query all camera and screen share tracks from LiveKit room.
  // Uses the hook's default room-event subscription (including TrackMuted/TrackUnmuted) so the
  // grid re-renders when a mic/camera is toggled after its initial publish, since LiveKit mutes
  // an already-published track instead of unpublishing it on subsequent toggles.
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const screenTracks = tracks.filter(t => t.source === Track.Source.ScreenShare);
  const cameraTracks = tracks.filter(t => t.source === Track.Source.Camera);

  const count = cameraTracks.length;

  const getGridClasses = () => {
    switch (count) {
      case 1:
        return 'grid grid-cols-1 max-w-4xl mx-auto h-full';
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 gap-4 h-full';
      case 3:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full';
      case 4:
        return 'grid grid-cols-1 sm:grid-cols-2 gap-4 h-full';
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full';
    }
  };

  return (
    <div className="w-full h-full p-3 sm:p-5 flex flex-col justify-center overflow-hidden relative">
      {/* If someone is sharing their screen */}
      {screenTracks.length > 0 ? (
        <div className="flex flex-col h-full gap-3 overflow-hidden">
          {/* Main Stage: Screen Share */}
          <div className="flex-1 w-full h-full min-h-[300px] rounded-2xl overflow-hidden bg-relay-900 border border-relay-700/80 shadow-2xl">
            <LiveParticipantTile trackRef={screenTracks[0]} isScreenShare={true} />
          </div>

          {/* Bottom Strip: Camera tiles */}
          <div className="h-44 sm:h-48 flex items-center gap-3 overflow-x-auto pb-1 shrink-0">
            {cameraTracks.map(trackRef => (
              <div key={trackRef.participant.identity} className="h-full w-56 sm:w-64 shrink-0">
                <LiveParticipantTile trackRef={trackRef} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Normal Camera Grid */
        <div className="w-full h-full flex flex-col justify-center">
          <div className={`w-full ${getGridClasses()}`}>
            {cameraTracks.map((trackRef, idx) => (
              <div
                key={trackRef.participant.identity}
                className={`min-h-[200px] sm:min-h-[240px] md:min-h-[280px] h-full ${
                  count === 3 && idx === 2
                    ? 'sm:col-span-2 lg:col-span-1 sm:max-w-md sm:mx-auto lg:max-w-none lg:mx-0 w-full'
                    : ''
                }`}
              >
                <LiveParticipantTile trackRef={trackRef} />
              </div>
            ))}
          </div>

          {/* Helpful banner when waiting for more participants */}
          {count === 1 && (
            <div className="mt-4 max-w-md mx-auto p-3 rounded-xl bg-relay-900/90 border border-relay-800 text-center text-xs text-relay-400 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 text-left">
                <Users className="w-4 h-4 text-brand-light shrink-0" />
                <span>You are the only person here yet.</span>
              </div>
              {onCopyLink && (
                <button
                  onClick={onCopyLink}
                  className="px-2.5 py-1 rounded-lg bg-brand/15 hover:bg-brand/25 text-brand-light border border-brand/30 text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Link</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
