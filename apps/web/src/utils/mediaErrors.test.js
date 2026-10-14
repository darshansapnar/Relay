import { describe, expect, it } from 'vitest';
import { describeMediaDeviceFailure, isMediaDeviceError } from './mediaErrors.js';

describe('isMediaDeviceError', () => {
  it('recognizes getUserMedia/getDisplayMedia DOMException names', () => {
    const names = [
      'NotAllowedError',
      'PermissionDeniedError',
      'NotFoundError',
      'DevicesNotFoundError',
      'NotReadableError',
      'TrackStartError',
      'OverconstrainedError',
      'AbortError',
      'SecurityError',
    ];
    for (const name of names) {
      expect(isMediaDeviceError({ name })).toBe(true);
    }
  });

  it('treats unrelated/connection errors as not a media device error', () => {
    expect(isMediaDeviceError({ name: 'ConnectionError' })).toBe(false);
    expect(isMediaDeviceError({ name: 'TypeError' })).toBe(false);
    expect(isMediaDeviceError(new Error('signal connection failed'))).toBe(false);
  });

  it('handles null/undefined safely', () => {
    expect(isMediaDeviceError(null)).toBe(false);
    expect(isMediaDeviceError(undefined)).toBe(false);
  });
});

describe('describeMediaDeviceFailure', () => {
  it('describes a permission-denied camera failure', () => {
    const message = describeMediaDeviceFailure('PermissionDenied', 'videoinput');
    expect(message).toMatch(/camera/i);
    expect(message).toMatch(/denied/i);
  });

  it('describes a permission-denied microphone failure', () => {
    const message = describeMediaDeviceFailure('PermissionDenied', 'audioinput');
    expect(message).toMatch(/microphone/i);
    expect(message).toMatch(/denied/i);
  });

  it('describes a missing-device failure', () => {
    const message = describeMediaDeviceFailure('NotFound', 'videoinput');
    expect(message).toMatch(/no camera/i);
  });

  it('describes a device-in-use failure distinctly from permission/not-found', () => {
    const message = describeMediaDeviceFailure('DeviceInUse', 'videoinput');
    expect(message).toMatch(/already in use/i);
  });

  it('falls back to a generic-but-device-labeled message for unknown failure reasons', () => {
    const message = describeMediaDeviceFailure('Other', 'audioinput');
    expect(message).toMatch(/microphone/i);
  });

  it('falls back to "device" label when kind is unknown (e.g. screen share)', () => {
    const message = describeMediaDeviceFailure('DeviceInUse', undefined);
    expect(message).toMatch(/device/i);
    expect(message).not.toMatch(/camera|microphone/i);
  });
});
