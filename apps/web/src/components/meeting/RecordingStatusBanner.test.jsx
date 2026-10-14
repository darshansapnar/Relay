// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  RecordingStatusBanner,
  RecordingErrorBanner,
  formatElapsed,
} from './RecordingStatusBanner.jsx';

afterEach(cleanup);

describe('formatElapsed', () => {
  it('formats under an hour as MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(65_000)).toBe('01:05');
  });

  it('formats an hour or more as H:MM:SS', () => {
    expect(formatElapsed(3_661_000)).toBe('1:01:01');
  });
});

describe('RecordingStatusBanner', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<RecordingStatusBanner recording={{ status: 'idle' }} isHost />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there is no recording state at all', () => {
    const { container } = render(<RecordingStatusBanner recording={null} isHost />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a starting indicator while the mixer/recorder is spinning up, for host and non-host alike', () => {
    render(<RecordingStatusBanner recording={{ status: 'idle' }} isHost={false} starting />);
    expect(screen.getByText('Starting recording...')).toBeTruthy();
  });

  it('shows the elapsed timer, requester, and consent notice while recording, for every participant', () => {
    render(
      <RecordingStatusBanner
        recording={{ status: 'recording', requestedByName: 'Alex' }}
        isHost={false}
        elapsedMs={65_000}
      />
    );
    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText(/Started by Alex/)).toBeTruthy();
    expect(screen.getByText(/you consent to this recording/)).toBeTruthy();
  });

  it('shows a Stop Recording control to the host, not a Withdraw Consent control', () => {
    const onStop = vi.fn();
    render(
      <RecordingStatusBanner
        recording={{ status: 'recording' }}
        isHost
        elapsedMs={0}
        onStop={onStop}
      />
    );
    expect(screen.queryByText('Withdraw Consent')).toBeNull();
    fireEvent.click(screen.getByText('Stop Recording'));
    expect(onStop).toHaveBeenCalled();
  });

  it('shows a Withdraw Consent control to a non-host, not a Stop control', () => {
    const onDecline = vi.fn();
    render(
      <RecordingStatusBanner
        recording={{ status: 'recording' }}
        isHost={false}
        elapsedMs={0}
        onDecline={onDecline}
      />
    );
    expect(screen.queryByText('Stop Recording')).toBeNull();
    fireEvent.click(screen.getByText('Withdraw Consent'));
    expect(onDecline).toHaveBeenCalled();
  });

  it('tells the host the file was saved to their device once stopped, and lets anyone dismiss the banner', () => {
    const onDismiss = vi.fn();
    render(
      <RecordingStatusBanner recording={{ status: 'stopped' }} isHost onDismiss={onDismiss} />
    );
    expect(screen.getByText(/saved to your device/)).toBeTruthy();
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('tells a non-host only that recording stopped, with no claim about a file on their device', () => {
    render(<RecordingStatusBanner recording={{ status: 'stopped' }} isHost={false} />);
    expect(screen.getByText('Recording stopped.')).toBeTruthy();
  });
});

describe('RecordingErrorBanner', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<RecordingErrorBanner message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the message and calls onDismiss when dismissed', () => {
    const onDismiss = vi.fn();
    render(<RecordingErrorBanner message="Could not start recording." onDismiss={onDismiss} />);
    expect(screen.getByText('Could not start recording.')).toBeTruthy();
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
