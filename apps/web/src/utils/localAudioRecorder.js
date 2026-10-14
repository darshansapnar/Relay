/**
 * Browser-local meeting audio recording: every participant's audio track is
 * mixed with the Web Audio API into a single stream, which MediaRecorder
 * encodes to audio-only WebM/Opus. The file never leaves the browser it was
 * recorded in -- there is no upload, no LiveKit Egress, and the Relay
 * backend is never involved in any of this (contrast with the participant
 * roster / host-moderation features, which do call the backend).
 *
 * Deliberately audio-only: the mixer only ever connects audio
 * MediaStreamTracks to the recording destination, and MediaRecorder is
 * constructed against that destination's audio-only MediaStream -- video is
 * never touched.
 */

export const RECORDING_MIME_TYPE = 'audio/webm;codecs=opus';

/**
 * True only when this browser can actually produce the required
 * audio-only WebM/Opus output end to end (Web Audio API + MediaRecorder +
 * that specific codec). Safari, for example, has neither
 * `createMediaStreamDestination` reliably wired to MediaRecorder nor
 * webm/opus support -- callers should gate the record control on this
 * rather than letting `start()` fail after the user has already clicked it.
 */
export function isLocalRecordingSupported() {
  if (typeof window === 'undefined') return false;
  if (
    typeof window.AudioContext === 'undefined' &&
    typeof window.webkitAudioContext === 'undefined'
  ) {
    return false;
  }
  if (typeof window.MediaRecorder === 'undefined') return false;
  if (typeof MediaRecorder.isTypeSupported !== 'function') return false;
  return MediaRecorder.isTypeSupported(RECORDING_MIME_TYPE);
}

/**
 * Mixes an arbitrary, changing set of live audio MediaStreamTracks into one
 * MediaRecorder session.
 *
 * Usage: `start()`, then call `syncTracks()` with the full, current set of
 * tracks that should be in the mix every time that set might have changed
 * (participant joined/left, track published/unpublished, muted/unmuted,
 * reconnected, ...). `syncTracks` is a full reconcile against what's
 * currently connected, not an incremental add/remove call -- this is
 * deliberate: LiveKit mutes a track in place rather than always swapping it
 * out, and a track can be replaced with a new MediaStreamTrack instance
 * after a reconnect, so diffing against the previous connected set by
 * identity (not by a remembered "connected/disconnected" flag) is what
 * actually stays correct across every one of those cases instead of only
 * the common one.
 */
export class LocalAudioMixRecorder {
  constructor() {
    this.audioContext = null;
    this.destination = null;
    this.mediaRecorder = null;
    this.chunks = [];
    /** @type {Map<string, { node: MediaStreamAudioSourceNode, mediaStreamTrack: MediaStreamTrack }>} */
    this.sources = new Map();
  }

  get isActive() {
    return Boolean(this.mediaRecorder && this.mediaRecorder.state !== 'inactive');
  }

  start() {
    if (this.isActive) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextCtor();
    this.destination = this.audioContext.createMediaStreamDestination();
    this.chunks = [];

    this.mediaRecorder = new MediaRecorder(this.destination.stream, {
      mimeType: RECORDING_MIME_TYPE,
    });
    this.mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    // Flushed every second rather than only at the end: if the tab crashes
    // or is killed mid-recording, whatever was flushed up to that point is
    // still a valid, playable WebM file instead of nothing at all.
    this.mediaRecorder.start(1000);
  }

  /**
   * @param {Array<{ key: string, mediaStreamTrack: MediaStreamTrack }>} activeTracks
   *   The complete set of audio tracks that should currently be in the mix,
   *   keyed by something stable per track (e.g. `${identity}:${trackSid}`).
   */
  syncTracks(activeTracks) {
    if (!this.audioContext || !this.destination) return;

    const activeByKey = new Map(activeTracks.map(t => [t.key, t]));

    for (const [key, entry] of this.sources) {
      const stillActive = activeByKey.get(key);
      if (!stillActive || stillActive.mediaStreamTrack !== entry.mediaStreamTrack) {
        this._disconnectSource(key, entry);
      }
    }

    for (const { key, mediaStreamTrack } of activeTracks) {
      if (this.sources.has(key) || !mediaStreamTrack) continue;
      try {
        const stream = new MediaStream([mediaStreamTrack]);
        const node = this.audioContext.createMediaStreamSource(stream);
        node.connect(this.destination);
        this.sources.set(key, { node, mediaStreamTrack });
      } catch (err) {
        // One bad track (e.g. one that ended a moment ago) must not stop
        // the rest of the mix from being correct.
        console.warn(`Failed to add audio track ${key} to the recording mix:`, err);
      }
    }
  }

  _disconnectSource(key, entry) {
    try {
      entry.node.disconnect();
    } catch {
      // Already disconnected (e.g. the underlying AudioContext was closed) -- fine.
    }
    this.sources.delete(key);
  }

  /** Stops recording and resolves with the finished audio Blob (or null if nothing was recorded). */
  stop() {
    return new Promise(resolve => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob =
          this.chunks.length > 0 ? new Blob(this.chunks, { type: RECORDING_MIME_TYPE }) : null;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  /**
   * Tears down every audio node, the MediaStream(s) they wrap, and the
   * AudioContext itself. Safe to call multiple times, and safe to call
   * whether or not `stop()` was ever called (e.g. the room disconnected
   * mid-recording) -- this is the one method that must leave nothing
   * running behind it.
   */
  cleanup() {
    for (const [key, entry] of this.sources) {
      this._disconnectSource(key, entry);
    }
    this.sources.clear();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Already stopping/stopped.
      }
    }
    this.mediaRecorder = null;
    this.chunks = [];

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.destination = null;
  }
}

/** Triggers a local file download of the given blob without navigating the page. */
export function downloadRecordingBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Deferred rather than immediate: revoking synchronously can race the
  // browser's own download handoff in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function buildRecordingFilename(roomName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeRoom = (roomName || 'meeting').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `relay-recording-${safeRoom}-${stamp}.webm`;
}
