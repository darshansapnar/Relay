import {
  saveMeetingAccessState,
  getMeetingAccessState,
  setMeetingLockState,
  saveAccessEntry,
  getAccessEntry,
  getWaitingEntries,
  updateAccessEntryStatus,
  deleteMeetingAccess,
} from '../db/accessRepo.js';
import { config } from '../config/index.js';

class AccessControlService {
  constructor() {
    this.io = null;
    // In-memory fallback and fast state cache:
    // roomName -> { hostIdentity, waitingRoomEnabled, isLocked, waitingMap: Map(identity -> { identity, name, createdAt }), removedSet: Set(identity) }
    this.rooms = new Map();
  }

  setIO(io) {
    this.io = io;
  }

  _getOrCreateRoomMemory(roomName) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, {
        hostIdentity: null,
        waitingRoomEnabled: false,
        isLocked: false,
        waitingMap: new Map(),
        removedSet: new Set(),
      });
    }
    return this.rooms.get(roomName);
  }

  /**
   * Initializes or updates room access controls upon room creation or token issuance.
   */
  async initializeMeeting({ roomName, hostIdentity, waitingRoomEnabled = false }) {
    const mem = this._getOrCreateRoomMemory(roomName);
    if (hostIdentity) {
      mem.hostIdentity = hostIdentity;
    }
    mem.waitingRoomEnabled = Boolean(waitingRoomEnabled);

    if (config.database.isConfigured) {
      try {
        await saveMeetingAccessState({
          roomName,
          hostIdentity: mem.hostIdentity,
          waitingRoomEnabled: mem.waitingRoomEnabled,
          isLocked: mem.isLocked,
        });
      } catch (err) {
        console.warn(`[Relay Access] Error persisting access state for ${roomName}:`, err.message);
      }
    }

    return {
      roomName,
      hostIdentity: mem.hostIdentity,
      waitingRoomEnabled: mem.waitingRoomEnabled,
      isLocked: mem.isLocked,
    };
  }

  /**
   * Retrieves the access state (lock and waiting room settings) for a room.
   */
  async getAccessState(roomName) {
    const mem = this._getOrCreateRoomMemory(roomName);

    if (config.database.isConfigured && !mem.hostIdentity) {
      try {
        const dbState = await getMeetingAccessState(roomName);
        if (dbState) {
          mem.hostIdentity = dbState.hostIdentity;
          mem.waitingRoomEnabled = dbState.waitingRoomEnabled;
          mem.isLocked = dbState.isLocked;
        }
      } catch (err) {
        console.warn(`[Relay Access] Error fetching access state for ${roomName}:`, err.message);
      }
    }

    return {
      roomName,
      hostIdentity: mem.hostIdentity,
      waitingRoomEnabled: mem.waitingRoomEnabled,
      isLocked: mem.isLocked,
    };
  }

  /**
   * Sets the lock state for a meeting room and broadcasts real-time updates.
   */
  async setMeetingLocked(roomName, isLocked) {
    const mem = this._getOrCreateRoomMemory(roomName);
    mem.isLocked = Boolean(isLocked);

    if (config.database.isConfigured) {
      try {
        await setMeetingLockState(roomName, mem.isLocked);
      } catch (err) {
        console.warn(`[Relay Access] Error updating lock state for ${roomName}:`, err.message);
      }
    }

    if (this.io) {
      this.io.to(`room:${roomName}`).emit('access:meeting_locked_update', {
        roomName,
        isLocked: mem.isLocked,
      });
    }

    return { roomName, isLocked: mem.isLocked };
  }

  /**
   * Checks whether a participant is permitted to join, must wait, or is rejected/removed/locked.
   */
  async evaluateJoinRequest({ roomName, participantIdentity, participantName, isHost = false }) {
    const mem = this._getOrCreateRoomMemory(roomName);

    // 1. If requester is host, they are always admitted immediately
    if (isHost || (mem.hostIdentity && mem.hostIdentity === participantIdentity)) {
      mem.hostIdentity = participantIdentity;
      return { allowed: true, isHost: true };
    }

    // 2. Check if participant has been permanently removed/banned from this meeting
    if (await this.isParticipantRemoved(roomName, participantIdentity)) {
      return {
        allowed: false,
        reason: 'removed',
        message: 'You have been removed from this meeting by the host.',
        statusCode: 403,
      };
    }

    // 3. Check if meeting is locked
    const state = await this.getAccessState(roomName);
    if (state.isLocked) {
      return {
        allowed: false,
        reason: 'locked',
        message: 'This meeting has been locked by the host and is not accepting new participants.',
        statusCode: 423,
      };
    }

    // 4. Check if waiting room is enabled
    if (state.waitingRoomEnabled) {
      // Check existing status for this participant
      let entryStatus = null;
      if (config.database.isConfigured) {
        try {
          const entry = await getAccessEntry(roomName, participantIdentity);
          if (entry) {
            entryStatus = entry.status;
          }
        } catch (err) {
          console.warn(`[Relay Access] Error reading access entry for ${participantIdentity}:`, err.message);
        }
      }

      if (!entryStatus) {
        if (mem.waitingMap.has(participantIdentity)) {
          entryStatus = 'waiting';
        }
      }

      if (entryStatus === 'approved') {
        return { allowed: true, isHost: false };
      }

      if (entryStatus === 'rejected') {
        return {
          allowed: false,
          reason: 'rejected',
          message: 'The host has declined your request to join this meeting.',
          statusCode: 403,
        };
      }

      // Not yet approved -> register in waiting room
      const waitingItem = {
        identity: participantIdentity,
        name: participantName,
        status: 'waiting',
        createdAt: new Date().toISOString(),
      };
      mem.waitingMap.set(participantIdentity, waitingItem);

      if (config.database.isConfigured) {
        try {
          await saveAccessEntry({
            roomName,
            participantIdentity,
            participantName,
            status: 'waiting',
          });
        } catch (err) {
          console.warn(`[Relay Access] Error persisting waiting entry:`, err.message);
        }
      }

      // Broadcast waiting room update to host
      await this._broadcastWaitingRoomUpdate(roomName);

      return {
        allowed: false,
        reason: 'waiting',
        waiting: true,
        status: 'waiting',
        message: 'Please wait, the meeting host will let you in soon.',
      };
    }

    // Waiting room disabled and meeting unlocked -> allow entry
    return { allowed: true, isHost: false };
  }

  /**
   * Retrieves all currently waiting participants in a room.
   */
  async getWaitingParticipants(roomName) {
    const mem = this._getOrCreateRoomMemory(roomName);

    if (config.database.isConfigured) {
      try {
        const rows = await getWaitingEntries(roomName);
        return rows.map(r => ({
          identity: r.identity,
          name: r.name,
          status: r.status,
          createdAt: r.createdAt || r.created_at,
        }));
      } catch (err) {
        console.warn(`[Relay Access] Error querying waiting entries:`, err.message);
      }
    }

    return Array.from(mem.waitingMap.values());
  }

  /**
   * Host approves a waiting participant.
   */
  async admitParticipant(roomName, participantIdentity) {
    const mem = this._getOrCreateRoomMemory(roomName);
    mem.waitingMap.delete(participantIdentity);

    if (config.database.isConfigured) {
      try {
        await updateAccessEntryStatus(roomName, participantIdentity, 'approved');
      } catch (err) {
        console.warn(`[Relay Access] Error approving entry for ${participantIdentity}:`, err.message);
      }
    }

    // Notify waiting participant in real time via their dedicated channel
    if (this.io) {
      this.io.to(`waiting:${roomName}:${participantIdentity}`).emit('access:waiting_room_approved', {
        roomName,
        participantIdentity,
        status: 'approved',
      });
      this.io.to(`user:${roomName}:${participantIdentity}`).emit('access:waiting_room_approved', {
        roomName,
        participantIdentity,
        status: 'approved',
      });
    }

    await this._broadcastWaitingRoomUpdate(roomName);
    return { success: true, participantIdentity, status: 'approved' };
  }

  /**
   * Host rejects a waiting participant.
   */
  async rejectParticipant(roomName, participantIdentity) {
    const mem = this._getOrCreateRoomMemory(roomName);
    mem.waitingMap.delete(participantIdentity);

    if (config.database.isConfigured) {
      try {
        await updateAccessEntryStatus(roomName, participantIdentity, 'rejected');
      } catch (err) {
        console.warn(`[Relay Access] Error rejecting entry for ${participantIdentity}:`, err.message);
      }
    }

    // Notify waiting participant in real time
    if (this.io) {
      this.io.to(`waiting:${roomName}:${participantIdentity}`).emit('access:waiting_room_rejected', {
        roomName,
        participantIdentity,
        status: 'rejected',
      });
      this.io.to(`user:${roomName}:${participantIdentity}`).emit('access:waiting_room_rejected', {
        roomName,
        participantIdentity,
        status: 'rejected',
      });
    }

    await this._broadcastWaitingRoomUpdate(roomName);
    return { success: true, participantIdentity, status: 'rejected' };
  }

  /**
   * Host removes a participant, recording the removal to prevent rejoining.
   */
  async removeParticipant(roomName, participantIdentity, participantName = 'Participant') {
    const mem = this._getOrCreateRoomMemory(roomName);
    mem.removedSet.add(participantIdentity);
    mem.waitingMap.delete(participantIdentity);

    if (config.database.isConfigured) {
      try {
        await saveAccessEntry({
          roomName,
          participantIdentity,
          participantName,
          status: 'removed',
        });
      } catch (err) {
        console.warn(`[Relay Access] Error persisting removal for ${participantIdentity}:`, err.message);
      }
    }

    // Notify participant and entire room in real time
    if (this.io) {
      this.io.to(`user:${roomName}:${participantIdentity}`).emit('access:participant_removed', {
        roomName,
        participantIdentity,
        message: 'You have been removed from the meeting by the host.',
      });
      this.io.to(`room:${roomName}`).emit('access:participant_list_update', {
        roomName,
        removedIdentity: participantIdentity,
      });
    }

    await this._broadcastWaitingRoomUpdate(roomName);
    return { success: true, participantIdentity, status: 'removed' };
  }

  /**
   * Checks whether a participant identity has been removed from this meeting.
   */
  async isParticipantRemoved(roomName, participantIdentity) {
    const mem = this._getOrCreateRoomMemory(roomName);
    if (mem.removedSet.has(participantIdentity)) {
      return true;
    }

    if (config.database.isConfigured) {
      try {
        const entry = await getAccessEntry(roomName, participantIdentity);
        if (entry && entry.status === 'removed') {
          mem.removedSet.add(participantIdentity);
          return true;
        }
      } catch (err) {
        console.warn(`[Relay Access] Error checking removal status:`, err.message);
      }
    }

    return false;
  }

  /**
   * Broadcasts the latest waiting room list to the meeting room.
   */
  async _broadcastWaitingRoomUpdate(roomName) {
    if (!this.io) return;
    try {
      const waitingList = await this.getWaitingParticipants(roomName);
      this.io.to(`room:${roomName}`).emit('access:waiting_room_update', {
        roomName,
        waitingParticipants: waitingList,
        count: waitingList.length,
      });
    } catch (err) {
      console.warn(`[Relay Access] Error broadcasting waiting list:`, err.message);
    }
  }

  /**
   * Cleans up room access memory and database records when meeting ends.
   */
  async clearRoom(roomName) {
    this.rooms.delete(roomName);
    if (config.database.isConfigured) {
      try {
        await deleteMeetingAccess(roomName);
      } catch (err) {
        console.warn(`[Relay Access] Error clearing database access records:`, err.message);
      }
    }
  }
}

export const accessControlService = new AccessControlService();
