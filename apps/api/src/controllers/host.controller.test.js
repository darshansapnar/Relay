import { describe, expect, it } from 'vitest';
import { TrackSource } from 'livekit-server-sdk';
import { computeAllowedSources } from './host.controller.js';

const ALL = [
  TrackSource.CAMERA,
  TrackSource.MICROPHONE,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

describe('computeAllowedSources', () => {
  it('allows everything when neither track is host-disabled', () => {
    expect(computeAllowedSources({ micDisabled: false, cameraDisabled: false })).toEqual(ALL);
  });

  it('excludes only the microphone when just the mic is disabled', () => {
    const result = computeAllowedSources({ micDisabled: true, cameraDisabled: false });
    expect(result).not.toContain(TrackSource.MICROPHONE);
    expect(result).toContain(TrackSource.CAMERA);
    expect(result).toContain(TrackSource.SCREEN_SHARE);
  });

  it('excludes only the camera when just the camera is disabled', () => {
    const result = computeAllowedSources({ micDisabled: false, cameraDisabled: true });
    expect(result).not.toContain(TrackSource.CAMERA);
    expect(result).toContain(TrackSource.MICROPHONE);
  });

  // This is the exact bug class the merge logic exists to prevent: muting a
  // participant's mic while their camera is already host-disabled (or vice
  // versa) must not silently restore the other restriction, because
  // RoomServiceClient.updateParticipant replaces canPublishSources wholesale
  // rather than merging with what's already set.
  it('preserves an existing camera restriction when only the mic restriction changes', () => {
    const result = computeAllowedSources({ micDisabled: true, cameraDisabled: true });
    expect(result).not.toContain(TrackSource.MICROPHONE);
    expect(result).not.toContain(TrackSource.CAMERA);
    expect(result).toContain(TrackSource.SCREEN_SHARE);
    expect(result).toContain(TrackSource.SCREEN_SHARE_AUDIO);
  });

  it('restores both when neither is disabled after both had been', () => {
    expect(computeAllowedSources({ micDisabled: false, cameraDisabled: false })).toEqual(ALL);
  });
});
