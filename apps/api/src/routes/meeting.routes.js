import { Router } from 'express';
import { createMeetingToken } from '../controllers/meeting.controller.js';
import {
  setParticipantMuted,
  setParticipantCameraDisabled,
  removeParticipantFromRoom,
  endMeetingForEveryone,
  setMeetingLock,
  getMeetingAccessStateEndpoint,
  getWaitingParticipantsEndpoint,
  admitWaitingParticipantEndpoint,
  rejectWaitingParticipantEndpoint,
} from '../controllers/host.controller.js';

import chatRoutes from './chat.routes.js';
import aiRoutes from './ai.routes.js';

const router = Router();

// POST /api/meetings/token
router.post('/token', createMeetingToken);

// Meeting chat messages (Everyone and Private)
router.use('/:roomName/messages', chatRoutes);

// AI Assistant endpoints (state, transcripts, summaries, audio, toggle)
router.use('/', aiRoutes);

// Meeting access controls and state
router.get('/:roomName/access-state', getMeetingAccessStateEndpoint);
router.post('/:roomName/lock', setMeetingLock);
router.get('/:roomName/waiting-room', getWaitingParticipantsEndpoint);
router.post('/:roomName/waiting-room/:identity/admit', admitWaitingParticipantEndpoint);
router.post('/:roomName/waiting-room/:identity/reject', rejectWaitingParticipantEndpoint);

// Host-only moderation actions
router.post('/:roomName/participants/:identity/mute', setParticipantMuted);
router.post('/:roomName/participants/:identity/camera', setParticipantCameraDisabled);
router.post('/:roomName/participants/:identity/remove', removeParticipantFromRoom);
router.post('/:roomName/end', endMeetingForEveryone);

export default router;
