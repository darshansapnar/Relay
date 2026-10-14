import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { AccessToken } from 'livekit-server-sdk';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import { setupChatSocket } from './chatSocket.js';
import { clearRoomData, registerMembership } from '../db/chatRepo.js';
import { chatRateLimiter } from './chatRateLimiter.js';
import { closePool } from '../db/index.js';
import { CHAT_EVENTS, CHAT_MESSAGE_TYPES } from '@relay/shared';

describe('chatSocket Socket.IO real-time server', () => {
  let server;
  let ioServer;
  let serverPort;
  let baseUrl;

  // Use configured livekit credentials or fallback test keys
  const apiKey = config.livekit.apiKey || 'test_api_key';
  const apiSecret = config.livekit.apiSecret || 'test_secret_123456789012345678901234567890';

  beforeAll(async () => {
    config.livekit.apiKey = apiKey;
    config.livekit.apiSecret = apiSecret;
    config.livekit.isConfigured = true;

    const app = createApp();
    server = http.createServer(app);
    ioServer = setupChatSocket(server);

    await new Promise(resolve => {
      server.listen(0, () => {
        serverPort = server.address().port;
        baseUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await clearRoomData('room-1');
    await clearRoomData('room-dm-test');
    await clearRoomData('room-north');
    await clearRoomData('room-south');
    await clearRoomData('room-val');
    await new Promise(resolve => ioServer.close(resolve));
    await new Promise(resolve => server.close(resolve));
    await closePool();
  });

  beforeEach(async () => {
    await clearRoomData('room-1');
    await clearRoomData('room-dm-test');
    await clearRoomData('room-north');
    await clearRoomData('room-south');
    await clearRoomData('room-val');
    chatRateLimiter.reset();
  });

  const createToken = async ({ identity, name, roomName, isHost = false }) => {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '1h',
      attributes: { role: isHost ? 'host' : 'participant' },
    });
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true });
    return at.toJwt();
  };

  const connectClient = (token, roomName) => {
    return new Promise((resolve, reject) => {
      const socket = Client(baseUrl, {
        auth: { token, roomName },
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', err => reject(err));
    });
  };

  it('rejects connection when token is missing', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const socket = Client(baseUrl, {
          auth: { roomName: 'room-1' },
          transports: ['websocket'],
          reconnection: false,
        });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', err => reject(err));
      })
    ).rejects.toThrow();
  });

  it('rejects connection when token is scoped to a different room', async () => {
    const token = await createToken({
      identity: 'user-alice',
      name: 'Alice',
      roomName: 'room-allowed',
    });

    await expect(connectClient(token, 'room-tampered')).rejects.toThrow();
  });

  it('delivers everyone messages to all participants in the same room', async () => {
    const aliceToken = await createToken({
      identity: 'user-alice',
      name: 'Alice',
      roomName: 'room-1',
    });
    const bobToken = await createToken({
      identity: 'user-bob',
      name: 'Bob',
      roomName: 'room-1',
    });

    const aliceSocket = await connectClient(aliceToken, 'room-1');
    const bobSocket = await connectClient(bobToken, 'room-1');

    try {
      const bobReceivedPromise = new Promise(resolve => {
        bobSocket.on(CHAT_EVENTS.NEW_MESSAGE, msg => {
          resolve(msg);
        });
      });

      const ackResponse = await new Promise(resolve => {
        aliceSocket.emit(
          CHAT_EVENTS.SEND_MESSAGE,
          {
            content: 'Hello everyone in room 1!',
            targetType: CHAT_MESSAGE_TYPES.EVERYONE,
            clientMessageId: 'msg-client-1',
          },
          ack => resolve(ack)
        );
      });

      expect(ackResponse.success).toBe(true);
      expect(ackResponse.message.content).toBe('Hello everyone in room 1!');
      expect(ackResponse.message.senderIdentity).toBe('user-alice');
      expect(ackResponse.message.senderName).toBe('Alice');

      const receivedByBob = await bobReceivedPromise;
      expect(receivedByBob.content).toBe('Hello everyone in room 1!');
      expect(receivedByBob.senderIdentity).toBe('user-alice');
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
    }
  });

  it('delivers private direct messages ONLY to recipient and sender, keeping it hidden from others', async () => {
    const aliceToken = await createToken({
      identity: 'user-alice',
      name: 'Alice',
      roomName: 'room-dm-test',
    });
    const bobToken = await createToken({
      identity: 'user-bob',
      name: 'Bob',
      roomName: 'room-dm-test',
    });
    const charlieToken = await createToken({
      identity: 'user-charlie',
      name: 'Charlie',
      roomName: 'room-dm-test',
    });

    const aliceSocket = await connectClient(aliceToken, 'room-dm-test');
    const bobSocket = await connectClient(bobToken, 'room-dm-test');
    const charlieSocket = await connectClient(charlieToken, 'room-dm-test');

    // Register Bob's membership in PostgreSQL
    await registerMembership({
      roomName: 'room-dm-test',
      participantIdentity: 'user-bob',
      participantName: 'Bob',
    });

    try {
      let charlieReceivedAnyMessage = false;
      charlieSocket.on(CHAT_EVENTS.NEW_MESSAGE, () => {
        charlieReceivedAnyMessage = true;
      });

      const bobReceivedPromise = new Promise(resolve => {
        bobSocket.on(CHAT_EVENTS.NEW_MESSAGE, msg => {
          resolve(msg);
        });
      });

      const ack = await new Promise(resolve => {
        aliceSocket.emit(
          CHAT_EVENTS.SEND_MESSAGE,
          {
            content: 'Secret direct message for Bob only',
            targetType: CHAT_MESSAGE_TYPES.DIRECT,
            recipientIdentity: 'user-bob',
            recipientName: 'Bob',
          },
          resolve
        );
      });

      expect(ack.success).toBe(true);
      expect(ack.message.targetType).toBe('direct');
      expect(ack.message.recipientIdentity).toBe('user-bob');

      const bobReceived = await bobReceivedPromise;
      expect(bobReceived.content).toBe('Secret direct message for Bob only');
      expect(bobReceived.senderIdentity).toBe('user-alice');

      // Wait a moment to confirm Charlie never received anything
      await new Promise(r => setTimeout(r, 150));
      expect(charlieReceivedAnyMessage).toBe(false);

      // Verify history filtering: Charlie's history does not include Alice & Bob's DM
      const charlieHistory = await new Promise(resolve => {
        charlieSocket.emit(CHAT_EVENTS.GET_HISTORY, resolve);
      });
      expect(charlieHistory.messages).toHaveLength(0);

      // But Bob's history DOES include the DM
      const bobHistory = await new Promise(resolve => {
        bobSocket.emit(CHAT_EVENTS.GET_HISTORY, resolve);
      });
      expect(bobHistory.messages).toHaveLength(1);
      expect(bobHistory.messages[0].content).toBe('Secret direct message for Bob only');
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
      charlieSocket.disconnect();
    }
  });

  it('isolates messages between separate rooms', async () => {
    const aliceToken = await createToken({
      identity: 'user-alice',
      name: 'Alice',
      roomName: 'room-north',
    });
    const daveToken = await createToken({
      identity: 'user-dave',
      name: 'Dave',
      roomName: 'room-south',
    });

    const aliceSocket = await connectClient(aliceToken, 'room-north');
    const daveSocket = await connectClient(daveToken, 'room-south');

    try {
      let daveReceivedMessage = false;
      daveSocket.on(CHAT_EVENTS.NEW_MESSAGE, () => {
        daveReceivedMessage = true;
      });

      await new Promise(resolve => {
        aliceSocket.emit(
          CHAT_EVENTS.SEND_MESSAGE,
          {
            content: 'North room exclusive',
            targetType: CHAT_MESSAGE_TYPES.EVERYONE,
          },
          resolve
        );
      });

      await new Promise(r => setTimeout(r, 100));
      expect(daveReceivedMessage).toBe(false);
    } finally {
      aliceSocket.disconnect();
      daveSocket.disconnect();
    }
  });

  it('rejects invalid empty message via socket ack', async () => {
    const token = await createToken({
      identity: 'user-alice',
      name: 'Alice',
      roomName: 'room-val',
    });
    const socket = await connectClient(token, 'room-val');

    try {
      const ack = await new Promise(resolve => {
        socket.emit(
          CHAT_EVENTS.SEND_MESSAGE,
          {
            content: '    ',
            targetType: CHAT_MESSAGE_TYPES.EVERYONE,
          },
          resolve
        );
      });

      expect(ack.success).toBe(false);
      expect(ack.code).toBe('VALIDATION_ERROR');
    } finally {
      socket.disconnect();
    }
  });
});
