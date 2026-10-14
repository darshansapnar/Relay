import { CHAT_MESSAGE_TYPES, CHAT_CONFIG } from '@relay/shared';

/**
 * Validates and sanitizes chat message payloads.
 *
 * @param {object} params
 * @param {string} params.content - Raw message text
 * @param {string} [params.targetType] - 'everyone' | 'direct'
 * @param {string} [params.recipientIdentity] - Required if targetType is 'direct'
 * @param {string} params.senderIdentity - Verified sender identity
 * @returns {{ valid: boolean, error?: string, sanitizedContent?: string }}
 */
export const validateChatMessage = ({
  content,
  targetType = CHAT_MESSAGE_TYPES.EVERYONE,
  recipientIdentity = null,
  senderIdentity,
}) => {
  // 1. Content type check
  if (typeof content !== 'string') {
    return { valid: false, error: 'Message content must be a string.' };
  }

  // 2. Trim and check empty
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message content cannot be empty.' };
  }

  // 3. Max length check
  const maxLength = CHAT_CONFIG.MAX_CONTENT_LENGTH || 1000;
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `Message content exceeds maximum allowed length of ${maxLength} characters.`,
    };
  }

  // 4. Strip dangerous non-printable control characters (keep newlines \n, \r, and \t)
  // Control characters \x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F
  // eslint-disable-next-line no-control-regex
  const sanitizedContent = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  if (sanitizedContent.length === 0) {
    return { valid: false, error: 'Message content contains only invalid characters.' };
  }

  // 5. Target type check
  if (targetType !== CHAT_MESSAGE_TYPES.EVERYONE && targetType !== CHAT_MESSAGE_TYPES.DIRECT) {
    return {
      valid: false,
      error: `Invalid targetType: '${targetType}'. Must be 'everyone' or 'direct'.`,
    };
  }

  // 6. Direct message checks
  if (targetType === CHAT_MESSAGE_TYPES.DIRECT) {
    if (!recipientIdentity || typeof recipientIdentity !== 'string' || !recipientIdentity.trim()) {
      return {
        valid: false,
        error: 'Recipient identity is required for private direct messages.',
      };
    }

    if (recipientIdentity.trim() === senderIdentity) {
      return {
        valid: false,
        error: 'You cannot send a private direct message to yourself.',
      };
    }
  }

  return {
    valid: true,
    sanitizedContent,
  };
};
