import { describe, expect, it, beforeEach } from 'vitest';
import { chatStore } from './chatStore.js';
import { CHAT_MESSAGE_TYPES } from '@relay/shared';

describe('chatStore message persistence and authorization', () => {
  beforeEach(() => {
    chatStore.clearAll();
  });

  it('persists and retrieves everyone messages for any room participant', () => {
    const msg = chatStore.addMessage({
      roomName: 'room-1',
      senderIdentity: 'user-alice',
      senderName: 'Alice',
      content: 'Hello everyone!',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    expect(msg.id).toBeDefined();
    expect(msg.content).toBe('Hello everyone!');
    expect(msg.targetType).toBe('everyone');
    expect(msg.createdAt).toBeDefined();

    const aliceMessages = chatStore.getAuthorizedMessages('room-1', 'user-alice');
    const bobMessages = chatStore.getAuthorizedMessages('room-1', 'user-bob');

    expect(aliceMessages).toHaveLength(1);
    expect(bobMessages).toHaveLength(1);
    expect(bobMessages[0].content).toBe('Hello everyone!');
  });

  it('restricts direct messages strictly to sender and recipient', () => {
    // Alice sends direct message to Bob
    chatStore.addMessage({
      roomName: 'room-1',
      senderIdentity: 'user-alice',
      senderName: 'Alice',
      recipientIdentity: 'user-bob',
      recipientName: 'Bob',
      content: 'Secret direct message to Bob',
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
    });

    // Public message to everyone
    chatStore.addMessage({
      roomName: 'room-1',
      senderIdentity: 'user-charlie',
      senderName: 'Charlie',
      content: 'Public announcement',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    // Alice sees her own DM to Bob + public message
    const aliceMessages = chatStore.getAuthorizedMessages('room-1', 'user-alice');
    expect(aliceMessages).toHaveLength(2);
    expect(aliceMessages.map(m => m.content)).toEqual([
      'Secret direct message to Bob',
      'Public announcement',
    ]);

    // Bob sees the DM from Alice + public message
    const bobMessages = chatStore.getAuthorizedMessages('room-1', 'user-bob');
    expect(bobMessages).toHaveLength(2);
    expect(bobMessages.map(m => m.content)).toEqual([
      'Secret direct message to Bob',
      'Public announcement',
    ]);

    // Charlie sees ONLY the public message, never the DM between Alice and Bob
    const charlieMessages = chatStore.getAuthorizedMessages('room-1', 'user-charlie');
    expect(charlieMessages).toHaveLength(1);
    expect(charlieMessages[0].content).toBe('Public announcement');
  });

  it('deduplicates messages with identical clientMessageId from the same sender', () => {
    const first = chatStore.addMessage({
      roomName: 'room-1',
      clientMessageId: 'client-uuid-123',
      senderIdentity: 'user-alice',
      senderName: 'Alice',
      content: 'Test deduplication',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    const second = chatStore.addMessage({
      roomName: 'room-1',
      clientMessageId: 'client-uuid-123',
      senderIdentity: 'user-alice',
      senderName: 'Alice',
      content: 'Test deduplication',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    expect(first.id).toBe(second.id);
    const messages = chatStore.getAuthorizedMessages('room-1', 'user-alice');
    expect(messages).toHaveLength(1);
  });

  it('isolates messages between distinct rooms', () => {
    chatStore.addMessage({
      roomName: 'room-alpha',
      senderIdentity: 'user-alice',
      senderName: 'Alice',
      content: 'Message in alpha',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    chatStore.addMessage({
      roomName: 'room-beta',
      senderIdentity: 'user-bob',
      senderName: 'Bob',
      content: 'Message in beta',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    const alphaMessages = chatStore.getAuthorizedMessages('room-alpha', 'user-alice');
    const betaMessages = chatStore.getAuthorizedMessages('room-beta', 'user-bob');

    expect(alphaMessages).toHaveLength(1);
    expect(alphaMessages[0].content).toBe('Message in alpha');

    expect(betaMessages).toHaveLength(1);
    expect(betaMessages[0].content).toBe('Message in beta');
  });

  it('clears room messages when meeting ends', () => {
    chatStore.addMessage({
      roomName: 'room-to-clear',
      senderIdentity: 'user-1',
      senderName: 'Host',
      content: 'Test',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    expect(chatStore.getAuthorizedMessages('room-to-clear', 'user-1')).toHaveLength(1);

    chatStore.clearRoom('room-to-clear');
    expect(chatStore.getAuthorizedMessages('room-to-clear', 'user-1')).toHaveLength(0);
  });
});
