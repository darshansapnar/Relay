// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIAudioPipeline } from './aiAudioCapture.js';

class FakeMediaStream {
  constructor(tracks = []) {
    this.tracks = tracks;
  }
}

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }
  constructor(stream, opts) {
    this.stream = stream;
    this.opts = opts;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

describe('AIAudioPipeline', () => {
  let mockSocket;
  let pipeline;

  beforeEach(() => {
    global.MediaStream = FakeMediaStream;
    global.MediaRecorder = FakeMediaRecorder;

    mockSocket = {
      connected: true,
      emit: vi.fn(),
    };
  });

  afterEach(() => {
    if (pipeline) {
      pipeline.stop();
    }
    vi.clearAllMocks();
  });

  it('initializes with meeting start time and inactive state', () => {
    const meetingStart = Date.now() - 5000;
    pipeline = new AIAudioPipeline({
      socket: mockSocket,
      roomName: 'test-room',
      meetingStartTime: meetingStart,
    });

    expect(pipeline.isActive).toBe(false);
    expect(pipeline.meetingStartTime).toBe(meetingStart);
    expect(pipeline.recorders.size).toBe(0);
  });

  it('updates meeting start time via setMeetingStartTime', () => {
    pipeline = new AIAudioPipeline({
      socket: mockSocket,
      roomName: 'test-room',
    });

    const newTime = Date.now() - 20000;
    pipeline.setMeetingStartTime(newTime);
    expect(pipeline.meetingStartTime).toBe(newTime);
  });

  it('deduplicates activeTracks by speakerIdentity so each speaker has at most one recorder', () => {
    pipeline = new AIAudioPipeline({
      socket: mockSocket,
      roomName: 'test-room',
    });
    pipeline.start();

    const mockTrack = {
      readyState: 'live',
      kind: 'audio',
    };

    // Simulate LiveKit having two track publications for the same participant (e.g. mic and TR_...)
    const activeTracks = [
      {
        key: 'user-1:mic',
        speakerIdentity: 'user-1',
        speakerName: 'Om',
        mediaStreamTrack: mockTrack,
      },
      {
        key: 'user-1:TR_audio123',
        speakerIdentity: 'user-1',
        speakerName: 'Om',
        mediaStreamTrack: mockTrack,
      },
      {
        key: 'user-2:TR_audio456',
        speakerIdentity: 'user-2',
        speakerName: 'Alice',
        mediaStreamTrack: mockTrack,
      },
    ];

    pipeline.syncTracks(activeTracks);

    // Should have exactly 2 recorders (one for user-1, one for user-2), NOT 3!
    expect(pipeline.recorders.size).toBe(2);
    expect(pipeline.recorders.has('user-1')).toBe(true);
    expect(pipeline.recorders.has('user-2')).toBe(true);
  });

  it('removes recorders when a participant leaves or stops speaking', () => {
    pipeline = new AIAudioPipeline({
      socket: mockSocket,
      roomName: 'test-room',
    });
    pipeline.start();

    const mockTrack = { readyState: 'live', kind: 'audio' };

    pipeline.syncTracks([
      { key: 'user-1', speakerIdentity: 'user-1', speakerName: 'Om', mediaStreamTrack: mockTrack },
      { key: 'user-2', speakerIdentity: 'user-2', speakerName: 'Bob', mediaStreamTrack: mockTrack },
    ]);
    expect(pipeline.recorders.size).toBe(2);

    // Bob leaves
    pipeline.syncTracks([
      { key: 'user-1', speakerIdentity: 'user-1', speakerName: 'Om', mediaStreamTrack: mockTrack },
    ]);

    expect(pipeline.recorders.size).toBe(1);
    expect(pipeline.recorders.has('user-1')).toBe(true);
    expect(pipeline.recorders.has('user-2')).toBe(false);
  });

  it('cleans up and stops all recorders when pipeline.stop() is called', () => {
    pipeline = new AIAudioPipeline({
      socket: mockSocket,
      roomName: 'test-room',
    });
    pipeline.start();

    const mockTrack = { readyState: 'live', kind: 'audio' };
    pipeline.syncTracks([
      { key: 'user-1', speakerIdentity: 'user-1', speakerName: 'Om', mediaStreamTrack: mockTrack },
    ]);

    expect(pipeline.recorders.size).toBe(1);

    pipeline.stop();
    expect(pipeline.isActive).toBe(false);
    expect(pipeline.recorders.size).toBe(0);
  });
});
