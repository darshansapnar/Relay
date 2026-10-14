import { Router } from 'express';
import { getMeetingMessages, sendMeetingMessage } from '../controllers/chat.controller.js';

const router = Router({ mergeParams: true });

// GET /api/meetings/:roomName/messages - Get authorized chat messages
router.get('/', getMeetingMessages);

// POST /api/meetings/:roomName/messages - Send a chat message
router.post('/', sendMeetingMessage);

export default router;
