import { Router } from 'express';
import {
  getAIStateController,
  toggleAIStateController,
  getTranscriptsController,
  postTranscriptController,
  getSummariesController,
  triggerSummaryController,
} from '../controllers/ai.controller.js';

const router = Router();

// GET /api/meetings/:roomName/ai/state
router.get('/:roomName/ai/state', getAIStateController);

// POST /api/meetings/:roomName/ai/toggle
router.post('/:roomName/ai/toggle', toggleAIStateController);

// GET /api/meetings/:roomName/ai/transcripts
router.get('/:roomName/ai/transcripts', getTranscriptsController);

// POST /api/meetings/:roomName/ai/transcripts
router.post('/:roomName/ai/transcripts', postTranscriptController);

// GET /api/meetings/:roomName/ai/summaries
router.get('/:roomName/ai/summaries', getSummariesController);

// POST /api/meetings/:roomName/ai/summary/trigger
router.post('/:roomName/ai/summary/trigger', triggerSummaryController);

export default router;
