// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveParticipantTile } from './LiveParticipantTile.jsx';

afterEach(cleanup);

// LiveParticipantTile only reaches into <VideoTrack> when a camera track is
// actually attached; these tests keep every participant camera-off so the
// avatar-fallback branch renders, and stub VideoTrack out so importing
// @livekit/components-react doesn't require a real LiveKit Room/browser APIs.
vi.mock('@livekit/components-react', () => ({
  VideoTrack: () => null,
}));

function makeTrackRef({ identity, name, isLocal, attributes = {} }) {
  return {
    participant: {
      identity,
      name,
      isLocal,
      attributes,
      isSpeaking: false,
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
    },
    publication: { track: null, isMuted: false },
    source: 'camera',
  };
}

describe('LiveParticipantTile host/local labeling', () => {
  it('labels the local participant as "You", never "Host"', () => {
    const trackRef = makeTrackRef({ identity: 'user_1_aaaa', name: 'Sam', isLocal: true });
    render(<LiveParticipantTile trackRef={trackRef} />);

    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('(You)')).toBeTruthy();
    expect(screen.queryByText('Host')).toBeNull();
  });

  it('never labels a remote participant as "You" or "Host", even with the same display name as the local user', () => {
    // Same display name as the "local" test above -- display name must never
    // be what determines local/remote identity.
    const trackRef = makeTrackRef({ identity: 'user_2_bbbb', name: 'Sam', isLocal: false });
    render(<LiveParticipantTile trackRef={trackRef} />);

    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText('(You)')).toBeNull();
    expect(screen.queryByText('Host')).toBeNull();
  });

  it('does not depend on rendering order: a remote tile rendered first is still not "You"', () => {
    // Regression guard for the original bug, where the first tile in the
    // array (array position 0) was unconditionally labeled "Host".
    const remoteFirst = makeTrackRef({ identity: 'user_3_cccc', name: 'Remote', isLocal: false });
    const { unmount } = render(<LiveParticipantTile trackRef={remoteFirst} />);
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText('Host')).toBeNull();
    unmount();

    const localSecond = makeTrackRef({ identity: 'user_4_dddd', name: 'LocalUser', isLocal: true });
    render(<LiveParticipantTile trackRef={localSecond} />);
    expect(screen.getByText('You')).toBeTruthy();
  });
});

describe('LiveParticipantTile real host attribute labeling', () => {
  // Host status comes only from participant.attributes.role, set server-side
  // at token mint time (apps/api/src/controllers/meeting.controller.js) and
  // synced to every client by LiveKit -- never from array/render position.
  it('labels a remote host as "Host", not "You"', () => {
    const trackRef = makeTrackRef({
      identity: 'user_5_host',
      name: 'Priya',
      isLocal: false,
      attributes: { role: 'host' },
    });
    render(<LiveParticipantTile trackRef={trackRef} />);

    expect(screen.getByText('Host')).toBeTruthy();
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText('(You)')).toBeNull();
  });

  it('labels the local host as "Host" in the corner badge, and still "(You)" in the name bar', () => {
    const trackRef = makeTrackRef({
      identity: 'user_6_localhost',
      name: 'Rahul',
      isLocal: true,
      attributes: { role: 'host' },
    });
    render(<LiveParticipantTile trackRef={trackRef} />);

    expect(screen.getByText('Host')).toBeTruthy();
    expect(screen.getByText('(You)')).toBeTruthy();
    // The corner badge is "Host", not a second "You" -- regular queryByText
    // for an exact "You" node should find none since the only self-reference
    // left is the "(You)" text in the name bar.
    expect(screen.queryByText('You')).toBeNull();
  });

  it('a non-host participant is never labeled "Host", regardless of any other attributes set', () => {
    const trackRef = makeTrackRef({
      identity: 'user_7_plain',
      name: 'Dana',
      isLocal: false,
      attributes: { role: 'participant', mutedByHost: 'false' },
    });
    render(<LiveParticipantTile trackRef={trackRef} />);

    expect(screen.queryByText('Host')).toBeNull();
  });
});
