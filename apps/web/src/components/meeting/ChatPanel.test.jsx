// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatPanel } from './ChatPanel.jsx';
import { CHAT_MESSAGE_TYPES } from '@relay/shared';

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

const mockLocalParticipant = {
  identity: 'local-user',
  name: 'Local User',
  isLocal: true,
};

const mockRemoteParticipant = {
  identity: 'remote-bob',
  name: 'Bob Ross',
  isLocal: false,
  attributes: { role: 'participant' },
};

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({ localParticipant: mockLocalParticipant }),
  useParticipants: () => [mockLocalParticipant, mockRemoteParticipant],
}));

describe('ChatPanel component', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    messages: [],
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    isConnected: true,
    isConnecting: false,
    connectionError: null,
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ChatPanel {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders empty state when there are no messages in Everyone view', () => {
    render(<ChatPanel {...baseProps} />);
    expect(screen.getByText('In-Meeting Chat')).toBeTruthy();
    expect(screen.getByText('Everyone Chat')).toBeTruthy();
    expect(screen.getByText(/No messages yet/i)).toBeTruthy();
  });

  it('renders everyone messages correctly with sender name and content', () => {
    const messages = [
      {
        id: 'msg-1',
        senderIdentity: 'remote-bob',
        senderName: 'Bob Ross',
        content: 'Welcome to the meeting!',
        targetType: CHAT_MESSAGE_TYPES.EVERYONE,
        timestamp: Date.now(),
      },
    ];

    render(<ChatPanel {...baseProps} messages={messages} />);
    expect(screen.getByText('Bob Ross')).toBeTruthy();
    expect(screen.getByText('Welcome to the meeting!')).toBeTruthy();
  });

  it('switches to Direct Messages tab and displays recipient selector', () => {
    render(<ChatPanel {...baseProps} />);

    // Click Direct Messages tab
    const dmTab = screen.getByRole('button', { name: /Direct Messages/i });
    fireEvent.click(dmTab);

    expect(screen.getByText(/Private chat with:/i)).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('renders direct messages with private badge indicator', () => {
    const messages = [
      {
        id: 'msg-dm-1',
        senderIdentity: 'remote-bob',
        senderName: 'Bob Ross',
        recipientIdentity: 'local-user',
        recipientName: 'Local User',
        content: 'Confidential message',
        targetType: CHAT_MESSAGE_TYPES.DIRECT,
        timestamp: Date.now(),
      },
    ];

    render(<ChatPanel {...baseProps} messages={messages} />);

    // Switch to direct tab
    fireEvent.click(screen.getByRole('button', { name: /Direct Messages/i }));

    expect(screen.getByText('Confidential message')).toBeTruthy();
    expect(screen.getByText('(Private)')).toBeTruthy();
  });

  it('sends an everyone message when typing and submitting form', async () => {
    const mockSend = vi.fn().mockResolvedValue({ success: true });
    render(<ChatPanel {...baseProps} sendMessage={mockSend} />);

    const textarea = screen.getByPlaceholderText(/Type a message to everyone/i);
    fireEvent.change(textarea, { target: { value: 'Hello team!' } });

    const sendBtn = screen.getByRole('button', { name: /Send/i });
    expect(sendBtn.disabled).toBe(false);

    fireEvent.click(sendBtn);

    expect(mockSend).toHaveBeenCalledWith({
      content: 'Hello team!',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      recipientIdentity: null,
      recipientName: null,
    });
  });

  it('displays connection error warning banner when disconnected', () => {
    render(
      <ChatPanel
        {...baseProps}
        isConnected={false}
        connectionError="Connection lost. Reconnecting to chat..."
      />
    );

    expect(screen.getByText('Connection lost. Reconnecting to chat...')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });
});
