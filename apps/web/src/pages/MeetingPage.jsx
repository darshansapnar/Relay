import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { requestMeetingToken } from '../api/meetingApi.js';
import { PreJoinScreen } from '../components/meeting/PreJoinScreen.jsx';
import { MeetingRoomLive } from '../components/meeting/MeetingRoomLive.jsx';

export const MeetingPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // If user came from Join/Create modal, they may have a displayName already passed in state
  const initialDisplayName =
    location.state?.displayName || localStorage.getItem('relay_displayName') || '';

  // Meeting states: 'prejoin' | 'connecting' | 'connected' | 'error'
  const [meetingState, setMeetingState] = useState('prejoin');
  const [connectionData, setConnectionData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mediaPreferences, setMediaPreferences] = useState({ audio: true, video: true });

  const handleConnect = useCallback(
    async ({ displayName, audio, video }) => {
      setMeetingState('connecting');
      setErrorMessage(null);
      setMediaPreferences({ audio, video });

      try {
        const tokenResponse = await requestMeetingToken(roomId, displayName);
        setConnectionData({
          token: tokenResponse.token,
          serverUrl: tokenResponse.url,
          audio,
          video,
        });
        setMeetingState('connected');
      } catch (err) {
        console.error('Failed to obtain LiveKit meeting token:', err);
        setErrorMessage(
          err.message ||
            'Unable to connect to the meeting. Please verify that the LiveKit server credentials are set in apps/api/.env.'
        );
        setMeetingState('error');
      }
    },
    [roomId]
  );

  // If the user entered directly with a displayName already provided in state (from modal)
  useEffect(() => {
    if (location.state?.autoJoin && location.state?.displayName && meetingState === 'prejoin') {
      handleConnect({
        displayName: location.state.displayName,
        audio: true,
        video: true,
      });
    }
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

  // If connected to LiveKit room
  if (meetingState === 'connected' && connectionData) {
    return (
      <MeetingRoomLive
        token={connectionData.token}
        serverUrl={connectionData.serverUrl}
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
