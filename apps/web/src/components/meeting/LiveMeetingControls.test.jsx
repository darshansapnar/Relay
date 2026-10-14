// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LiveMeetingControls } from './LiveMeetingControls.jsx';

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: { attributes: {} },
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    isScreenShareEnabled: false,
  }),
  useParticipants: () => [{ identity: 'user_1', isLocal: true }],
}));

const baseProps = {
  activePanel: null,
  onTogglePanel: () => {},
  onLeaveClick: () => {},
  showMoreOptions: false,
  onToggleMoreOptions: () => {},
};

describe('LiveMeetingControls recording control', () => {
  it('is not shown to a non-host', () => {
    render(<LiveMeetingControls {...baseProps} isHost={false} recordingStatus="idle" />);
    expect(screen.queryByLabelText('Start recording')).toBeNull();
  });

  it('shows "Start recording" to the host when idle', () => {
    render(<LiveMeetingControls {...baseProps} isHost recordingStatus="idle" recordingSupported />);
    expect(screen.getByLabelText('Start recording')).toBeTruthy();
  });

  it('calls onStartRecordingClick (opening the consent dialog), not a direct recording start', () => {
    const onStart = vi.fn();
    render(
      <LiveMeetingControls
        {...baseProps}
        isHost
        recordingStatus="idle"
        recordingSupported
        onStartRecordingClick={onStart}
      />
    );
    fireEvent.click(screen.getByLabelText('Start recording'));
    expect(onStart).toHaveBeenCalled();
  });

  it('is disabled with an explanatory title when the browser does not support local recording', () => {
    render(
      <LiveMeetingControls
        {...baseProps}
        isHost
        recordingStatus="idle"
        recordingSupported={false}
      />
    );
    const button = screen.getByLabelText('Start recording');
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/does not support local audio recording/i);
  });

  it('is disabled while the recorder is starting up', () => {
    render(
      <LiveMeetingControls
        {...baseProps}
        isHost
        recordingStatus="idle"
        recordingSupported
        startingRecording
      />
    );
    expect(screen.getByLabelText('Start recording').disabled).toBe(true);
  });

  it('switches to "Stop recording" while active and calls onStopRecordingClick', () => {
    const onStop = vi.fn();
    render(
      <LiveMeetingControls
        {...baseProps}
        isHost
        recordingStatus="recording"
        recordingSupported
        onStopRecordingClick={onStop}
      />
    );
    const button = screen.getByLabelText('Stop recording');
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onStop).toHaveBeenCalled();
  });
});
