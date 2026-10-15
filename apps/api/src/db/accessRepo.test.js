import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  saveMeetingAccessState,
  getMeetingAccessState,
  setMeetingLockState,
  saveAccessEntry,
  getAccessEntry,
  getWaitingEntries,
  updateAccessEntryStatus,
  deleteMeetingAccess,
} from './accessRepo.js';
import { closePool } from './index.js';
import { config } from '../config/index.js';

describe('accessRepo PostgreSQL repository', () => {
  const roomName = 'test-access-repo-room';
  const hostIdentity = 'host_user_1';

  beforeAll(async () => {
    if (!config.database.isConfigured) return;
    await deleteMeetingAccess(roomName);
  });

  afterAll(async () => {
    if (!config.database.isConfigured) return;
    await deleteMeetingAccess(roomName);
    await closePool();
  });

  beforeEach(async () => {
    if (!config.database.isConfigured) return;
    await deleteMeetingAccess(roomName);
  });

  it('manages meeting access state (waiting room & lock state)', async () => {
    if (!config.database.isConfigured) return;

    // Save initial state with waiting room enabled
    const created = await saveMeetingAccessState({
      roomName,
      hostIdentity,
      waitingRoomEnabled: true,
      isLocked: false,
    });

    expect(created).toBeDefined();
    expect(created.roomName).toBe(roomName);
    expect(created.hostIdentity).toBe(hostIdentity);
    expect(created.waitingRoomEnabled).toBe(true);
    expect(created.isLocked).toBe(false);

    // Retrieve state
    const retrieved = await getMeetingAccessState(roomName);
    expect(retrieved.waitingRoomEnabled).toBe(true);
    expect(retrieved.isLocked).toBe(false);

    // Lock meeting
    const locked = await setMeetingLockState(roomName, true);
    expect(locked.isLocked).toBe(true);

    const recheck = await getMeetingAccessState(roomName);
    expect(recheck.isLocked).toBe(true);
  });

  it('tracks participant entries across waiting, approved, rejected, and removed', async () => {
    if (!config.database.isConfigured) return;

    await saveMeetingAccessState({
      roomName,
      hostIdentity,
      waitingRoomEnabled: true,
      isLocked: false,
    });

    // Participant requests to join -> status 'waiting'
    const entry = await saveAccessEntry({
      roomName,
      participantIdentity: 'user_waiting_1',
      participantName: 'Bob',
      status: 'waiting',
    });
    expect(entry.status).toBe('waiting');

    // List waiting participants
    const waitingList = await getWaitingEntries(roomName);
    expect(waitingList).toHaveLength(1);
    expect(waitingList[0].identity).toBe('user_waiting_1');
    expect(waitingList[0].name).toBe('Bob');

    // Host approves participant
    const approved = await updateAccessEntryStatus(roomName, 'user_waiting_1', 'approved');
    expect(approved.status).toBe('approved');

    // Waiting list should now be empty
    const remainingWaiting = await getWaitingEntries(roomName);
    expect(remainingWaiting).toHaveLength(0);

    // Verify entry status is approved
    const fetched = await getAccessEntry(roomName, 'user_waiting_1');
    expect(fetched.status).toBe('approved');

    // Host removes participant
    const removed = await updateAccessEntryStatus(roomName, 'user_waiting_1', 'removed');
    expect(removed.status).toBe('removed');

    const checkRemoved = await getAccessEntry(roomName, 'user_waiting_1');
    expect(checkRemoved.status).toBe('removed');
  });
});
