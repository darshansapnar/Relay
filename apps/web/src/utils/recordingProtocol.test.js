import { describe, expect, it } from 'vitest';
import {
  LOCAL_RECORDING_STATUS,
  encodeRecordingMessage,
  decodeRecordingMessage,
  buildConsentDeclineMessage,
  isConsentDeclineMessage,
  isActiveRecordingStatus,
} from './recordingProtocol.js';

describe('consent decline message round-trip', () => {
  it('encodes and decodes a decline message', () => {
    const message = buildConsentDeclineMessage();
    const decoded = decodeRecordingMessage(encodeRecordingMessage(message));
    expect(decoded).toEqual(message);
    expect(isConsentDeclineMessage(decoded)).toBe(true);
  });
});

describe('decodeRecordingMessage', () => {
  it('ignores non-JSON payloads instead of throwing', () => {
    expect(decodeRecordingMessage(new TextEncoder().encode('not json'))).toBeNull();
  });

  it('ignores JSON that is not shaped like one of our messages', () => {
    const payload = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    expect(decodeRecordingMessage(payload)).toBeNull();
  });

  it('ignores a message from a different protocol sharing the same data channel', () => {
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: 'relay:request', action: 'unmute' })
    );
    const decoded = decodeRecordingMessage(payload);
    expect(isConsentDeclineMessage(decoded)).toBe(false);
  });
});

describe('isActiveRecordingStatus', () => {
  it('is true only for "recording"', () => {
    expect(isActiveRecordingStatus(LOCAL_RECORDING_STATUS.RECORDING)).toBe(true);
    expect(isActiveRecordingStatus(LOCAL_RECORDING_STATUS.IDLE)).toBe(false);
    expect(isActiveRecordingStatus(LOCAL_RECORDING_STATUS.STOPPED)).toBe(false);
  });
});
