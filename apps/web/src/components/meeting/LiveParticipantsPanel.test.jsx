// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LiveParticipantsPanel } from './LiveParticipantsPanel.jsx';
import * as meetingApi from '../../api/meetingApi.js';

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

let mockParticipants = [];
vi.mock('@livekit/components-react', () => ({
  useParticipants: () => mockParticipants,
}));

vi.mock('../../api/meetingApi.js', () => ({
  muteParticipant: vi.fn().mockResolvedValue({ success: true }),
  setParticipantCamera: vi.fn().mockResolvedValue({ success: true }),
  removeParticipant: vi.fn().mockResolvedValue({ success: true }),
}));

function participant({
  identity,
  name,
  isLocal,
  attributes = {},
  isMicrophoneEnabled = true,
  isCameraEnabled = true,
}) {
  return { identity, name, isLocal, attributes, isMicrophoneEnabled, isCameraEnabled };
}

describe('LiveParticipantsPanel host/local labeling', () => {
  it('shows exactly one "You" tag, for the real local participant, never a "Host" tag when nobody is host', () => {
    // useParticipants() always returns [localParticipant, ...remoteParticipants],
    // so the local participant is intentionally placed first here -- this is the
    // exact shape that used to trigger the "array position 0 == Host" bug.
    mockParticipants = [
      participant({ identity: 'user_1_aaaa', name: 'Sam', isLocal: true }),
      participant({ identity: 'user_2_bbbb', name: 'Sam', isLocal: false }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} />);

    expect(screen.getByText('2')).toBeTruthy(); // participant count badge
    expect(screen.getAllByText('Sam')).toHaveLength(2);
    expect(screen.getAllByText('You')).toHaveLength(1);
    expect(screen.queryByText('Host')).toBeNull();
  });

  it('still shows no "Host" tag when the local participant is not first in the list', () => {
    mockParticipants = [
      participant({ identity: 'user_3_cccc', name: 'Remote One', isLocal: false }),
      participant({ identity: 'user_4_dddd', name: 'Remote Two', isLocal: false }),
      participant({ identity: 'user_5_eeee', name: 'Local User', isLocal: true }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} />);

    expect(screen.queryByText('Host')).toBeNull();
    expect(screen.getAllByText('You')).toHaveLength(1);
  });

  it('labels whoever has attributes.role === "host" as Host, regardless of list position', () => {
    mockParticipants = [
      participant({ identity: 'user_6_remote', name: 'Rahul', isLocal: false }),
      participant({
        identity: 'user_7_host',
        name: 'Priya',
        isLocal: true,
        attributes: { role: 'host' },
      }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} />);

    expect(screen.getByText('Host')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    // Rahul is remote and not host -> plain "Participant" label.
    expect(screen.getByText('Participant')).toBeTruthy();
  });
});

describe('LiveParticipantsPanel host moderation controls', () => {
  it('shows no Mute/Remove buttons when the local viewer is not host', () => {
    mockParticipants = [
      participant({ identity: 'user_8_local', name: 'Me', isLocal: true }),
      participant({ identity: 'user_9_remote', name: 'Other', isLocal: false }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} isHost={false} />);

    expect(screen.queryByText('Mute')).toBeNull();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('shows Mute/Remove buttons only on remote rows when the local viewer is host', () => {
    mockParticipants = [
      participant({
        identity: 'user_10_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({ identity: 'user_11_remote', name: 'Other', isLocal: false }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} isHost token="tok" roomName="room1" />);

    // Exactly one Mute/Remove pair -- for the remote row, not the host's own row.
    expect(screen.getAllByText('Mute')).toHaveLength(1);
    expect(screen.getAllByText('Remove')).toHaveLength(1);
  });

  it('calls muteParticipant with the room, target identity, and host token when Mute is clicked', async () => {
    mockParticipants = [
      participant({
        identity: 'user_12_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({ identity: 'user_13_remote', name: 'Other', isLocal: false }),
    ];

    render(
      <LiveParticipantsPanel isOpen onClose={() => {}} isHost token="host-tok" roomName="room1" />
    );

    fireEvent.click(screen.getByText('Mute'));

    expect(meetingApi.muteParticipant).toHaveBeenCalledWith(
      'room1',
      'user_13_remote',
      true,
      'host-tok'
    );
  });

  it('calls removeParticipant with the room, target identity, and host token when Remove is clicked and confirmed', async () => {
    mockParticipants = [
      participant({
        identity: 'user_14_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({ identity: 'user_15_remote', name: 'Other', isLocal: false }),
    ];

    render(
      <LiveParticipantsPanel isOpen onClose={() => {}} isHost token="host-tok" roomName="room1" />
    );

    // Initial click opens confirmation dialog
    fireEvent.click(screen.getByText('Remove'));

    // Confirm removal in modal
    const confirmBtn = screen.getByRole('button', { name: /Remove Participant/i });
    fireEvent.click(confirmBtn);

    expect(meetingApi.removeParticipant).toHaveBeenCalledWith(
      'room1',
      'user_15_remote',
      'host-tok'
    );
  });
});

describe('LiveParticipantsPanel camera controls and request-to-enable workflow', () => {
  it('shows "Mute" (not a request) when the target mic is currently on', () => {
    mockParticipants = [
      participant({
        identity: 'user_20_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_21_remote',
        name: 'Other',
        isLocal: false,
        isMicrophoneEnabled: true,
      }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} isHost token="tok" roomName="room1" />);

    expect(screen.getByText('Mute')).toBeTruthy();
    expect(screen.queryByText('Request Unmute')).toBeNull();
  });

  it('shows "Request Unmute" instead of "Mute" when the target mic is already off', () => {
    mockParticipants = [
      participant({
        identity: 'user_22_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_23_remote',
        name: 'Other',
        isLocal: false,
        isMicrophoneEnabled: false,
      }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} isHost token="tok" roomName="room1" />);

    expect(screen.queryByText('Mute')).toBeNull();
    expect(screen.getByText('Request Unmute')).toBeTruthy();
  });

  it('shows "Camera Off" when the target camera is on, "Request Camera" when it is off', () => {
    mockParticipants = [
      participant({
        identity: 'user_24_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({ identity: 'user_25_on', name: 'CamOn', isLocal: false, isCameraEnabled: true }),
      participant({
        identity: 'user_26_off',
        name: 'CamOff',
        isLocal: false,
        isCameraEnabled: false,
      }),
    ];

    render(<LiveParticipantsPanel isOpen onClose={() => {}} isHost token="tok" roomName="room1" />);

    expect(screen.getByText('Camera Off')).toBeTruthy();
    expect(screen.getByText('Request Camera')).toBeTruthy();
  });

  it('calls setParticipantCamera(disabled: true) when "Camera Off" is clicked', () => {
    mockParticipants = [
      participant({
        identity: 'user_27_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_28_remote',
        name: 'Other',
        isLocal: false,
        isCameraEnabled: true,
      }),
    ];

    render(
      <LiveParticipantsPanel isOpen onClose={() => {}} isHost token="host-tok" roomName="room1" />
    );

    fireEvent.click(screen.getByText('Camera Off'));

    expect(meetingApi.setParticipantCamera).toHaveBeenCalledWith(
      'room1',
      'user_28_remote',
      true,
      'host-tok'
    );
  });

  it('"Request Unmute" lifts the host mute restriction and sends a real-time request, not just local state', async () => {
    mockParticipants = [
      participant({
        identity: 'user_29_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_30_remote',
        name: 'Other',
        isLocal: false,
        isMicrophoneEnabled: false,
        attributes: { mutedByHost: 'true' },
      }),
    ];
    const onSendRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <LiveParticipantsPanel
        isOpen
        onClose={() => {}}
        isHost
        token="host-tok"
        roomName="room1"
        onSendRequest={onSendRequest}
      />
    );

    fireEvent.click(screen.getByText('Request Unmute'));

    await vi.waitFor(() => {
      expect(meetingApi.muteParticipant).toHaveBeenCalledWith(
        'room1',
        'user_30_remote',
        false,
        'host-tok'
      );
      expect(onSendRequest).toHaveBeenCalledWith('user_30_remote', 'unmute');
    });
  });

  it('"Request Camera" lifts the host camera restriction and sends a real-time request', async () => {
    mockParticipants = [
      participant({
        identity: 'user_31_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_32_remote',
        name: 'Other',
        isLocal: false,
        isCameraEnabled: false,
        attributes: { cameraDisabledByHost: 'true' },
      }),
    ];
    const onSendRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <LiveParticipantsPanel
        isOpen
        onClose={() => {}}
        isHost
        token="host-tok"
        roomName="room1"
        onSendRequest={onSendRequest}
      />
    );

    fireEvent.click(screen.getByText('Request Camera'));

    await vi.waitFor(() => {
      expect(meetingApi.setParticipantCamera).toHaveBeenCalledWith(
        'room1',
        'user_32_remote',
        false,
        'host-tok'
      );
      expect(onSendRequest).toHaveBeenCalledWith('user_32_remote', 'enable-camera');
    });
  });

  it('shows per-row request status feedback (sent/accepted/declined) from requestStatusByKey', () => {
    mockParticipants = [
      participant({
        identity: 'user_33_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_34_remote',
        name: 'Other',
        isLocal: false,
        isMicrophoneEnabled: false,
        isCameraEnabled: false,
      }),
    ];

    render(
      <LiveParticipantsPanel
        isOpen
        onClose={() => {}}
        isHost
        token="tok"
        roomName="room1"
        requestStatusByKey={{
          'user_34_remote:unmute': 'accepted',
          'user_34_remote:enable-camera': 'declined',
        }}
      />
    );

    expect(screen.getByText(/Mic: Accepted/)).toBeTruthy();
    expect(screen.getByText(/Camera: Declined/)).toBeTruthy();
  });

  it('never claims "sent" means delivered: shows a distinct no-response status once the wait times out', () => {
    // LiveKit's data API has no delivery acknowledgement -- MeetingRoomLive
    // transitions a stuck 'sent' status to 'no-response' after a timeout
    // (see REQUEST_RESPONSE_TIMEOUT_MS in utils/hostRequests.js) instead of
    // leaving the host looking at an indefinite "Sent, awaiting response..."
    // for a request that may never be answered.
    mockParticipants = [
      participant({
        identity: 'user_35_host',
        name: 'Me',
        isLocal: true,
        attributes: { role: 'host' },
      }),
      participant({
        identity: 'user_36_remote',
        name: 'Other',
        isLocal: false,
        isMicrophoneEnabled: false,
      }),
    ];

    render(
      <LiveParticipantsPanel
        isOpen
        onClose={() => {}}
        isHost
        token="tok"
        roomName="room1"
        requestStatusByKey={{ 'user_36_remote:unmute': 'no-response' }}
      />
    );

    expect(screen.getByText(/Mic: No response/)).toBeTruthy();
  });
});
