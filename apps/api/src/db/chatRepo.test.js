import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  saveMessage,
  getAuthorizedMessages,
  registerMembership,
  isParticipantInMeeting,
  markReadState,
  getUnreadCounts,
  clearRoomData,
} from './chatRepo.js';
import { closePool } from './index.js';
import { config } from '../config/index.js';
import { CHAT_MESSAGE_TYPES } from '@relay/shared';

describe('chatRepo PostgreSQL repository', () => {
  const roomName = 'test-repo-room';

  beforeAll(async () => {
    if (!config.database.isConfigured) return;
    await clearRoomData(roomName);
  });

  afterAll(async () => {
    if (!config.database.isConfigured) return;
    await clearRoomData(roomName);
    await closePool();
  });

  beforeEach(async () => {
    if (!config.database.isConfigured) return;
    await clearRoomData(roomName);
  });

  it('registers and checks meeting membership', async () => {
    if (!config.database.isConfigured) return;

    const membership = await registerMembership({
      roomName,
      participantIdentity: 'alice-id',
      participantName: 'Alice',
      isHost: true,
    });

    expect(membership).toBeDefined();
    expect(membership.room_name).toBe(roomName);
    expect(membership.participant_identity).toBe('alice-id');
    expect(membership.is_host).toBe(true);

    const isMember = await isParticipantInMeeting(roomName, 'alice-id');
    expect(isMember).toBe(true);

    const isNonMember = await isParticipantInMeeting(roomName, 'stranger-id');
    expect(isNonMember).toBe(false);
  });

  it('persists and deduplicates messages using clientMessageId', async () => {
    if (!config.database.isConfigured) return;

    const msg1 = await saveMessage({
      roomName,
      clientMessageId: 'client-dedup-1',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      senderIdentity: 'alice-id',
      senderName: 'Alice',
      content: 'Hello everyone!',
    });

    expect(msg1.id).toBeDefined();
    expect(msg1.content).toBe('Hello everyone!');
    expect(msg1.clientMessageId).toBe('client-dedup-1');

    // Attempt to save identical clientMessageId (e.g. network retry)
    const msg2 = await saveMessage({
      roomName,
      clientMessageId: 'client-dedup-1',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      senderIdentity: 'alice-id',
      senderName: 'Alice',
      content: 'Hello everyone!',
    });

    // Should return existing record with same ID
    expect(msg2.id).toBe(msg1.id);
  });

  it('strictly isolates private direct messages from third participants', async () => {
    if (!config.database.isConfigured) return;

    // Save public everyone message
    await saveMessage({
      roomName,
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      senderIdentity: 'alice-id',
      senderName: 'Alice',
      content: 'Public announcement',
    });

    // Save private direct message from Alice to Bob
    await saveMessage({
      roomName,
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
      senderIdentity: 'alice-id',
      senderName: 'Alice',
      recipientIdentity: 'bob-id',
      recipientName: 'Bob',
      content: 'Alice whispers to Bob',
    });

    // 1. Charlie queries messages: MUST NOT see private message between Alice and Bob
    const charlieHistory = await getAuthorizedMessages({
      roomName,
      participantIdentity: 'charlie-id',
    });
    expect(charlieHistory.messages).toHaveLength(1);
    expect(charlieHistory.messages[0].content).toBe('Public announcement');

    // 2. Bob queries messages: sees public announcement + private whisper from Alice
    const bobHistory = await getAuthorizedMessages({
      roomName,
      participantIdentity: 'bob-id',
    });
    expect(bobHistory.messages).toHaveLength(2);
    const contents = bobHistory.messages.map(m => m.content);
    expect(contents).toContain('Public announcement');
    expect(contents).toContain('Alice whispers to Bob');

    // 3. Alice (sender) queries messages: sees public announcement + her sent private whisper
    const aliceHistory = await getAuthorizedMessages({
      roomName,
      participantIdentity: 'alice-id',
    });
    expect(aliceHistory.messages).toHaveLength(2);
  });

  it('supports pagination with limit and chronological ordering', async () => {
    if (!config.database.isConfigured) return;

    for (let i = 1; i <= 5; i++) {
      await saveMessage({
        roomName,
        targetType: CHAT_MESSAGE_TYPES.EVERYONE,
        senderIdentity: 'alice-id',
        senderName: 'Alice',
        content: `Message ${i}`,
      });
      // slight delay to ensure distinct timestamps
      await new Promise(r => setTimeout(r, 10));
    }

    // Retrieve page of 3 messages
    const page1 = await getAuthorizedMessages({
      roomName,
      participantIdentity: 'alice-id',
      limit: 3,
    });

    expect(page1.messages).toHaveLength(3);
    expect(page1.hasMore).toBe(true);
    // Messages must be chronologically ordered (oldest to newest)
    expect(page1.messages[0].content).toBe('Message 3');
    expect(page1.messages[1].content).toBe('Message 4');
    expect(page1.messages[2].content).toBe('Message 5');

    // Load older messages before page1's oldest
    const page2 = await getAuthorizedMessages({
      roomName,
      participantIdentity: 'alice-id',
      limit: 3,
      before: page1.messages[0].createdAt,
    });

    expect(page2.messages).toHaveLength(2);
    expect(page2.messages[0].content).toBe('Message 1');
    expect(page2.messages[1].content).toBe('Message 2');
    expect(page2.hasMore).toBe(false);
  });

  it('tracks read state and calculates unread counts accurately', async () => {
    if (!config.database.isConfigured) return;

    // Send everyone message from Bob
    const bobPublic = await saveMessage({
      roomName,
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      senderIdentity: 'bob-id',
      senderName: 'Bob',
      content: 'Bob says hi',
    });

    // Send direct message from Bob to Alice
    const bobDirect = await saveMessage({
      roomName,
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
      senderIdentity: 'bob-id',
      senderName: 'Bob',
      recipientIdentity: 'alice-id',
      recipientName: 'Alice',
      content: 'Bob private to Alice',
    });

    // Alice checks unread counts
    let unread = await getUnreadCounts(roomName, 'alice-id');
    expect(unread.everyone).toBe(1);
    expect(unread.directTotal).toBe(1);
    expect(unread.directByPeer['bob-id']).toBe(1);

    // Alice marks everyone read
    await markReadState({
      roomName,
      participantIdentity: 'alice-id',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      lastReadMessageId: bobPublic.id,
    });

    unread = await getUnreadCounts(roomName, 'alice-id');
    expect(unread.everyone).toBe(0);
    expect(unread.directTotal).toBe(1);

    // Alice marks direct from Bob read
    await markReadState({
      roomName,
      participantIdentity: 'alice-id',
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
      peerIdentity: 'bob-id',
      lastReadMessageId: bobDirect.id,
    });

    unread = await getUnreadCounts(roomName, 'alice-id');
    expect(unread.everyone).toBe(0);
    expect(unread.directTotal).toBe(0);
  });
});
