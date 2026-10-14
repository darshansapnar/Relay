import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AccessToken } from 'livekit-server-sdk';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import { saveMessage, clearRoomData, registerMembership } from '../db/chatRepo.js';
import { chatRateLimiter } from '../services/chatRateLimiter.js';
import { closePool } from '../db/index.js';
import { CHAT_MESSAGE_TYPES } from '@relay/shared';

describe('Chat REST endpoints', () => {
  let server;
  let baseUrl;

  const apiKey = config.livekit.apiKey || 'test_api_key';
  const apiSecret = config.livekit.apiSecret || 'test_secret_123456789012345678901234567890';

  beforeAll(async () => {
    config.livekit.apiKey = apiKey;
    config.livekit.apiSecret = apiSecret;
    config.livekit.isConfigured = true;

    const app = createApp();
    server = http.createServer(app);

    await new Promise(resolve => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/meetings`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await clearRoomData('auth-room');
    await clearRoomData('send-room');
    await new Promise(resolve => server.close(resolve));
    await closePool();
  });

  beforeEach(async () => {
    await clearRoomData('auth-room');
    await clearRoomData('send-room');
    chatRateLimiter.reset();
  });

  const createToken = async ({ identity, name, roomName }) => {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '1h',
    });
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true });
    return at.toJwt();
  };

  it('rejects GET messages without Authorization header with 401', async () => {
    const res = await fetch(`${baseUrl}/room-1/messages`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('rejects GET messages when token is scoped to a different room with 403', async () => {
    const token = await createToken({
      identity: 'user-alice',
      name: 'Alice',
      roomName: 'other-room',
    });

    const res = await fetch(`${baseUrl}/target-room/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('retrieves only authorized messages for the participant from PostgreSQL', async () => {
    const roomName = 'auth-room';
    const aliceToken = await createToken({ identity: 'alice', name: 'Alice', roomName });
    const bobToken = await createToken({ identity: 'bob', name: 'Bob', roomName });
    const eveToken = await createToken({ identity: 'eve', name: 'Eve', roomName });

    // Pre-register memberships
    await registerMembership({ roomName, participantIdentity: 'alice', participantName: 'Alice' });
    await registerMembership({ roomName, participantIdentity: 'bob', participantName: 'Bob' });
    await registerMembership({ roomName, participantIdentity: 'eve', participantName: 'Eve' });

    // Store everyone message
    await saveMessage({
      roomName,
      senderIdentity: 'alice',
      senderName: 'Alice',
      content: 'Hello team',
      targetType: CHAT_MESSAGE_TYPES.EVERYONE,
    });

    // Store direct message from Alice to Bob
    await saveMessage({
      roomName,
      senderIdentity: 'alice',
      senderName: 'Alice',
      recipientIdentity: 'bob',
      recipientName: 'Bob',
      content: 'Alice whispers to Bob',
      targetType: CHAT_MESSAGE_TYPES.DIRECT,
    });

    // Eve queries messages: Eve MUST NOT see Alice & Bob's private message
    const eveRes = await fetch(`${baseUrl}/${roomName}/messages`, {
      headers: { Authorization: `Bearer ${eveToken}` },
    });
    expect(eveRes.status).toBe(200);
    const eveData = await eveRes.json();
    expect(eveData.success).toBe(true);
    expect(eveData.messages).toHaveLength(1);
    expect(eveData.messages[0].content).toBe('Hello team');

    // Bob queries messages: Bob sees Everyone message + direct message from Alice
    const bobRes = await fetch(`${baseUrl}/${roomName}/messages`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(bobRes.status).toBe(200);
    const bobData = await bobRes.json();
    expect(bobData.success).toBe(true);
    expect(bobData.messages).toHaveLength(2);
    expect(bobData.messages.map(m => m.content)).toContain('Alice whispers to Bob');

    // Alice queries messages: Alice (sender) also sees her own sent direct message
    const aliceRes = await fetch(`${baseUrl}/${roomName}/messages`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    expect(aliceRes.status).toBe(200);
    const aliceData = await aliceRes.json();
    expect(aliceData.success).toBe(true);
    expect(aliceData.messages).toHaveLength(2);
  });

  it('sends message via POST, persists in PostgreSQL and enforces validation', async () => {
    const roomName = 'send-room';
    const aliceToken = await createToken({ identity: 'alice', name: 'Alice', roomName });

    // Send valid message
    const validRes = await fetch(`${baseUrl}/${roomName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        content: 'Posting via REST',
        targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      }),
    });
    expect(validRes.status).toBe(201);
    const validData = await validRes.json();
    expect(validData.success).toBe(true);
    expect(validData.message.content).toBe('Posting via REST');
    expect(validData.message.id).toBeDefined();

    // Send empty message
    const emptyRes = await fetch(`${baseUrl}/${roomName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        content: '   ',
        targetType: CHAT_MESSAGE_TYPES.EVERYONE,
      }),
    });
    expect(emptyRes.status).toBe(400);
    const emptyData = await emptyRes.json();
    expect(emptyData.success).toBe(false);
  });
});
