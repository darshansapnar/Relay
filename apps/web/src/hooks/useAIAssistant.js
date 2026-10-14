import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { RoomEvent } from 'livekit-client';
import { AI_EVENTS, AI_STATUS } from '@relay/shared';
import { getAIState, toggleAIState, triggerSummary } from '../api/aiApi.js';
import { AIAudioPipeline } from '../utils/aiAudioCapture.js';

/**
 * Custom React hook managing real-time AI Meeting Assistant state, transcripts, summaries, and audio capture.
 */
export const useAIAssistant = ({
  token,
  roomName,
  _isHost = false,
  _localParticipant = null,
  _participants = [],
  room = null,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState(AI_STATUS.IDLE);
  const [summaryStatus, setSummaryStatus] = useState(AI_STATUS.IDLE);
  const [pauseReason, setPauseReason] = useState(null);
  const [transcriptionPauseReason, setTranscriptionPauseReason] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [latestSummary, setLatestSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [audioStreamingActive, setAudioStreamingActive] = useState(false);

  const socketRef = useRef(null);
  const audioPipelineRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!token || !roomName) return;

    const socketUrl = import.meta.env.DEV
      ? '/'
      : import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
        : '/';
    const socket = io(socketUrl, {
      auth: { token, roomName },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    const deduplicateTranscripts = (items = []) => {
      const seen = new Set();
      const result = [];
      for (const t of items) {
        if (!t || !t.id) continue;
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        result.push(t);
      }
      return result;
    };

    // Fetch initial state via REST
    getAIState(roomName, token)
      .then(state => {
        if (!state) return;
        setIsActive(Boolean(state.isActive));
        setConsentGranted(Boolean(state.consentGranted));
        setTranscriptionStatus(state.transcriptionStatus || AI_STATUS.IDLE);
        setSummaryStatus(state.summaryStatus || AI_STATUS.IDLE);
        setPauseReason(state.pauseReason || null);
        setTranscriptionPauseReason(state.transcriptionPauseReason || null);
        if (state.createdAt && audioPipelineRef.current) {
          audioPipelineRef.current.setMeetingStartTime(new Date(state.createdAt).getTime());
        }
        if (state.latestSummary) {
          setLatestSummary(state.latestSummary);
        }
        if (Array.isArray(state.transcripts)) {
          setTranscripts(deduplicateTranscripts(state.transcripts));
        }
      })
      .catch(err => {
        console.warn('[Relay AI] Initial state load notice:', err.message);
      });

    // Handle real-time status updates
    socket.on(AI_EVENTS.STATUS_UPDATE, data => {
      if (data.isActive !== undefined) setIsActive(Boolean(data.isActive));
      if (data.consentGranted !== undefined) setConsentGranted(Boolean(data.consentGranted));
      if (data.transcriptionStatus) setTranscriptionStatus(data.transcriptionStatus);
      if (data.summaryStatus) {
        setSummaryStatus(data.summaryStatus);
        setIsGeneratingSummary(data.summaryStatus === AI_STATUS.SUMMARIZING);
      }
      if (data.pauseReason !== undefined) setPauseReason(data.pauseReason);
      if (data.transcriptionPauseReason !== undefined)
        setTranscriptionPauseReason(data.transcriptionPauseReason);
      if (data.createdAt && audioPipelineRef.current) {
        audioPipelineRef.current.setMeetingStartTime(new Date(data.createdAt).getTime());
      }
      if (data.latestSummary) setLatestSummary(data.latestSummary);
      if (Array.isArray(data.transcripts)) setTranscripts(deduplicateTranscripts(data.transcripts));
    });

    // Handle new incoming transcript segments with robust deduplication
    socket.on(AI_EVENTS.TRANSCRIPT_CHUNK, segment => {
      if (!segment || !segment.text) return;
      setTranscripts(prev => {
        if (segment.id && prev.some(t => t.id === segment.id)) {
          return prev;
        }
        // Deduplicate repeated or overlapping chunk submissions from same speaker
        const isDuplicateText = prev.some(
          t =>
            t.speakerIdentity === segment.speakerIdentity &&
            t.text.trim().toLowerCase() === segment.text.trim().toLowerCase() &&
            Math.abs((t.startTimeMs || 0) - (segment.startTimeMs || 0)) < 10000
        );
        if (isDuplicateText) {
          return prev;
        }
        return [...prev, segment];
      });
    });

    // Handle new summary updates
    socket.on(AI_EVENTS.SUMMARY_UPDATE, summary => {
      setLatestSummary(summary);
      setIsGeneratingSummary(false);
      setSummaryStatus(AI_STATUS.IDLE);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, roomName]);

  // Audio capture pipeline initialization
  useEffect(() => {
    if (!roomName) return;

    const pipeline = new AIAudioPipeline({
      getSocket: () => socketRef.current,
      roomName,
      meetingStartTime: Date.now(),
      onSegmentSent: () => {
        setAudioStreamingActive(true);
      },
    });

    audioPipelineRef.current = pipeline;

    return () => {
      pipeline.stop();
    };
  }, [roomName]);

  // Synchronize audio tracks using explicit LiveKit Room events
  useEffect(() => {
    const pipeline = audioPipelineRef.current;
    if (!pipeline || !room) return;

    const syncTracks = () => {
      if (!isActive || !consentGranted) {
        pipeline.stop();
        setAudioStreamingActive(false);
        return;
      }

      pipeline.start();

      const activeTracks = [];
      const allParticipants = [room.localParticipant, ...room.remoteParticipants.values()].filter(
        Boolean
      );

      const seenSpeakers = new Set();

      for (const participant of allParticipants) {
        if (!participant.audioTrackPublications || seenSpeakers.has(participant.identity)) continue;
        for (const publication of participant.audioTrackPublications.values()) {
          if (
            publication.track?.mediaStreamTrack &&
            publication.track.mediaStreamTrack.readyState === 'live' &&
            !publication.isMuted
          ) {
            const speakerName =
              participant.name?.trim() ||
              (participant.identity && !participant.identity.startsWith('user_')
                ? participant.identity
                : 'Unknown speaker');

            activeTracks.push({
              key: participant.identity,
              speakerIdentity: participant.identity,
              speakerName,
              mediaStreamTrack: publication.track.mediaStreamTrack,
            });
            seenSpeakers.add(participant.identity);
            break; // Exactly one audio track per speaker
          }
        }
      }

      pipeline.syncTracks(activeTracks);
    };

    // Run initial sync
    syncTracks();

    // Listen to RoomEvent occurrences so mute/unmute and track additions are caught dynamically
    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ];

    events.forEach(evt => room.on(evt, syncTracks));

    return () => {
      events.forEach(evt => room.off(evt, syncTracks));
    };
  }, [isActive, consentGranted, room]);

  /**
   * Toggles AI assistant activation state.
   */
  const handleToggleAI = useCallback(
    async newConsentGranted => {
      if (!token || !roomName) {
        throw new Error('Meeting connection not initialized. Please wait for room connection.');
      }
      const targetActive = !isActive;
      const targetConsent = targetActive ? Boolean(newConsentGranted || consentGranted) : false;

      try {
        const result = await toggleAIState(roomName, token, {
          isActive: targetActive,
          consentGranted: targetConsent,
        });

        setIsActive(Boolean(result.isActive));
        setConsentGranted(Boolean(result.consentGranted));
        setTranscriptionStatus(result.transcriptionStatus || AI_STATUS.IDLE);
        setSummaryStatus(result.summaryStatus || AI_STATUS.IDLE);
        return result;
      } catch (err) {
        console.error('[Relay AI] Toggle failed:', err.message);
        throw err;
      }
    },
    [token, roomName, isActive, consentGranted]
  );

  /**
   * Requests immediate summary generation.
   */
  const handleTriggerSummary = useCallback(async () => {
    if (!token || !roomName || isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    try {
      await triggerSummary(roomName, token);
    } catch (err) {
      console.warn('[Relay AI] Manual summary trigger warning:', err.message);
      setIsGeneratingSummary(false);
    }
  }, [token, roomName, isGeneratingSummary]);

  return {
    isActive,
    consentGranted,
    transcriptionStatus,
    summaryStatus,
    pauseReason,
    transcriptionPauseReason,
    transcripts,
    latestSummary,
    isGeneratingSummary,
    audioStreamingActive,
    toggleAI: handleToggleAI,
    triggerSummary: handleTriggerSummary,
  };
};
