import express from 'express';
import { startSession, sendMessage, endSession, getSession } from '../controllers/sessionController';
import { protect, optionalAuth } from '../middleware/auth';
import mongoose, { Types } from 'mongoose';

const router = express.Router();

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Apply authentication middleware to all routes
// In development, we'll use optionalAuth to allow testing without tokens
if (isDevelopment) {
  router.use(optionalAuth);
  console.log('Using optional auth middleware for development');
} else {
  router.use(protect);
  console.log('Using strict auth middleware for production');
}

// Middleware to add mock user in development mode if no user is authenticated
router.use((req, res, next) => {
  if (isDevelopment && !req.user) {
    console.log('Development mode: Adding mock user');
    // Create a mock user with proper typing
    req.user = {
      _id: new mongoose.Types.ObjectId('000000000000000000000000'),
      name: 'Development User',
      email: 'dev@example.com',
      isVerified: true,
      password: '',
      verificationToken: '',
      resetPasswordToken: '',
      resetPasswordExpires: undefined
    } as any; // Use type assertion to simplify
  }
  next();
});

// Session routes
router.post('/start', startSession);
router.post('/message', sendMessage);
router.post('/end', endSession);
router.get('/:sessionId', getSession);

// New route for syncing client-side sessions
router.post('/sync', async (req, res) => {
  try {
    const { sessionData } = req.body;
    
    // For development, create a mock user ID if not authenticated
    let userId = req.user?._id as any; // Cast to any to avoid TypeScript errors
    if (isDevelopment && !userId) {
      userId = new Types.ObjectId('000000000000000000000000'); // Use proper ObjectId
      console.log('Development mode: Using mock user ID:', userId);
    }
    
    if (!sessionData) {
      return res.status(400).json({ error: 'Session data is required' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID is required', message: 'Authentication required' });
    }
    
    // Validate that sessionData has an id
    if (!sessionData.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client session ID is required',
        details: 'sessionData.id cannot be null or undefined'
      });
    }
    
    // Log the sync operation
    console.log('Session sync received', {
      clientSessionId: sessionData.id,
      userId
    });
    
    // Convert the client-side session to match the MongoDB schema
    const sessionToSave = {
      user: userId, // Use user instead of userId to match schema
      startTime: new Date(sessionData.startedAt), // Use startTime for consistency with schema
      startedAt: new Date(sessionData.startedAt),
      endTime: sessionData.endedAt ? new Date(sessionData.endedAt) : null, // Use endTime for consistency
      endedAt: sessionData.endedAt ? new Date(sessionData.endedAt) : undefined,
      isActive: !sessionData.endedAt, // Set isActive based on whether session is ended
      conversation: sessionData.conversation.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      })),
      voiceId: sessionData.voiceId,
      metadata: {
        clientSessionId: sessionData.id  // Store client session ID in metadata
      }
    };
    
    // Check if this session already exists by client-generated ID
    const existingSession = await import('../models/Session').then(
      module => module.Session.findOne({ 'metadata.clientSessionId': sessionData.id })
    );
    
    if (existingSession) {
      // Update the existing session
      console.log(`Updating existing session with client ID: ${sessionData.id}`);
      existingSession.endTime = sessionToSave.endTime;
      existingSession.endedAt = sessionToSave.endedAt;
      existingSession.isActive = sessionToSave.isActive;
      existingSession.conversation = sessionToSave.conversation;
      existingSession.voiceId = sessionToSave.voiceId;
      await existingSession.save();
      
      return res.status(200).json({
        success: true,
        sessionId: existingSession._id,
        message: 'Session updated successfully'
      });
    } else {
      // Create a new session
      console.log(`Creating new session with client ID: ${sessionData.id}`);
      const newSession = await import('../models/Session').then(
        module => new module.Session(sessionToSave)
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
    const userId = req.user?._id as any; // Cast to any to avoid TypeScript errors
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID is required' });
    }
    
    console.log(`Fetching sessions for user: ${userId}`);
    
    const sessions = await import('../models/Session').then(
      module => module.Session.find({ user: userId }) // changed userId to user to match schema
        .sort({ startedAt: -1 })
        .select('startedAt endedAt conversation voiceId')
    );
    
    console.log(`Found ${sessions.length} sessions`);
    
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