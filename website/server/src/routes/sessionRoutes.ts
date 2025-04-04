import express from 'express';
import { protect } from '../middleware/auth';
import {
  startSession,
  sendMessage,
  endSession,
  getSession,
  getSessions
} from '../controllers/sessionController';

const router = express.Router();

// All routes are protected with auth middleware
router.use(protect);

// Start a new session
router.post('/start', startSession);

// Send a message in an active session
router.post('/message', sendMessage);

// End a session
router.post('/end', endSession);

// Get all sessions for a user
router.get('/', getSessions);

// Get a specific session
router.get('/:sessionId', getSession);

export default router; 