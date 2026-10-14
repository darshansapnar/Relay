import { describe, expect, it } from 'vitest';
import { buildRoomMetadata, parseRoomMetadata } from './livekitAdmin.js';

describe('room host metadata round-trip', () => {
  it('round-trips a host identity through build/parse', () => {
    const metadata = buildRoomMetadata({ hostIdentity: 'user_123_abcdef' });
    expect(parseRoomMetadata(metadata)).toEqual({ hostIdentity: 'user_123_abcdef' });
  });

  it('treats missing metadata as "no host recorded"', () => {
    expect(parseRoomMetadata(undefined)).toEqual({ hostIdentity: null });
    expect(parseRoomMetadata('')).toEqual({ hostIdentity: null });
  });

  it('treats malformed metadata as "no host recorded" instead of throwing', () => {
    expect(parseRoomMetadata('not json')).toEqual({ hostIdentity: null });
    expect(parseRoomMetadata('{"hostIdentity": 42}')).toEqual({ hostIdentity: null });
  });
});
