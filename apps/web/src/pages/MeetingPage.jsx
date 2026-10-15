import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { requestMeetingToken } from '../api/meetingApi.js';
import { PreJoinScreen } from '../components/meeting/PreJoinScreen.jsx';
import { MeetingRoomLive } from '../components/meeting/MeetingRoomLive.jsx';
import { WaitingRoomScreen } from '../components/meeting/WaitingRoomScreen.jsx';

export const MeetingPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // If user came from Join/Create modal, they may have a displayName already passed in state
  const initialDisplayName =
    location.state?.displayName || localStorage.getItem('relay_displayName') || '';

  // Meeting states: 'prejoin' | 'connecting' | 'connected' | 'waiting' | 'error'
  const [meetingState, setMeetingState] = useState('prejoin');
  const [connectionData, setConnectionData] = useState(null);
  const [waitingData, setWaitingData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mediaPreferences, setMediaPreferences] = useState({ audio: true, video: true });

  const handleConnect = useCallback(
    async ({ displayName, audio, video }) => {
      setMeetingState('connecting');
      setErrorMessage(null);
      setMediaPreferences({ audio, video });

      try {
        const reqOptions = {};
        if (location.state?.waitingRoomEnabled) reqOptions.waitingRoomEnabled = true;
        if (waitingData?.participantIdentity) reqOptions.participantIdentity = waitingData.participantIdentity;

        const tokenResponse =
          Object.keys(reqOptions).length > 0
            ? await requestMeetingToken(roomId, displayName, reqOptions)
            : await requestMeetingToken(roomId, displayName);

        if (tokenResponse.waiting) {
          setWaitingData({
            roomName: tokenResponse.roomName,
            participantIdentity: tokenResponse.participantIdentity,
            participantName: tokenResponse.participantName || displayName,
          });
          setMeetingState('waiting');
          return;
        }

        setConnectionData({
          token: tokenResponse.token,
          serverUrl: tokenResponse.url,
          roomName: tokenResponse.roomName,
          participantIdentity: tokenResponse.participantIdentity,
          isHost: tokenResponse.isHost,
          audio,
          video,
        });
        setMeetingState('connected');
      } catch (err) {
        console.error('Failed to obtain LiveKit meeting token:', err);
        const code = err.details?.error?.code || '';
        let msg = err.message || 'Unable to connect to the meeting.';
        if (err.statusCode === 423 || code === 'MEETING_LOCKED') {
          msg = 'This meeting is locked by the host. Additional participants cannot enter.';
        } else if (err.statusCode === 403 && (code === 'REMOVED_FROM_MEETING' || msg.includes('removed'))) {
          msg = 'You were removed from this meeting by the host and cannot rejoin.';
        }
        setErrorMessage(msg);
        setMeetingState('error');
      }
    },
    [roomId, location.state?.waitingRoomEnabled, waitingData?.participantIdentity]
  );

  // If the user entered directly with a displayName already provided in state (from modal).
  // Guarded with a ref so this only ever calls handleConnect once per page
  // visit. Without it, React.StrictMode (apps/web/src/main.jsx) double-
  // invokes this effect in development -- both invocations see the same
  // 'prejoin' state (the setMeetingState('connecting') from the first call
  // hasn't committed yet when the second fires), so two separate
  // /api/meetings/token requests go out for the same "Create Meeting" join.
  // Each gets its own participantIdentity and can independently race to
  // claim host (see apps/api/.../meeting.controller.js); whichever token
  // response the UI ends up using isn't guaranteed to be the one whose
  // identity actually won that race, producing a token that *claims* host
  // (attributes.role) while the backend's authorizeHostRequest() -- keyed
  // off the room's own recorded host identity -- correctly rejects it.
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    if (
      hasAutoJoinedRef.current ||
      !location.state?.autoJoin ||
      !location.state?.displayName ||
      meetingState !== 'prejoin'
    ) {
      return;
    }
    hasAutoJoinedRef.current = true;
    handleConnect({
      displayName: location.state.displayName,
      audio: true,
      video: true,
    });
  }, [location.state, meetingState, handleConnect]);

  const handleDisconnected = () => {
    navigate('/');
  };

  const handleRoomError = err => {
    console.error('LiveKit Room error:', err);
    setErrorMessage(err?.message || 'A WebRTC connection error occurred.');
    setMeetingState('error');
  };

  const handleLeave = () => {
    navigate('/');
  };

  // If in waiting room awaiting host admission
  if (meetingState === 'waiting' && waitingData) {
    return (
      <WaitingRoomScreen
        roomName={waitingData.roomName}
        participantName={waitingData.participantName}
        participantIdentity={waitingData.participantIdentity}
        onApproved={() => {
          handleConnect({
            displayName: waitingData.participantName,
            ...mediaPreferences,
          });
        }}
        onLeave={() => navigate('/')}
      />
    );
  }

  // If connected to LiveKit room
  if (meetingState === 'connected' && connectionData) {
    return (
      <MeetingRoomLive
        token={connectionData.token}
        serverUrl={connectionData.serverUrl}
        roomName={connectionData.roomName}
        participantIdentity={connectionData.participantIdentity}
        isHost={connectionData.isHost}
        audio={mediaPreferences.audio}
        video={mediaPreferences.video}
        onDisconnected={handleDisconnected}
        onError={handleRoomError}
        onLeave={handleLeave}
      />
    );
  }

  // Pre-join screen (or error / connecting state)
  return (
    <PreJoinScreen
      roomId={roomId}
      initialName={initialDisplayName}
      onJoin={handleConnect}
      onCancel={() => navigate('/')}
      loading={meetingState === 'connecting'}
      error={errorMessage}
      onRetry={() => {
        const name = localStorage.getItem('relay_displayName') || initialDisplayName || 'Guest';
        handleConnect({ displayName: name, ...mediaPreferences });
      }}
    />
  );
};
