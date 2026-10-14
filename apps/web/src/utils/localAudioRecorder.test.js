// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECORDING_MIME_TYPE,
  isLocalRecordingSupported,
  LocalAudioMixRecorder,
  downloadRecordingBlob,
  buildRecordingFilename,
} from './localAudioRecorder.js';

class FakeMediaStreamTrack {
  constructor(id) {
    this.id = id;
  }
}

class FakeMediaStream {
  constructor(tracks = []) {
    this.tracks = tracks;
  }
}

class FakeAudioNode {
  constructor() {
    this.connected = false;
    this.disconnected = false;
  }
  connect() {
    this.connected = true;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
  }
  createMediaStreamDestination() {
    return { stream: new FakeMediaStream([]) };
  }
  createMediaStreamSource(stream) {
    const node = new FakeAudioNode();
    node.sourceStream = stream;
    return node;
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

class FakeMediaRecorder {
  constructor(stream, opts) {
    this.stream = stream;
    this.opts = opts;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  start(timeslice) {
    this.state = 'recording';
    this.timeslice = timeslice;
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}
FakeMediaRecorder.isTypeSupported = type => type === RECORDING_MIME_TYPE;

beforeEach(() => {
  window.AudioContext = FakeAudioContext;
  window.MediaRecorder = FakeMediaRecorder;
  // The module under test reads these as bare globals, not window.*.
  global.MediaRecorder = FakeMediaRecorder;
  global.MediaStream = FakeMediaStream;
  window.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
  window.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('isLocalRecordingSupported', () => {
  it('is true when AudioContext, MediaRecorder, and the webm/opus codec are all available', () => {
    expect(isLocalRecordingSupported()).toBe(true);
  });

  it('is false when MediaRecorder is missing entirely', () => {
    delete window.MediaRecorder;
    delete global.MediaRecorder;
    expect(isLocalRecordingSupported()).toBe(false);
  });

  it('is false when the browser cannot produce audio/webm;codecs=opus (e.g. Safari)', () => {
    window.MediaRecorder.isTypeSupported = () => false;
    expect(isLocalRecordingSupported()).toBe(false);
  });

  it('is false when AudioContext is missing entirely', () => {
    delete window.AudioContext;
    expect(isLocalRecordingSupported()).toBe(false);
  });
});

describe('LocalAudioMixRecorder', () => {
  it('is not active before start() is called', () => {
    const recorder = new LocalAudioMixRecorder();
    expect(recorder.isActive).toBe(false);
  });

  it('becomes active on start() and constructs the recorder against the mix destination', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    expect(recorder.isActive).toBe(true);
    expect(recorder.mediaRecorder.opts.mimeType).toBe(RECORDING_MIME_TYPE);
    expect(recorder.mediaRecorder.timeslice).toBe(1000);
  });

  it('calling start() twice does not create a second recorder', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    const first = recorder.mediaRecorder;
    recorder.start();
    expect(recorder.mediaRecorder).toBe(first);
  });

  it('syncTracks connects a source node for each new track', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    const trackA = new FakeMediaStreamTrack('a');
    const trackB = new FakeMediaStreamTrack('b');

    recorder.syncTracks([
      { key: 'host:sidA', mediaStreamTrack: trackA },
      { key: 'guest:sidB', mediaStreamTrack: trackB },
    ]);

    expect(recorder.sources.size).toBe(2);
    expect(recorder.sources.get('host:sidA').node.connected).toBe(true);
    expect(recorder.sources.get('guest:sidB').node.connected).toBe(true);
  });

  it('syncTracks disconnects and removes a track that is no longer active (participant left / unpublished)', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    const trackA = new FakeMediaStreamTrack('a');
    recorder.syncTracks([{ key: 'host:sidA', mediaStreamTrack: trackA }]);
    const node = recorder.sources.get('host:sidA').node;

    recorder.syncTracks([]);

    expect(node.disconnected).toBe(true);
    expect(recorder.sources.size).toBe(0);
  });

  it('syncTracks replaces a track whose underlying MediaStreamTrack changed (e.g. after reconnect)', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    const original = new FakeMediaStreamTrack('original');
    const replacement = new FakeMediaStreamTrack('replacement');
    recorder.syncTracks([{ key: 'host:sidA', mediaStreamTrack: original }]);
    const originalNode = recorder.sources.get('host:sidA').node;

    recorder.syncTracks([{ key: 'host:sidA', mediaStreamTrack: replacement }]);

    expect(originalNode.disconnected).toBe(true);
    expect(recorder.sources.get('host:sidA').mediaStreamTrack).toBe(replacement);
    expect(recorder.sources.get('host:sidA').node).not.toBe(originalNode);
  });

  it('syncTracks is a no-op before start() (no AudioContext yet)', () => {
    const recorder = new LocalAudioMixRecorder();
    expect(() =>
      recorder.syncTracks([{ key: 'x', mediaStreamTrack: new FakeMediaStreamTrack('x') }])
    ).not.toThrow();
    expect(recorder.sources.size).toBe(0);
  });

  it('stop() resolves with a Blob built from the data collected so far', async () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    recorder.mediaRecorder.ondataavailable({
      data: new Blob(['abc'], { type: RECORDING_MIME_TYPE }),
    });

    const blob = await recorder.stop();

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('stop() resolves with null when nothing was ever recorded', async () => {
    const recorder = new LocalAudioMixRecorder();
    expect(await recorder.stop()).toBeNull();
  });

  it('cleanup() disconnects all sources, stops the recorder, and closes the AudioContext', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    recorder.syncTracks([{ key: 'host:sidA', mediaStreamTrack: new FakeMediaStreamTrack('a') }]);
    const node = recorder.sources.get('host:sidA').node;
    const ctx = recorder.audioContext;

    recorder.cleanup();

    expect(node.disconnected).toBe(true);
    expect(recorder.sources.size).toBe(0);
    expect(recorder.mediaRecorder).toBeNull();
    expect(ctx.state).toBe('closed');
  });

  it('cleanup() is safe to call more than once', () => {
    const recorder = new LocalAudioMixRecorder();
    recorder.start();
    recorder.cleanup();
    expect(() => recorder.cleanup()).not.toThrow();
  });

  it('cleanup() is safe to call before start() was ever called', () => {
    const recorder = new LocalAudioMixRecorder();
    expect(() => recorder.cleanup()).not.toThrow();
  });
});

describe('buildRecordingFilename', () => {
  it('produces a .webm filename containing the room name', () => {
    const filename = buildRecordingFilename('rel-room-1234');
    expect(filename).toMatch(/^relay-recording-rel-room-1234-.+\.webm$/);
  });

  it('falls back to a generic name and sanitizes unsafe characters when roomName is missing/odd', () => {
    expect(buildRecordingFilename(undefined)).toMatch(/^relay-recording-meeting-.+\.webm$/);
    expect(buildRecordingFilename('a/b c')).not.toMatch(/[/\s]/);
  });
});

describe('downloadRecordingBlob', () => {
  it('creates an object URL and clicks a temporary anchor to trigger the download', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = new Blob(['data'], { type: RECORDING_MIME_TYPE });

    downloadRecordingBlob(blob, 'test.webm');

    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
  });
});
