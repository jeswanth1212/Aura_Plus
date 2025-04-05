import express from 'express';
import { startSession, sendMessage, endSession, getSession } from '../controllers/sessionController';
import { protect } from '../middleware/auth';

const router = express.Router();

// All session routes require auth
router.use(protect);

// Session routes
router.post('/start', startSession);
router.post('/message', sendMessage);
router.post('/end', endSession);
router.get('/:sessionId', getSession);

// New route for syncing client-side sessions
router.post('/sync', async (req, res) => {
  try {
    const { sessionData } = req.body;
    const userId = req.user._id;
    
    if (!sessionData) {
      return res.status(400).json({ error: 'Session data is required' });
    }
    
    // Convert the client-side session to match the MongoDB schema
    const sessionToSave = {
      userId: userId,
      startedAt: new Date(sessionData.startedAt),
      endedAt: sessionData.endedAt ? new Date(sessionData.endedAt) : undefined,
      conversation: sessionData.conversation.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      })),
      voiceId: sessionData.voiceId
    };
    
    // Check if this session already exists by client-generated ID
    const existingSession = await import('../models/Session').then(
      module => module.Session.findOne({ 'metadata.clientSessionId': sessionData.id })
    );
    
    if (existingSession) {
      // Update the existing session
      existingSession.endedAt = sessionToSave.endedAt;
      existingSession.conversation = sessionToSave.conversation;
      existingSession.voiceId = sessionToSave.voiceId;
      await existingSession.save();
      
      return res.status(200).json({
        success: true,
        sessionId: existingSession._id,
        message: 'Session updated successfully'
      });
    } else {
      // Create a new session with metadata for the client session ID
      const newSession = await import('../models/Session').then(
        module => new module.Session({
          ...sessionToSave,
          metadata: {
            clientSessionId: sessionData.id
          }
        })
      );
      
      await newSession.save();
      
      return res.status(201).json({
        success: true,
        sessionId: newSession._id,
        message: 'Session created successfully'
      });
    }
  } catch (error) {
    console.error('Error syncing session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync session',
      details: error.message
    });
  }
});

// Get all sessions for the current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    
    const sessions = await import('../models/Session').then(
      module => module.Session.find({ userId })
        .sort({ startedAt: -1 })
        .select('startedAt endedAt conversation voiceId')
    );
    
    return res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sessions',
      details: error.message
    });
  }
});

export default router; 