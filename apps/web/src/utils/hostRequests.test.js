import { describe, expect, it } from 'vitest';
import {
  encodeHostMessage,
  decodeHostMessage,
  buildRequestMessage,
  buildResponseMessage,
  isRequestMessage,
  isResponseMessage,
  REQUEST_ACTIONS,
  RESPONSE_STATUSES,
} from './hostRequests.js';

describe('host request/response message round-trip', () => {
  it('round-trips a request message through encode/decode', () => {
    const message = buildRequestMessage({ requestId: 'req-1', action: REQUEST_ACTIONS.UNMUTE });
    const decoded = decodeHostMessage(encodeHostMessage(message));
    expect(decoded).toEqual(message);
    expect(isRequestMessage(decoded)).toBe(true);
    expect(isResponseMessage(decoded)).toBe(false);
  });

  it('round-trips a response message through encode/decode', () => {
    const message = buildResponseMessage({
      requestId: 'req-1',
      action: REQUEST_ACTIONS.ENABLE_CAMERA,
      status: RESPONSE_STATUSES.ACCEPTED,
    });
    const decoded = decodeHostMessage(encodeHostMessage(message));
    expect(decoded).toEqual(message);
    expect(isResponseMessage(decoded)).toBe(true);
    expect(isRequestMessage(decoded)).toBe(false);
  });
});

describe('decodeHostMessage safety', () => {
  it('returns null for non-JSON payloads instead of throwing', () => {
    const garbage = new TextEncoder().encode('not json at all {{{');
    expect(decodeHostMessage(garbage)).toBeNull();
  });

  it('returns null for JSON that is not shaped like our protocol (e.g. an unrelated data-channel message)', () => {
    const unrelated = new TextEncoder().encode(JSON.stringify({ foo: 'bar' }));
    expect(decodeHostMessage(unrelated)).toBeNull();
  });

  it('returns null for a JSON array', () => {
    const arr = new TextEncoder().encode(JSON.stringify([1, 2, 3]));
    expect(decodeHostMessage(arr)).toBeNull();
  });
});
