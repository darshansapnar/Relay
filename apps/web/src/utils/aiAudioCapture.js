import { AI_EVENTS } from '@relay/shared';

const CHUNK_INTERVAL_MS = 6000; // 6-second bounded audio slices

/**
 * Pipeline to capture and stream per-speaker audio chunks from LiveKit tracks to the backend.
 * Captures audio with strict single-recorder deduplication per speaker identity and reliable speaker attribution.
 * Generates standalone, self-contained WebM containers with accurate elapsed meeting timestamps.
 */
export class AIAudioPipeline {
  constructor({ socket, getSocket, roomName, meetingStartTime, onSegmentSent }) {
    this.getSocket = getSocket || (() => socket);
    this.roomName = roomName;
    this.meetingStartTime = meetingStartTime || Date.now();
    this.onSegmentSent = onSegmentSent;
    this.isActive = false;
    /** @type {Map<string, { recorder: MediaRecorder|null, stream: MediaStream, speakerIdentity: string, speakerName: string, startTime: number, isDestroyed: boolean, sliceTimeout: any }>} */
    this.recorders = new Map();
  }

  /**
   * Sets or updates the meeting start epoch for elapsed offset calculations.
   *
   * @param {number} epochMs
   */
  setMeetingStartTime(epochMs) {
    if (epochMs && typeof epochMs === 'number' && epochMs > 0) {
      this.meetingStartTime = epochMs;
    }
  }

  /**
   * Starts the audio capture pipeline.
   */
  start() {
    this.isActive = true;
  }

  /**
   * Stops all active track recorders and cleans up media streams.
   */
  stop() {
    this.isActive = false;
    for (const [, entry] of this.recorders) {
      entry.isDestroyed = true;
      if (entry.sliceTimeout) {
        clearTimeout(entry.sliceTimeout);
        entry.sliceTimeout = null;
      }
      try {
        if (entry.recorder && entry.recorder.state !== 'inactive') {
          entry.recorder.stop();
        }
      } catch {
        // Ignore stop errors on teardown
      }
    }
    this.recorders.clear();
  }

  /**
   * Synchronizes audio tracks being captured with the current meeting participant tracks.
   * Ensures strictly ONE active recorder per speaker to prevent duplicate chunk emission.
   *
   * @param {Array<{ key: string, speakerIdentity: string, speakerName: string, mediaStreamTrack: MediaStreamTrack }>} activeTracks
   */
  syncTracks(activeTracks = []) {
    if (!this.isActive) return;
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return;

    // Deduplicate activeTracks strictly by speakerIdentity
    const uniqueTracksBySpeaker = new Map();
    for (const track of activeTracks) {
      if (!track.speakerIdentity) continue;
      if (!uniqueTracksBySpeaker.has(track.speakerIdentity)) {
        uniqueTracksBySpeaker.set(track.speakerIdentity, track);
      }
    }

    const currentSpeakers = new Set(uniqueTracksBySpeaker.keys());

    // 1. Remove recorders for speakers that are no longer active
    for (const [speakerId, entry] of this.recorders) {
      if (!currentSpeakers.has(speakerId)) {
        entry.isDestroyed = true;
        if (entry.sliceTimeout) {
          clearTimeout(entry.sliceTimeout);
          entry.sliceTimeout = null;
        }
        try {
          if (entry.recorder && entry.recorder.state !== 'inactive') {
            entry.recorder.stop();
          }
        } catch {
          // Ignore
        }
        this.recorders.delete(speakerId);
      }
    }

    // 2. Add recorders for newly active speakers (strictly one per speaker)
    for (const [speakerId, trackInfo] of uniqueTracksBySpeaker) {
      if (this.recorders.has(speakerId)) continue;
      if (!trackInfo.mediaStreamTrack || trackInfo.mediaStreamTrack.readyState !== 'live') continue;

      try {
        const stream = new MediaStream([trackInfo.mediaStreamTrack]);
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const entry = {
          recorder: null,
          stream,
          speakerIdentity: trackInfo.speakerIdentity,
          speakerName: trackInfo.speakerName || 'Unknown speaker',
          startTime: Date.now(),
          isDestroyed: false,
          sliceTimeout: null,
        };

        const recordNextSlice = () => {
          if (!this.isActive || entry.isDestroyed) return;

          try {
            const recorder = new MediaRecorder(stream, { mimeType });
            entry.recorder = recorder;
            entry.startTime = Date.now();
            const chunks = [];

            recorder.ondataavailable = event => {
              if (event.data && event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            recorder.onstop = async () => {
              if (!this.isActive || entry.isDestroyed) return;

              // Immediately kick off the next slice so audio recording is seamless without gaps
              recordNextSlice();

              if (chunks.length === 0) return;

              const blob = new Blob(chunks, { type: mimeType });
              if (blob.size < 1000) {
                // Audio is silent/empty
                return;
              }

              const sliceEndTime = Date.now();
              const sliceStartTime = entry.startTime;

              // Compute clean elapsed meeting milliseconds
              const startTimeMs = Math.max(0, sliceStartTime - this.meetingStartTime);
              const endTimeMs = Math.max(startTimeMs + 100, sliceEndTime - this.meetingStartTime);
              const segmentId = `${entry.speakerIdentity}:${Math.round(startTimeMs)}:${Math.round(endTimeMs)}`;

              try {
                const buffer = await blob.arrayBuffer();
                const currentSocket = this.getSocket();
                if (currentSocket && currentSocket.connected) {
                  currentSocket.emit(AI_EVENTS.AUDIO_CHUNK, {
                    id: segmentId,
                    segmentId,
                    audio: buffer,
                    speakerIdentity: entry.speakerIdentity,
                    speakerName: entry.speakerName,
                    startTimeMs,
                    endTimeMs,
                  });

                  if (typeof this.onSegmentSent === 'function') {
                    this.onSegmentSent({
                      speakerIdentity: entry.speakerIdentity,
                      speakerName: entry.speakerName,
                      size: buffer.byteLength,
                    });
                  }
                }
              } catch (err) {
                console.warn('[Relay AI Audio] Error streaming audio chunk:', err.message);
              }
            };

            recorder.start();

            entry.sliceTimeout = setTimeout(() => {
              if (recorder.state === 'recording') {
                recorder.stop();
              }
            }, CHUNK_INTERVAL_MS);
          } catch (recErr) {
            console.warn(
              `[Relay AI Audio] Error creating MediaRecorder for speaker ${trackInfo.speakerName}:`,
              recErr.message
            );
          }
        };

        recordNextSlice();
        this.recorders.set(speakerId, entry);
      } catch (err) {
        console.warn(
          `[Relay AI Audio] Could not start MediaRecorder for speaker ${trackInfo.speakerName}:`,
          err.message
        );
      }
    }
  }
}
