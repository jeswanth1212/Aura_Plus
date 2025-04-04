import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import asyncHandler from 'express-async-handler';

// Initialize Gemini AI
const initGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Generate speech using ElevenLabs
const generateSpeech = async (text: string): Promise<string> => {
  try {
    const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }
    
    // Use Sarah voice
    const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVEN_LABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    // Convert audio buffer to base64
    const audioBuffer = Buffer.from(response.data);
    const base64Audio = audioBuffer.toString('base64');
    
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error: any) {
    console.error('ElevenLabs API error:', error.response?.data || error.message);
    throw new Error(`Speech generation failed: ${error.message}`);
  }
};

// Start a new therapy session
export const startSession = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check for required API keys first
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY missing' });
      return;
    }
    
    if (!ELEVEN_LABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY not configured');
      res.status(500).json({ error: 'Server configuration error: ELEVENLABS_API_KEY missing' });
      return;
    }
    
    const userId = req.user._id;
    
    // Create a new session
    const session = await Session.create({
      user: userId,
      startTime: new Date(),
      endTime: null,
      isActive: true,
      messages: []
    });
    
    try {
      // Generate initial AI greeting
      const genAI = initGemini();
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const chat = model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });
      
      const result = await chat.sendMessage(
        "Start a new therapy session with a friendly greeting. Introduce yourself as an AI therapist that can help with emotional wellbeing."
      );
      const aiResponse = result.response.text();
      
      // Generate speech audio
      const audioUrl = await generateSpeech(aiResponse);
      
      // Save the AI message to the session
      session.messages.push({
        sender: 'ai',
        text: aiResponse,
        timestamp: new Date()
      });
      
      await session.save();
      
      res.status(200).json({
        sessionId: session._id,
        message: aiResponse,
        audioUrl: audioUrl
      });
    } catch (aiError: any) {
      console.error('AI or speech generation error:', aiError);
      
      // Save session with a fallback message if AI fails
      const fallbackMessage = "Hello! I'm your AI therapist from Aura Plus. How are you feeling today?";
      
      session.messages.push({
        sender: 'ai',
        text: fallbackMessage,
        timestamp: new Date()
      });
      
      await session.save();
      
      res.status(200).json({
        sessionId: session._id,
        message: fallbackMessage,
        audioUrl: null
      });
    }
  } catch (error: any) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
});

// Send a message in an active session
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;
    const userId = req.user._id;
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }
    
    // Find the active session
    const session = await Session.findOne({ 
      _id: sessionId,
      user: userId,
      isActive: true
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    // Add user message to session
    session.messages.push({
      sender: 'user',
      text: message,
      timestamp: new Date()
    });
    
    await session.save();
    
    // Format conversation history for Gemini
    const formattedHistory = session.messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
    
    // Generate AI response
    const genAI = initGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const chat = model.startChat({
      history: formattedHistory.slice(0, -1), // Exclude the last message
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
    
    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();
    
    // Generate speech audio
    const audioUrl = await generateSpeech(aiResponse);
    
    // Save the AI message to the session
    session.messages.push({
      sender: 'ai',
      text: aiResponse,
      timestamp: new Date()
    });
    
    await session.save();
    
    res.status(200).json({
      message: aiResponse,
      audioUrl: audioUrl
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// End a therapy session
export const endSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user._id;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Find and update the session
    const session = await Session.findOneAndUpdate(
      { 
        _id: sessionId,
        user: userId,
        isActive: true
      },
      {
        isActive: false,
        endTime: new Date()
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    // Generate session summary
    const genAI = initGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const messages = session.messages.map(msg => `${msg.sender}: ${msg.text}`).join('\n\n');
    const prompt = `Summarize this therapy session in 3-4 sentences. Focus on the main topics discussed and emotional themes:\n\n${messages}`;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    // Update session with summary
    session.summary = summary;
    await session.save();
    
    res.status(200).json({
      sessionId: session._id,
      summary,
      messageCount: session.messages.length,
      duration: session.endTime 
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000) 
        : 0
    });
  } catch (error: any) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session', details: error.message });
  }
};

// Get session history
export const getSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Find the session
    const session = await Session.findOne({ 
      _id: sessionId,
      user: userId
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.status(200).json(session);
  } catch (error: any) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session', details: error.message });
  }
};

// Get all sessions for a user
export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    
    // Find all sessions for the user
    const sessions = await Session.find({ 
      user: userId
    }).sort({ startTime: -1 });
    
    res.status(200).json(sessions);
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions', details: error.message });
  }
}); 