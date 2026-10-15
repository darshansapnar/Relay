import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AccessToken } from 'livekit-server-sdk';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import { closePool } from '../db/index.js';

describe('Meeting Access Control REST & Security Endpoints', () => {
  let server;
  let baseUrl;

  const apiKey = config.livekit.apiKey || 'test_api_key';
  const apiSecret = config.livekit.apiSecret || 'test_secret_123456789012345678901234567890';
  const hostIdentity = 'host_user_test_123';
  const participantIdentity = 'guest_user_test_456';

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
    await new Promise(resolve => server.close(resolve));
    await closePool();
  });

  const createFreshRoom = () =>
    `ac-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const initHostMeeting = async (roomName, options = { waitingRoomEnabled: true }) => {
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName,
        participantName: 'Host Alice',
        participantIdentity: hostIdentity,
        waitingRoomEnabled: options.waitingRoomEnabled,
      }),
    });
    const data = await res.json();
    return { hostToken: data.token, roomName };
  };

  const createGuestToken = async ({ identity, name, roomName, role = 'participant' }) => {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '1h',
      attributes: { role },
    });
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true });
    return at.toJwt();
  };

  it('rejects host actions when caller provides no Authorization header with 401', async () => {
    const room = createFreshRoom();
    await initHostMeeting(room);

    const lockRes = await fetch(`${baseUrl}/${room}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: true }),
    });
    expect(lockRes.status).toBe(401);

    const waitingRes = await fetch(`${baseUrl}/${room}/waiting-room`);
    expect(waitingRes.status).toBe(401);
  });

  it('rejects privileged host actions from non-host participants with 403 Forbidden', async () => {
    const room = createFreshRoom();
    await initHostMeeting(room);

    const guestToken = await createGuestToken({
      identity: participantIdentity,
      name: 'Guest Alice',
      roomName: room,
      role: 'participant',
    });

    // 1. Guest attempts to lock meeting
    const lockRes = await fetch(`${baseUrl}/${room}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({ locked: true }),
    });
    expect(lockRes.status).toBe(403);
    const lockData = await lockRes.json();
    expect(lockData.error.message).toMatch(/Only the meeting host can perform this action/i);

    // 2. Guest attempts to list waiting room
    const waitingRes = await fetch(`${baseUrl}/${room}/waiting-room`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    expect(waitingRes.status).toBe(403);

    // 3. Guest attempts to remove host or others
    const removeRes = await fetch(`${baseUrl}/${room}/participants/${hostIdentity}/remove`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    expect(removeRes.status).toBe(403);
  });

  it('never trusts a client-supplied role flag to bypass host verification', async () => {
    const room = createFreshRoom();
    await initHostMeeting(room);

    // Participant forged attributes.role: 'host' in client token, but is NOT the server-recorded host identity
    const spoofedToken = await createGuestToken({
      identity: 'malicious_impostor_999',
      name: 'Impostor',
      roomName: room,
      role: 'host', // Attempt to spoof host role
    });

    const res = await fetch(`${baseUrl}/${room}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${spoofedToken}`,
      },
      body: JSON.stringify({ locked: true }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.message).toMatch(/Only the meeting host can perform this action/i);
  });

  it('prevents the host from removing themselves with 400 Bad Request', async () => {
    const room = createFreshRoom();
    const { hostToken } = await initHostMeeting(room);

    const res = await fetch(`${baseUrl}/${room}/participants/${hostIdentity}/remove`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toMatch(/host cannot remove themselves/i);
  });

  it('enforces waiting room on join: returns waiting status without LiveKit token until approved', async () => {
    const room = createFreshRoom();
    const { hostToken } = await initHostMeeting(room, { waitingRoomEnabled: true });
    const guestIdentity = 'guest_waiting_777';

    // 1. Participant requests to join room with waiting room enabled
    const joinRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room,
        participantName: 'Waiting Bob',
        participantIdentity: guestIdentity,
      }),
    });

    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json();
    expect(joinData.waiting).toBe(true);
    expect(joinData.status).toBe('waiting');
    expect(joinData.token).toBeUndefined(); // Crucial: NO LiveKit token issued!

    // 2. Host sees participant in waiting list
    const waitingRes = await fetch(`${baseUrl}/${room}/waiting-room`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    expect(waitingRes.status).toBe(200);
    const waitingData = await waitingRes.json();
    expect(waitingData.waitingParticipants.some(p => p.identity === guestIdentity)).toBe(true);

    // 3. Host admits the waiting participant
    const admitRes = await fetch(`${baseUrl}/${room}/waiting-room/${guestIdentity}/admit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    expect(admitRes.status).toBe(200);

    // 4. Participant re-requests token and receives valid LiveKit token
    const admittedJoinRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room,
        participantName: 'Waiting Bob',
        participantIdentity: guestIdentity,
      }),
    });

    expect(admittedJoinRes.status).toBe(200);
    const admittedData = await admittedJoinRes.json();
    expect(admittedData.waiting).toBeUndefined();
    expect(admittedData.token).toBeDefined();
    expect(typeof admittedData.token).toBe('string');
  });

  it('rejects waiting participant when host rejects admission', async () => {
    const room = createFreshRoom();
    const { hostToken } = await initHostMeeting(room, { waitingRoomEnabled: true });
    const guestIdentity = 'guest_rejected_888';

    // Place in waiting room
    await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room,
        participantName: 'Rejected Carol',
        participantIdentity: guestIdentity,
      }),
    });

    // Host rejects
    const rejectRes = await fetch(`${baseUrl}/${room}/waiting-room/${guestIdentity}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    expect(rejectRes.status).toBe(200);

    // Subsequent join attempt returns 403
    const joinRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room,
        participantName: 'Rejected Carol',
        participantIdentity: guestIdentity,
      }),
    });

    expect(joinRes.status).toBe(403);
    const joinData = await joinRes.json();
    expect(joinData.error.message).toMatch(/declined your request/i);
  });

  it('enforces meeting lock: allows host to lock and rejects new participants with 423', async () => {
    const room = createFreshRoom();
    const { hostToken } = await initHostMeeting(room, { waitingRoomEnabled: false });

    // 1. Host locks meeting
    const lockRes = await fetch(`${baseUrl}/${room}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ locked: true }),
    });
    expect(lockRes.status).toBe(200);
    const lockData = await lockRes.json();
    expect(lockData.isLocked).toBe(true);

    // 2. New participant attempts to join locked meeting
    const joinRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room,
        participantName: 'Late Dave',
        participantIdentity: 'guest_late_999',
      }),
    });

    expect(joinRes.status).toBe(423);
    const joinData = await joinRes.json();
    expect(joinData.error.code).toBe('LOCKED');
    expect(joinData.error.message).toMatch(/locked by the host/i);

    // 3. Host unlocks meeting
    const unlockRes = await fetch(`${baseUrl}/${room}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ locked: false }),
    });
    expect(unlockRes.status).toBe(200);
    expect((await unlockRes.json()).isLocked).toBe(false);
  });

  it('permanently blocks removed participant from rejoining with 403', async () => {
    const room = createFreshRoom();
    const { hostToken } = await initHostMeeting(room, { waitingRoomEnabled: false });
    const guestIdentity = 'guest_to_remove_555';

    // Host removes participant
    const removeRes = await fetch(`${baseUrl}/${room}/participants/${guestIdentity}/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ participantName: 'Banned Eve' }),
    });
    expect(removeRes.status).toBe(200);

    // Banned participant tries to obtain a new token
    const rejoinRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room,
        participantName: 'Banned Eve',
        participantIdentity: guestIdentity,
      }),
    });

    expect(rejoinRes.status).toBe(403);
    const rejoinData = await rejoinRes.json();
    expect(rejoinData.error.code).toBe('REMOVED');
    expect(rejoinData.error.message).toMatch(/removed from this meeting/i);
  });
});
