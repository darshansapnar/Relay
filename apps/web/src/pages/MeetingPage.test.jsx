// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MeetingPage } from './MeetingPage.jsx';
import { requestMeetingToken } from '../api/meetingApi.js';

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

let mockLocationState;
vi.mock('react-router-dom', () => ({
  useParams: () => ({ roomId: 'room-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: mockLocationState }),
}));

vi.mock('../api/meetingApi.js', () => ({
  // Never resolves within the test -- we only care how many times this was
  // *called*, not what happens after it resolves.
  requestMeetingToken: vi.fn(() => new Promise(() => {})),
}));

vi.mock('../components/meeting/PreJoinScreen.jsx', () => ({
  PreJoinScreen: () => null,
}));
vi.mock('../components/meeting/MeetingRoomLive.jsx', () => ({
  MeetingRoomLive: () => null,
}));

describe('MeetingPage auto-join (Create Meeting -> autoJoin flow)', () => {
  it('requests a token exactly once under React.StrictMode double-invocation', async () => {
    // This is the exact shape CreateMeetingModal navigates with. Regression
    // test for the bug where StrictMode double-invoking this effect fired
    // two separate /api/meetings/token requests for the same join, each
    // getting a different participantIdentity and independently racing to
    // claim host -- producing a token that claims "host" in its attributes
    // while the backend's authorizeHostRequest() (keyed off whichever
    // identity's createRoom call actually won) rejects it.
    mockLocationState = { autoJoin: true, displayName: 'Alice' };

    render(
      <React.StrictMode>
        <MeetingPage />
      </React.StrictMode>
    );

    // Give React's effect scheduling (and StrictMode's extra pass) a chance
    // to run before asserting.
    await waitFor(() => {
      expect(requestMeetingToken).toHaveBeenCalled();
    });

    expect(requestMeetingToken).toHaveBeenCalledTimes(1);
    expect(requestMeetingToken).toHaveBeenCalledWith('room-1', 'Alice');
  });

  it('does not request a token at all when not auto-joining', async () => {
    mockLocationState = undefined;

    render(
      <React.StrictMode>
        <MeetingPage />
      </React.StrictMode>
    );

    // Nothing async to wait on here deliberately; a brief tick is enough to
    // let any effects run.
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(requestMeetingToken).not.toHaveBeenCalled();
  });
});
