// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantPanel } from './AssistantPanel.jsx';
import { AI_STATUS } from '@relay/shared';


// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

describe('AssistantPanel component', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    isActive: false,
    consentGranted: false,
    transcriptionStatus: AI_STATUS.IDLE,
    summaryStatus: AI_STATUS.IDLE,
    pauseReason: null,
    transcriptionPauseReason: null,
    transcripts: [],
    latestSummary: null,
    isGeneratingSummary: false,
    audioStreamingActive: false,
    onToggleAI: vi.fn(),
    onTriggerSummary: vi.fn(),
    isHost: true,
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AssistantPanel {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('toggles isOpen from false to true without violating React hook rules or crashing', () => {
    const { rerender } = render(<AssistantPanel {...baseProps} isOpen={false} />);
    expect(screen.queryByRole('heading', { name: /Relay Copilot/i })).toBeNull();

    // Rerender with isOpen = true (simulating user clicking to open the copilot panel)
    rerender(<AssistantPanel {...baseProps} isOpen={true} />);
    expect(screen.getByRole('heading', { name: /Relay Copilot/i })).toBeTruthy();
  });

  it('shows consent requirement when AI is not active and gates activation', () => {
    render(<AssistantPanel {...baseProps} />);
    expect(screen.getByText(/Participant Consent Required/i)).toBeTruthy();

    const enableButton = screen.getByRole('button', { name: /Enable AI Assistant/i });
    expect(enableButton.disabled).toBe(true);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(enableButton.disabled).toBe(false);

    fireEvent.click(enableButton);
    expect(baseProps.onToggleAI).toHaveBeenCalledWith(true);
  });

  it('renders active status badge and listening state when active', () => {
    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        audioStreamingActive={true}
      />
    );

    expect(screen.getByText('Listening & Transcribing...')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stop/i })).toBeTruthy();
  });

  it('renders live transcripts with speaker names and timestamps', () => {
    const transcripts = [
      {
        id: 't-1',
        speakerIdentity: 'alice',
        speakerName: 'Alice',
        text: 'Let us begin the discussion on Q4 architecture.',
        startTimeMs: 65000,
      },
    ];

    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        transcripts={transcripts}
      />
    );

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText('Let us begin the discussion on Q4 architecture.')).toBeTruthy();
  });

  it('renders only two visible tabs in order: Live Transcript and Summary', () => {
    render(<AssistantPanel {...baseProps} isActive={true} consentGranted={true} />);

    // Live Transcript and Summary buttons should be present
    expect(screen.getByRole('button', { name: /Live Transcript/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Summary/ })).toBeTruthy();

    // Removed tabs must NOT be present
    expect(screen.queryByRole('button', { name: /Overview/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Decisions/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Actions/i })).toBeNull();
  });

  it('renders executive summary, decisions, work allocation, action items with deadlines, and unresolved questions', () => {
    const latestSummary = {
      version: 2,
      summaryText: 'The team approved the database migration.',
      keyPoints: ['Use Neon PostgreSQL pooler', 'Strict SSL mode'],
      decisions: ['Agreed to use Neon PostgreSQL as primary database'],
      workAllocation: [
        {
          person: 'Sarah Connor',
          responsibilities: ['Oversee database architecture', 'Review pull requests'],
        },
        {
          person: 'John Doe',
          responsibilities: ['Configure connection pooler'],
        },
      ],
      actionItems: [
        { task: 'Deploy schema migration', owner: 'Bob', deadline: 'Friday 5:00 PM' },
        { task: 'Update API docs', owner: 'Alice', deadline: 'Not specified' },
      ],
      unresolvedQuestions: ['Should we enable auto-scaling on weekends?'],
      providerUsed: 'groq',
      createdAt: new Date().toISOString(),
    };

    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        latestSummary={latestSummary}
      />
    );

    // Switch to Summary tab
    const summaryTab = screen.getByRole('button', { name: /^Summary/ });
    fireEvent.click(summaryTab);

    // Overview and key points
    expect(screen.getByText(/The team approved the database migration./i)).toBeTruthy();
    expect(screen.getByText('Use Neon PostgreSQL pooler')).toBeTruthy();
    expect(screen.getByText('Agreed to use Neon PostgreSQL as primary database')).toBeTruthy();

    // Work Allocation
    expect(screen.getByText('Work Allocation')).toBeTruthy();
    expect(screen.getByText('Sarah Connor')).toBeTruthy();
    expect(screen.getByText('Oversee database architecture')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('Configure connection pooler')).toBeTruthy();

    // Action Items with deadlines
    expect(screen.getByText('Deploy schema migration')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Friday 5:00 PM')).toBeTruthy();
    expect(screen.getByText('Update API docs')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Not specified')).toBeTruthy();

    // Unresolved questions
    expect(screen.getByText('Unresolved Questions & Follow-ups')).toBeTruthy();
    expect(screen.getByText('Should we enable auto-scaling on weekends?')).toBeTruthy();
  });

  it('shows clear loading state while a summary is actively generating', () => {
    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        isGeneratingSummary={true}
      />
    );

    // Switch to Summary tab
    const summaryTab = screen.getByRole('button', { name: /^Summary/ });
    fireEvent.click(summaryTab);

    expect(screen.getByText('Synthesizing Meeting Summary...')).toBeTruthy();
  });

  it('displays a helpful message when waiting for sufficient transcript to generate a summary', () => {
    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        latestSummary={null}
        isGeneratingSummary={false}
      />
    );

    // Switch to Summary tab
    const summaryTab = screen.getByRole('button', { name: /^Summary/ });
    fireEvent.click(summaryTab);

    expect(screen.getByText('No Summary Generated Yet')).toBeTruthy();
    expect(screen.getByText(/Waiting for sufficient transcript/i)).toBeTruthy();
  });

  it('displays the exact required summary paused message when free-tier limit is reached', () => {
    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        summaryStatus={AI_STATUS.PAUSED}
        pauseReason="quota_exhausted"
      />
    );

    expect(
      screen.getByText(
        'AI summaries are paused because the free-tier limit has been reached. Your meeting can continue normally.'
      )
    ).toBeTruthy();
  });

  it('displays the exact required transcription paused message when transcription limit is reached', () => {
    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        transcriptionStatus={AI_STATUS.PAUSED}
        transcriptionPauseReason="quota_exhausted"
      />
    );

    expect(
      screen.getByText('AI transcription is paused because the free-tier limit has been reached.')
    ).toBeTruthy();
  });

  it('displays a useful error message when activation fails and does not leave standby', async () => {
    const failingToggle = vi
      .fn()
      .mockRejectedValue(new Error('Network connection error: server unreachable.'));
    render(<AssistantPanel {...baseProps} onToggleAI={failingToggle} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const button = screen.getByRole('button', { name: /Enable AI Assistant/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Network connection error: server unreachable.')).toBeTruthy();
    });
    expect(screen.getByText('Standby')).toBeTruthy();
  });

  it('normalizes raw epoch timestamps without rendering malformed numbers like 29866500:09', () => {
    const rawEpoch = 1791990009129; // UNIX epoch milliseconds
    const rawEpochNext = 1791990015144;
    const transcripts = [
      {
        id: 't-epoch-1',
        speakerIdentity: 'user_1791989961849_6d8bc4d9',
        speakerName: 'Om',
        text: 'Hello, welcome to today’s meeting.',
        startTimeMs: rawEpoch,
      },
      {
        id: 't-epoch-2',
        speakerIdentity: 'user_1791989961849_6d8bc4d9',
        speakerName: 'Om',
        text: 'Today I want to talk about technology.',
        startTimeMs: rawEpochNext,
      },
    ];

    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        transcripts={transcripts}
      />
    );

    // Must NOT contain the malformed 29866500:09 string
    expect(screen.queryByText(/29866500/)).toBeNull();
    // Must format as elapsed meeting time MM:SS
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText('00:06')).toBeTruthy();
  });

  it('formats elapsed timestamps as HH:MM:SS when meeting exceeds one hour', () => {
    const transcripts = [
      {
        id: 't-hour-1',
        speakerIdentity: 'user-1',
        speakerName: 'Sarah',
        text: 'Concluding our third review session.',
        startTimeMs: 3665000, // 1 hour, 1 minute, 5 seconds
      },
    ];

    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        transcripts={transcripts}
      />
    );

    expect(screen.getByText('01:01:05')).toBeTruthy();
  });

  it('displays Unknown speaker rather than inventing a name or displaying raw user_ identity', () => {
    const transcripts = [
      {
        id: 't-anon-1',
        speakerIdentity: 'user_1791989961849_anonymous',
        speakerName: '',
        text: 'Can everyone hear me clearly?',
        startTimeMs: 12000,
      },
    ];

    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        transcripts={transcripts}
      />
    );

    expect(screen.getByText('Unknown speaker')).toBeTruthy();
    expect(screen.queryByText('user_1791989961849_anonymous')).toBeNull();
  });

  it('keeps the transcript badge counter consistent with the number of displayed finalized segments', () => {
    const transcripts = [
      { id: '1', speakerIdentity: 'a', speakerName: 'Alice', text: 'One', startTimeMs: 0 },
      { id: '2', speakerIdentity: 'b', speakerName: 'Bob', text: 'Two', startTimeMs: 6000 },
      { id: '3', speakerIdentity: 'a', speakerName: 'Alice', text: 'Three', startTimeMs: 12000 },
    ];

    render(
      <AssistantPanel
        {...baseProps}
        isActive={true}
        consentGranted={true}
        transcripts={transcripts}
      />
    );

    expect(screen.getByText('3')).toBeTruthy();
  });
});

