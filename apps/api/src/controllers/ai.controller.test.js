import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AccessToken } from 'livekit-server-sdk';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import { clearAIRoomData } from '../db/aiRepo.js';
import { closePool } from '../db/index.js';

describe('AI REST Endpoints', () => {
  let server;
  let baseUrl;

  const apiKey = config.livekit.apiKey || 'test_api_key';
  const apiSecret = config.livekit.apiSecret || 'test_secret_123456789012345678901234567890';
  const testRoom = 'ai-api-test-room';

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
    await clearAIRoomData(testRoom);
    await new Promise(resolve => server.close(resolve));
    await closePool();
  });

  beforeEach(async () => {
    await clearAIRoomData(testRoom);
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

  it('rejects GET /ai/state without Authorization header with 401', async () => {
    const res = await fetch(`${baseUrl}/${testRoom}/ai/state`);
    expect(res.status).toBe(401);
  });

  it('rejects GET /ai/state when token is scoped to a different room with 403', async () => {
    const foreignToken = await createToken({
      identity: 'alice',
      name: 'Alice',
      roomName: 'other-room',
    });

    const res = await fetch(`${baseUrl}/${testRoom}/ai/state`, {
      headers: { Authorization: `Bearer ${foreignToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('requires participant consent before activating AI assistant', async () => {
    const token = await createToken({
      identity: 'host-user',
      name: 'Host User',
      roomName: testRoom,
    });

    // Attempt to activate without consent
    const res = await fetch(`${baseUrl}/${testRoom}/ai/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: true, consentGranted: false }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('consent is required');
  });

  it('activates AI assistant when consent is granted', async () => {
    const token = await createToken({
      identity: 'host-user',
      name: 'Host User',
      roomName: testRoom,
    });

    const res = await fetch(`${baseUrl}/${testRoom}/ai/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: true, consentGranted: true }),
    });

    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state.isActive).toBe(true);
    expect(state.consentGranted).toBe(true);
    expect(state.transcriptionStatus).toBe('active');
  });

  it('persists and retrieves transcripts via REST endpoints', async () => {
    const token = await createToken({
      identity: 'participant-bob',
      name: 'Bob',
      roomName: testRoom,
    });

    // First activate AI with consent
    await fetch(`${baseUrl}/${testRoom}/ai/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: true, consentGranted: true }),
    });

    // Post a transcript segment
    const postRes = await fetch(`${baseUrl}/${testRoom}/ai/transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: 'The new feature is deployed to production.',
        startTimeMs: 5000,
        endTimeMs: 9000,
      }),
    });

    expect(postRes.status).toBe(201);
    const saved = await postRes.json();
    expect(saved.speakerName).toBe('Bob');
    expect(saved.text).toBe('The new feature is deployed to production.');

    // Fetch transcripts
    const getRes = await fetch(`${baseUrl}/${testRoom}/ai/transcripts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.transcripts.length).toBe(1);
    expect(body.transcripts[0].text).toContain('deployed to production');
  });
});
