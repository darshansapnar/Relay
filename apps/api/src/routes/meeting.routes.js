import { Router } from 'express';
import { createMeetingToken } from '../controllers/meeting.controller.js';
import {
  setParticipantMuted,
  setParticipantCameraDisabled,
  removeParticipantFromRoom,
  endMeetingForEveryone,
} from '../controllers/host.controller.js';

const router = Router();

// POST /api/meetings/token
router.post('/token', createMeetingToken);

// Host-only moderation actions. Each verifies the caller's own LiveKit
// access token server-side (see services/livekitAdmin.js) -- the UI only
// hides these buttons from non-hosts, it does not grant access to them.
router.post('/:roomName/participants/:identity/mute', setParticipantMuted);
router.post('/:roomName/participants/:identity/camera', setParticipantCameraDisabled);
router.post('/:roomName/participants/:identity/remove', removeParticipantFromRoom);
router.post('/:roomName/end', endMeetingForEveryone);

export default router;
