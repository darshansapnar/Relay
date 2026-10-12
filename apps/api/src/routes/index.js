import { Router } from 'express';
import healthRoutes from './health.routes.js';
import meetingRoutes from './meeting.routes.js';

const router = Router();

// Mount health routes under /health (accessible at /api/health)
router.use('/health', healthRoutes);

// Mount meeting routes under /meetings (accessible at /api/meetings)
router.use('/meetings', meetingRoutes);

export default router;
