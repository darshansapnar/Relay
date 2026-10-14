import { describe, expect, it } from 'vitest';
import { validateChatMessage } from './chatValidator.js';
import { CHAT_MESSAGE_TYPES, CHAT_CONFIG } from '@relay/shared';

describe('validateChatMessage', () => {
  it('accepts valid everyone messages', () => {
    const result = validateChatMessage({
      content: 'Hello everyone!',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(true);
    expect(result.sanitizedContent).toBe('Hello everyone!');
  });

  it('accepts valid direct messages with distinct recipient', () => {
    const result = validateChatMessage({
      content: 'Private note',
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
      recipientIdentity: 'user-2',
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(true);
    expect(result.sanitizedContent).toBe('Private note');
  });

  it('rejects empty or whitespace-only messages', () => {
    const emptyResult = validateChatMessage({
      content: '',
      senderIdentity: 'user-1',
    });
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toContain('cannot be empty');

    const whitespaceResult = validateChatMessage({
      content: '   \n   \t  ',
      senderIdentity: 'user-1',
    });
    expect(whitespaceResult.valid).toBe(false);
    expect(whitespaceResult.error).toContain('cannot be empty');
  });

  it('rejects non-string content', () => {
    const nullResult = validateChatMessage({
      content: null,
      senderIdentity: 'user-1',
    });
    expect(nullResult.valid).toBe(false);

    const objResult = validateChatMessage({
      content: { text: 'hi' },
      senderIdentity: 'user-1',
    });
    expect(objResult.valid).toBe(false);
  });

  it('rejects messages exceeding max length', () => {
    const maxLen = CHAT_CONFIG.MAX_CONTENT_LENGTH || 2000;
    const longText = 'a'.repeat(maxLen + 1);
    const result = validateChatMessage({
      content: longText,
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maximum allowed length');
  });

  it('rejects direct messages with missing recipient', () => {
    const result = validateChatMessage({
      content: 'Private note',
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
      recipientIdentity: null,
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Recipient identity is required');
  });

  it('rejects direct messages addressed to oneself', () => {
    const result = validateChatMessage({
      content: 'Self talk',
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
      recipientIdentity: 'user-1',
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot send a private direct message to yourself');
  });

  it('rejects invalid target types', () => {
    const result = validateChatMessage({
      content: 'Hello',
      targetType: 'broadcast_all',
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid targetType');
  });

  it('sanitizes control characters while preserving unicode and emoji', () => {
    const input = 'Hello\x00 World! \u{1F600} \nLine 2';
    const result = validateChatMessage({
      content: input,
      senderIdentity: 'user-1',
    });
    expect(result.valid).toBe(true);
    expect(result.sanitizedContent).toContain('Hello World! 😀 \nLine 2');
    expect(result.sanitizedContent).not.toContain('\x00');
  });
});
