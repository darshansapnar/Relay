import { Router } from 'express';
import { createMeetingToken } from '../controllers/meeting.controller.js';

const router = Router();

// POST /api/meetings/token
router.post('/token', createMeetingToken);

export default router;
