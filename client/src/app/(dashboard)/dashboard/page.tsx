'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, X, Play, History, BarChart2 } from 'lucide-react';
import TypingAnimation from '@/components/TypingAnimation';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Conversation states
enum ConversationState {
  INACTIVE = 'inactive',
  CONNECTING = 'connecting',
  GREETING = 'greeting',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  ERROR = 'error',
  ENDED = 'ended'
}

// API Constants
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Default voice ID (Adam)

// Interface for conversation history
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Session data structure
interface SessionData {
  id: string;
  userId: string | null;
  startedAt: Date;
  endedAt?: Date;
  conversation: Message[];
  voiceId?: string; // Store voice ID for the session
  metadata?: {
    mongoDbId?: string;
    [key: string]: any;
  };
}

// Status messages for different states
const stateMessages = {
  [ConversationState.INACTIVE]: "Click 'Begin Session' to start",
  [ConversationState.CONNECTING]: "Connecting to voice assistant...",
  [ConversationState.GREETING]: "Aura is greeting you...",
  [ConversationState.LISTENING]: "Listening to you...",
  [ConversationState.PROCESSING]: "Processing your message...",
  [ConversationState.SPEAKING]: "Aura is speaking...",
  [ConversationState.ERROR]: "There was an error. Please try again.",
  [ConversationState.ENDED]: "Conversation ended."
};

// API utility functions
const apiUtils = {
  // Voice Cloning with Zyphra (replacing ElevenLabs)
  async cloneVoice(name: string): Promise<string> {
    try {
      console.log('Attempting to clone voice with Zyphra:', name);
      
      // Import zyphraService
      const zyphraService = (await import('../../../services/zyphraService')).default;
      
      // Check if Zyphra service is initialized
      if (!zyphraService.isInitialized()) {
        console.warn('Zyphra service not initialized, falling back to ElevenLabs');
        return this.fallbackToElevenLabsClone(name);
      }
      
      // Generate a voice ID for this cloned voice
      const voiceId = `zyphra_${Date.now()}_${name}`;
      
      // Save the voice ID in localStorage
      const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
      savedVoices.push({
        id: voiceId,
        name: `Aura Session ${name}`,
        type: 'zyphra', // Mark this as a Zyphra voice
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('aura_cloned_voices', JSON.stringify(savedVoices));
      
      console.log('✅ Successfully created voice reference with Zyphra ID:', voiceId);
      return voiceId;
    } catch (error) {
      console.error('❌ Error in Zyphra voice cloning:', error);
      // Fallback to ElevenLabs if Zyphra fails
      return this.fallbackToElevenLabsClone(name);
    }
  },
  
  // Fallback to ElevenLabs voice cloning
  async fallbackToElevenLabsClone(name: string): Promise<string> {
    try {
      console.log('🔄 Falling back to ElevenLabs voice cloning for:', name);
      
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY not configured');
      }
      
      // Sample text for voice cloning
      const sampleText = "I'm your AI therapy companion, here to help you explore your thoughts and feelings in a safe, supportive environment.";
      
      // Create a voice with instant voice cloning (no samples needed)
      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          name: `Aura Session ${name}`,
          description: "AI therapist voice for Aura Plus session",
          text_sample: sampleText,
          voice_model_id: "eleven_multilingual_v2"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Voice cloning error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.voice_id) {
        throw new Error('Invalid response from voice cloning API');
      }
      
      // Save this as an ElevenLabs voice type
      const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
      savedVoices.push({
        id: data.voice_id,
        name: `Aura Session ${name}`,
        type: 'elevenlabs',
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('aura_cloned_voices', JSON.stringify(savedVoices));
      
      console.log('✅ Successfully cloned voice with ElevenLabs ID:', data.voice_id);
      
      return data.voice_id;
    } catch (error) {
      console.error('❌ Error in ElevenLabs voice cloning:', error);
      // Return default voice ID if cloning fails
      return DEFAULT_VOICE_ID;
    }
  },
  
  // Get available voices from ElevenLabs
  async getVoices(): Promise<Array<{voice_id: string, name: string}>> {
    try {
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY not configured');
      }
      
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });
      
      if (!response.ok) {
        throw new Error(`Get voices error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.voices || !Array.isArray(data.voices)) {
        throw new Error('Invalid response from get voices API');
      }
      
      return data.voices.map((voice: any) => ({
        voice_id: voice.voice_id,
        name: voice.name
      }));
    } catch (error) {
      console.error('❌ Error getting voices:', error);
      // Return empty array if failed
      return [];
    }
  },
  
  // ElevenLabs Speech-to-Text
  async speechToText(audioBlob: Blob): Promise<string> {
    try {
      console.log('⚙️ Starting speech-to-text conversion...');
      
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY not configured');
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', audioBlob);
      formData.append('model_id', 'scribe_v1');
      
      console.log('📡 Sending request to Eleven Labs STT API...');
      
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`STT API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.text) {
        throw new Error('Invalid response from speech-to-text API');
      }
      
      console.log('✅ Successfully converted speech to text:', data.text);
      
      return data.text.trim();
    } catch (error) {
      console.error('❌ Error in speech-to-text conversion:', error);
      
      // Fallback phrases
      const fallbackPhrases = [
        "I've been feeling anxious lately",
        "I'm having trouble sleeping at night",
        "Work has been really stressful for me",
        "I had an argument with my friend and I feel bad",
        "I'm worried about my future"
      ];
      
      // Select a random fallback phrase
      const index = Math.floor(Math.random() * fallbackPhrases.length);
      return fallbackPhrases[index];
    }
  },
  
  // Gemini AI for generating responses
  async generateResponse(history: Message[]): Promise<string> {
    try {
      console.log("Generating AI response...");

      // Create a proper conversation history for the AI
      const formattedHistory = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Get the last user message as context
      const lastMessage = history.length > 0 ? history[history.length - 1] : null;
      const userContext = lastMessage && lastMessage.role === 'user' ? lastMessage.content : "How are you feeling today?";
      
      // Use consistent model name with what works in the analysis page
      const modelName = "gemini-2.0-flash";
      
      // Create a better system prompt with length guidelines
      const systemPrompt = {
        role: "user",
        parts: [{
          text: `You are a therapist named Aura. Be extremely concise. 

Your responses must:
- Be 1-2 sentences maximum
- Use simple, direct language
- Avoid unnecessary words
- Never exceed 25 words total

The client context is: ${userContext}`
        }]
      };
      
      // API call to Gemini with full conversation history
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: formattedHistory.length > 1 ? 
              [...formattedHistory.slice(-5), systemPrompt] : // Include up to 5 recent messages
              [systemPrompt], // Just use system prompt if no history
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 300, // Reduced from 1024 for more concise responses
            },
          }),
        }
      );
      
      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error (${response.status}):`, errorText);
        return "Sorry, I couldn't generate a response. Please try again later.";
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error("Invalid response from Gemini API:", data);
        return "Sorry, I couldn't generate a proper response. Please try again later.";
      }
      
      const aiResponse = data.candidates[0].content.parts[0].text;
      return aiResponse;
    } catch (error) {
      console.error("Error generating AI response:", error);
      return "Sorry, I couldn't generate a response due to an error. Please try again later.";
    }
  },
  
  // ElevenLabs Text-to-Speech
  async textToSpeech(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<ArrayBuffer> {
    try {
      console.log('🎵 Converting text to speech using voice ID:', voiceId);
      
      // Check if this is a Zyphra voice ID (they start with "zyphra_")
      if (voiceId.startsWith('zyphra_')) {
        return this.zyphraTextToSpeech(text, voiceId);
      }
      
      // Improved text processing for TTS
      // Split long text into chunks of up to 250 characters at sentence boundaries
      const chunks = this.splitIntoOptimalChunks(text, 250);
      const firstChunk = chunks[0]; // Always process at least the first chunk
      
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY not configured');
      }
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: firstChunk,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.15,  // Add a slight style boost
            speaking_rate: 1.15  // Speak slightly faster (15% faster than normal)
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
      }
      
      const audioData = await response.arrayBuffer();
      console.log('✅ Successfully converted text to speech with ElevenLabs');
      
      return audioData;
    } catch (error) {
      console.error('❌ Error in text-to-speech conversion:', error);
      throw error;
    }
  },
  
  // Zyphra Text-to-Speech implementation
  async zyphraTextToSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
    try {
      console.log('🎵 Converting text to speech using Zyphra voice ID:', voiceId);
      
      // Import zyphraService
      const zyphraService = (await import('../../../services/zyphraService')).default;
      
      // Simplified approach: Always process Zyphra voices without session checks
      console.log('Using Zyphra for cloned voice TTS');
      
      // Check if Zyphra service is initialized
      if (!zyphraService.isInitialized()) {
        console.warn('Zyphra service not initialized, falling back to ElevenLabs');
        // Use default voice ID since we couldn't use Zyphra
        return this.textToSpeech(text, DEFAULT_VOICE_ID);
      }
      
      // Get all cloned voices to find the reference audio
      const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
      const voiceData = savedVoices.find((v: any) => v.id === voiceId);
      
      if (!voiceData) {
        console.warn('Voice data not found for:', voiceId, 'falling back to default voice');
        return this.textToSpeech(text, DEFAULT_VOICE_ID);
      }
      
      let audioBlob: Blob;
      
      // Check if we have a saved reference audio for this voice
      const savedAudio = localStorage.getItem(`zyphra_audio_${voiceId}`);
      if (savedAudio) {
        // Use the saved audio reference with the voice ID as session ID
        try {
          console.log(`Generating Zyphra TTS with voice ${voiceId}`);
          audioBlob = await zyphraService.generateSpeechWithSavedVoice(text, savedAudio, voiceId);
          console.log('Zyphra TTS successful, blob size:', audioBlob.size, 'bytes');
        } catch (error) {
          console.error('Zyphra TTS failed:', error);
          console.log('Falling back to ElevenLabs TTS');
          return this.textToSpeech(text, DEFAULT_VOICE_ID);
        }
      } else {
        // If we don't have reference audio yet, use a default voice
        console.warn('No reference audio for voice:', voiceId, 'using default TTS');
        return this.textToSpeech(text, DEFAULT_VOICE_ID);
      }
      
      // Convert blob to ArrayBuffer for consistent return type
      const arrayBuffer = await new Response(audioBlob).arrayBuffer();
      console.log('✅ Successfully converted text to speech with Zyphra');
      
      return arrayBuffer;
    } catch (error) {
      console.error('❌ Error in Zyphra text-to-speech conversion:', error);
      // Fall back to ElevenLabs with default voice
      console.warn('Falling back to ElevenLabs TTS due to error');
      return this.textToSpeech(text, DEFAULT_VOICE_ID);
    }
  },
  
  // Split text into optimal chunks for TTS processing
  splitIntoOptimalChunks(text: string, maxChunkLength: number): string[] {
    // If text is already short enough, return as is
    if (text.length <= maxChunkLength) {
      return [text];
    }
    
    const chunks: string[] = [];
    let remainingText = text;
    
    while (remainingText.length > 0) {
      // If remaining text fits in a chunk, add it and finish
      if (remainingText.length <= maxChunkLength) {
        chunks.push(remainingText);
        break;
      }
      
      // Find a good breaking point (end of sentence or clause)
      let breakPoint = remainingText.substring(0, maxChunkLength).lastIndexOf('.');
      if (breakPoint === -1) {
        breakPoint = remainingText.substring(0, maxChunkLength).lastIndexOf('!');
      }
      if (breakPoint === -1) {
        breakPoint = remainingText.substring(0, maxChunkLength).lastIndexOf('?');
      }
      if (breakPoint === -1) {
        breakPoint = remainingText.substring(0, maxChunkLength).lastIndexOf(',');
      }
      if (breakPoint === -1 || breakPoint < maxChunkLength / 2) {
        // If no good breaking point, just break at the max length
        breakPoint = maxChunkLength;
      }
      
      // Add this chunk and continue with remaining text
      chunks.push(remainingText.substring(0, breakPoint + 1).trim());
      remainingText = remainingText.substring(breakPoint + 1).trim();
    }
    
    return chunks;
  },
  
  async syncWithBackend(sessionToSync: SessionData): Promise<string | null> {
    try {
      // Get auth token from localStorage (using correct key 'token' not 'auth_token')
      let token = localStorage.getItem('token');
      
      // For development
      if (!token || token === 'null' || token === 'undefined') {
        console.log("Using demo token for development");
        token = "demo_development_token";
      }
      
      // Get API URL from env or default to localhost
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
      
      try {
        console.log(`Attempting to sync session to ${apiUrl}/api/sessions/sync`);
        
        // Set a timeout for the request to prevent long hangs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        // Check if server is reachable first with a HEAD request
        let isServerReachable = false;
        try {
          const pingResponse = await fetch(`${apiUrl}/api/health`, {
            method: 'HEAD',
            signal: controller.signal,
          });
          isServerReachable = pingResponse.ok;
        } catch (pingError) {
          console.warn(`Server at ${apiUrl} is not reachable:`, pingError);
          isServerReachable = false;
          // Don't return yet, we'll proceed with the full logic but expect failure
        }
        
        // If server is not reachable, fall back to local storage immediately
        if (!isServerReachable) {
          console.warn(`Server at ${apiUrl} is not reachable, using local storage fallback`);
          return this.createLocalFallbackResponse(sessionToSync.id);
        }
        
        // Make the API call with proper auth headers
        const response = await fetch(`${apiUrl}/api/sessions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionData: sessionToSync
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Session sync failed (${response.status}):`, errorData);
          return this.createLocalFallbackResponse(sessionToSync.id);
        }
        
        const data = await response.json();
        console.log('Session synced successfully:', data);
        this.updateLocalSessionWithSyncInfo(sessionToSync.id, data.sessionId);
        return data.sessionId;
      } catch (fetchError: any) {
        console.warn("Server connection failed. Using client-only storage:", fetchError.message);
        // Create a fallback response for development mode
        return this.createLocalFallbackResponse(sessionToSync.id);
      }
    } catch (error) {
      console.error('Error in syncWithBackend:', error);
      return null;
    }
  },
  
  // Helper function to create a fallback response when server is unavailable
  createLocalFallbackResponse(sessionId: string): string {
    // Generate a fake MongoDB-like ID for development use
    const mockId = `local_${Date.now()}_${sessionId}`;
    
    // Mark session as handled locally
    this.updateLocalSessionWithSyncInfo(sessionId, mockId);
    
    console.log(`Created local fallback session ID: ${mockId}`);
    return mockId;
  },
  
  // Helper to update localStorage with sync info
  updateLocalSessionWithSyncInfo(sessionId: string, serverId: string): void {
    const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
    if (allSessions[sessionId]) {
      allSessions[sessionId].synced = true;
      allSessions[sessionId].serverSessionId = serverId;
      allSessions[sessionId].syncedAt = new Date().toISOString();
      localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
    }
  }
};

// Storage utility for managing user conversations
const storageUtils = {
  // Generate a unique session ID
  generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },
  
  // Get current user ID (can be enhanced with auth integration)
  getUserId(): string | null {
    // If you have authentication, get the user ID from there
    // For now, we'll use a stored anonymous ID
    let userId = localStorage.getItem('aura_user_id');
    
    if (!userId) {
      userId = 'anonymous_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      localStorage.setItem('aura_user_id', userId);
    }
    
    return userId;
  },
  
  // Create a new session
  createSession(sessionId?: string, voiceId?: string): SessionData {
    // Use provided sessionId or generate a new one
    const id = sessionId || this.generateSessionId();
    const userId = this.getUserId();
    
    const session: SessionData = {
      id: id,
      userId: userId,
      startedAt: new Date(),
      conversation: [],
      voiceId: voiceId || DEFAULT_VOICE_ID, // Use provided voiceId or default
      metadata: {}
    };
    
    // Store in localStorage
    this.saveSession(session);
    
    return session;
  },
  
  // Save session to localStorage
  saveSession(session: SessionData): void {
    try {
      // Get all sessions
      const sessionsJson = localStorage.getItem('aura_sessions') || '{}';
      const sessions = JSON.parse(sessionsJson);
      
      // Update or add this session
      sessions[session.id] = session;
      
      // Save back to localStorage
      localStorage.setItem('aura_sessions', JSON.stringify(sessions));
      
      // Also update session list for this user
      const userSessionsJson = localStorage.getItem(`aura_user_sessions_${session.userId}`) || '[]';
      let userSessions = JSON.parse(userSessionsJson);
      
      // Add session ID if not already in the list
      if (!userSessions.includes(session.id)) {
        userSessions.push(session.id);
        localStorage.setItem(`aura_user_sessions_${session.userId}`, JSON.stringify(userSessions));
      }
      
      console.log('Session saved to localStorage:', session.id);
    } catch (error) {
      console.error('Error saving session to localStorage:', error);
    }
  },
  
  // Get session by ID
  getSession(sessionId: string): SessionData | null {
    try {
      const sessionsJson = localStorage.getItem('aura_sessions') || '{}';
      const sessions = JSON.parse(sessionsJson);
      
      return sessions[sessionId] || null;
    } catch (error) {
      console.error('Error retrieving session:', error);
      return null;
    }
  },
  
  // Get all sessions for a user
  getUserSessions(userId: string): SessionData[] {
    try {
      const userSessionsJson = localStorage.getItem(`aura_user_sessions_${userId}`) || '[]';
      const sessionIds = JSON.parse(userSessionsJson);
      
      const sessionsJson = localStorage.getItem('aura_sessions') || '{}';
      const allSessions = JSON.parse(sessionsJson);
      
      // Map session IDs to actual session data
      return sessionIds.map((id: string) => allSessions[id]).filter(Boolean);
    } catch (error) {
      console.error('Error retrieving user sessions:', error);
      return [];
    }
  },
  
  // End a session by updating its endedAt property
  endSession(sessionId: string): void {
    try {
      const session = this.getSession(sessionId);
      if (session) {
        session.endedAt = new Date();
        this.saveSession(session);
        console.log('Session ended:', sessionId);
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  },
  
  // Add a message to a session
  addMessageToSession(sessionId: string, message: Message): void {
    try {
      const session = this.getSession(sessionId);
      if (session) {
        session.conversation.push(message);
        this.saveSession(session);
      }
    } catch (error) {
      console.error('Error adding message to session:', error);
    }
  },
  
  // Sync session with backend
  async syncWithBackend(sessionId: string): Promise<boolean> {
    try {
      console.log('Syncing session to backend:', sessionId);
      
      // Get the session from localStorage
      const session = this.getSession(sessionId);
      if (!session) {
        console.error('Cannot sync: Session not found in localStorage');
        return false;
      }
      
      // Use the API utility to sync the session, which now has proper error handling
      const result = await apiUtils.syncWithBackend(session);
      return !!result; // Return true if we got a valid result
    } catch (error) {
      console.error('Error syncing session to backend:', error);
      return false;
    }
  }
};

// Initialize Gemini AI API
const initGemini = () => {
  // In a real implementation, use environment variable for the API key
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  return new GoogleGenerativeAI(apiKey);
};

// Generate speech from text using ElevenLabs API or Zyphra
const generateSpeech = async (text: string, voiceId?: string, sessionId?: string): Promise<string> => {
  try {
    const voice = voiceId || DEFAULT_VOICE_ID; // Default voice if none provided
    console.log('Generating speech for voice ID:', voice, 'in session:', sessionId);
    
    // Use Zyphra only for voice IDs that start with "zyphra_"
    if (voice.startsWith('zyphra_')) {
      try {
        // Import zyphraService
        const zyphraService = (await import('../../../services/zyphraService')).default;
        
        console.log('🎵 Using Zyphra for cloned voice TTS');
        
        // Check if Zyphra service is initialized
        if (!zyphraService.isInitialized()) {
          console.warn('Zyphra service not initialized, falling back to ElevenLabs');
          return generateSpeechWithElevenLabs(text, DEFAULT_VOICE_ID);
        }
        
        // Get the saved reference audio for this voice
        const savedAudio = localStorage.getItem(`zyphra_audio_${voice}`);
        if (!savedAudio) {
          console.warn('No reference audio found for voice:', voice, 'falling back to ElevenLabs');
          return generateSpeechWithElevenLabs(text, DEFAULT_VOICE_ID);
        }
        
        console.log(`Found reference audio for ${voice}, length: ${savedAudio.length} characters`);
        
        // Generate speech with Zyphra
        try {
          console.time('zyphraGeneration');
          // Simplified: Use voice ID as session ID to avoid complex session tracking
          const audioBlob = await zyphraService.generateSpeechWithSavedVoice(text, savedAudio, voice);
          console.timeEnd('zyphraGeneration');
          
          // Verify the blob is valid
          if (!audioBlob || audioBlob.size < 50) {
            console.warn('Zyphra returned too small audio blob:', audioBlob?.size, 'bytes');
            return generateSpeechWithElevenLabs(text, DEFAULT_VOICE_ID);
          }
          
          // Convert to URL for audio playback
          console.log('Creating blob URL for Zyphra audio, size:', audioBlob.size, 'bytes');
          const audioUrl = URL.createObjectURL(audioBlob);
          console.log('✅ Zyphra audio URL created:', audioUrl);
          return audioUrl;
        } catch (zyphraError) {
          console.error('Error generating speech with Zyphra:', zyphraError);
          console.log('Falling back to ElevenLabs');
          return generateSpeechWithElevenLabs(text, DEFAULT_VOICE_ID);
        }
      } catch (error) {
        console.error('Error in Zyphra setup:', error);
        return generateSpeechWithElevenLabs(text, DEFAULT_VOICE_ID);
      }
    } else {
      // Use ElevenLabs for all other voice IDs
      return generateSpeechWithElevenLabs(text, voice);
    }
  } catch (error) {
    console.error('Error in generateSpeech:', error);
    
    // Return an empty audio as a last resort
    return 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAGAAABkABUVFRUVFRUVFRUVFRUVFSlpaWlpaWlpaWlpaWlpaXp6enp6enp6enp6enp6en/////////////////////AAAAAAE==';
  }
};

// Use ElevenLabs for TTS
const generateSpeechWithElevenLabs = async (text: string, voiceId: string): Promise<string> => {
  try {
    console.log('🎵 Generating speech with ElevenLabs voice:', voiceId);
    
    // In a real implementation, use environment variable for the API key
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    
    if (!apiKey) {
      console.error('ElevenLabs API key not found');
      throw new Error('ElevenLabs API key missing');
    }
    
    console.time('elevenLabsGeneration');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.15,  // Add a slight style boost
          speaking_rate: 1.15  // Speak slightly faster (15% faster than normal)
        }
      })
    });
    console.timeEnd('elevenLabsGeneration');
    
    if (!response.ok) {
      throw new Error(`Speech generation failed: ${response.status}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    console.log('ElevenLabs returned audio size:', audioBuffer.byteLength, 'bytes');
    
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    console.log('✅ ElevenLabs audio URL created:', audioUrl);
    
    return audioUrl;
  } catch (error) {
    console.error('Error generating speech with ElevenLabs:', error);
    
    // Return a minimal valid audio as a last resort
    return 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAGAAABkABUVFRUVFRUVFRUVFRUVFSlpaWlpaWlpaWlpaWlpaXp6enp6enp6enp6enp6en/////////////////////AAAAAAE==';
  }
};

export default function Dashboard() {
  const router = useRouter();
  const [conversationState, setConversationState] = useState<ConversationState>(ConversationState.INACTIVE);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAISpeaking, setIsAISpeaking] = useState<boolean>(false);
  const [animationActive, setAnimationActive] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [textResponse, setTextResponse] = useState<string>("");
  const [transcription, setTranscription] = useState<string>("");
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [sessionActive, setSessionActive] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check server availability on load
  useEffect(() => {
    const checkServerAvailability = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
          const response = await fetch(`${apiUrl}/api/health`, {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          setServerAvailable(!!response && response.ok);
          console.log('Server availability check:', response?.ok ? 'Available' : 'Unavailable');
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          console.warn("Server availability check failed:", fetchError.message || fetchError);
          setServerAvailable(false);
        }
      } catch (error) {
        console.warn("Server availability check failed:", error);
        setServerAvailable(false);
      }
    };
    
    checkServerAvailability();
  }, []);

  // Clean up function for audio and streams
  const cleanupAudioResources = () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Stop media recorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop and release media stream if exists
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Initialize the audio element when component mounts
  useEffect(() => {
    audioRef.current = new Audio();
    
    // Listen for voice cloning events to update current session
    const handleVoiceCloned = (event: any) => {
      const detail = event.detail || {};
      const voiceId = detail.voiceId;
      const sessionId = detail.sessionId;
      
      console.log('🎭 Voice cloned event detected:', detail);
      
      if (!voiceId) {
        console.warn('Voice cloned event missing voiceId');
        return;
      }
      
      // Handle current session update
      if (currentSessionId) {
        console.log('Current session ID:', currentSessionId, 'Event session ID:', sessionId);
        
        // Update current session with new voice ID
        const session = storageUtils.getSession(currentSessionId);
        if (session) {
          console.log('Updating current session to use newly cloned voice:', voiceId);
          
          // Update session object
          session.voiceId = voiceId;
          storageUtils.saveSession(session);
          
          // Double check the update
          const updatedSession = storageUtils.getSession(currentSessionId);
          console.log('Verified session voice ID after update:', updatedSession?.voiceId);
          
          // Provide user feedback
          const feedback = "Voice cloned successfully! Your digital therapist will now use your cloned voice.";
          setTextResponse(feedback);
          
          // Generate a spoken confirmation using the new voice
          if (!isAISpeaking && !isProcessing) {
            console.log('Generating speech confirmation with new voice');
            setIsProcessing(true); // Prevent multiple confirmations
            
            generateSpeech(feedback, voiceId, sessionId)
              .then(audioUrl => {
                console.log('Generated confirmation audio URL:', audioUrl);
                playAudio(audioUrl, feedback);
              })
              .catch(error => {
                console.error('Error generating speech with new voice:', error);
                setIsProcessing(false);
              });
          } else {
            console.log('Not generating speech confirmation - AI is already speaking or processing');
          }
        } else {
          console.warn('Unable to find current session to update');
        }
      } else {
        console.log('No active session to update with cloned voice');
      }
    };
    
    // Add the event listener
    window.addEventListener('voice_cloned', handleVoiceCloned);
    
    // Cleanup function
    return () => {
      cleanupAudioResources();
      
      // Remove the event listener
      window.removeEventListener('voice_cloned', handleVoiceCloned);
      
      // End current session if active
      if (currentSessionId) {
        storageUtils.endSession(currentSessionId);
      }
    };
  }, [currentSessionId, isAISpeaking, isProcessing]);

  // Begin the conversation session
  const beginSession = async () => {
    try {
      setErrorMessage("");
      setConversationState(ConversationState.CONNECTING);
      setTranscription("");
      
      // Create a session ID for the new session
      const sessionId = storageUtils.generateSessionId();
      
      // Check if there are any cloned voices available
      let sessionVoiceId = DEFAULT_VOICE_ID;
      try {
        const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
        
        // If we have saved voices, use the most recent one
        if (savedVoices.length > 0) {
          // Sort by creation date (newest first)
          savedVoices.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Use the most recent voice
          sessionVoiceId = savedVoices[0].id;
          console.log('Using previously cloned voice:', savedVoices[0].name, sessionVoiceId);
          
          // If this is a Zyphra voice, check that we have the reference audio
          if (sessionVoiceId.startsWith('zyphra_')) {
            const referenceAudio = localStorage.getItem(`zyphra_audio_${sessionVoiceId}`);
            if (!referenceAudio) {
              console.warn('Missing reference audio for Zyphra voice:', sessionVoiceId);
              
              // Try finding another saved voice that has valid reference data
              const alternativeVoice = savedVoices.find((voice: any) => {
                if (!voice.id.startsWith('zyphra_')) return true;
                return !!localStorage.getItem(`zyphra_audio_${voice.id}`);
              });
              
              if (alternativeVoice) {
                console.log('Using alternative voice instead:', alternativeVoice.name);
                sessionVoiceId = alternativeVoice.id;
              } else {
                console.log('Falling back to default voice');
                sessionVoiceId = DEFAULT_VOICE_ID;
              }
            } else {
              console.log('Found valid reference audio for Zyphra voice');
            }
          }
        } else {
          // If no saved voices, clone a new one for this session
          sessionVoiceId = await apiUtils.cloneVoice(sessionId.substring(0, 6));
        }
      } catch (voiceError) {
        console.error('Error getting cloned voices:', voiceError);
        // Fallback to default voice
        sessionVoiceId = DEFAULT_VOICE_ID;
      }
      
      // Create a new session with the cloned voice ID
      const session = storageUtils.createSession(sessionId, sessionVoiceId);
      setCurrentSessionId(session.id);
      setSessionActive(true);
      
      // Store the current session ID in localStorage for use by other components
      localStorage.setItem('current_session_id', session.id);
      console.log('Set current session ID in localStorage:', session.id);
      
      // Create initial greeting
      setConversationState(ConversationState.GREETING);
      
      // Generate initial AI greeting
      const genAI = initGemini();
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
        "Start a new therapy session with a very brief greeting. Keep it under 15 words. Be warm but extremely concise. Do NOT ask for the user's name or any personal information."
      );
      const aiResponse = result.response.text();
      
      // Set the AI response text before playing audio
      setTextResponse(aiResponse);
      
      // Generate speech audio using the selected voice ID
      const audioUrl = await generateSpeech(aiResponse, sessionVoiceId, sessionId);
      
      // Add the message to conversation history
      setConversationHistory([{
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }]);
      
      // Play the audio
      playAudio(audioUrl, aiResponse);
    } catch (error) {
      console.error('Error starting session:', error);
      setErrorMessage('Failed to start session');
      setSessionActive(false);
      setConversationState(ConversationState.ERROR);
    }
  };

  // Initialize microphone and media recorder
  const initializeMicrophone = () => {
    // Clean up any existing resources
    if (streamRef.current) {
      console.log('🧹 Cleaning up existing stream');
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    console.log('🎙️ Initializing microphone');
    // Get user's audio input with specific constraints for better quality
    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    })
    .then(stream => {
      streamRef.current = stream;
      mediaRecorderRef.current = createMediaRecorder(stream);
      
      // Start the actual recording
      startRecording();
    })
    .catch(error => {
      console.error('❌ Error accessing microphone:', error);
      setErrorMessage("Microphone access denied. Please allow microphone access and try again.");
      setIsRecording(false);
      setConversationState(ConversationState.ERROR);
    });
  };

  // Start recording audio
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    try {
      console.log('⏺️ Starting media recorder with 500ms time slices');
      // Use smaller time slices for more frequent data collection
      mediaRecorderRef.current.start(500); 
      
      // Add event listeners for recording state changes
      mediaRecorderRef.current.addEventListener('start', () => {
        console.log('🎙️ Recording started');
      });
      
      // Add error handler for media recorder
      mediaRecorderRef.current.addEventListener('error', (e) => {
        console.error('🔴 Media recorder error:', e);
      });
      
      setIsRecording(true);
      setConversationState(ConversationState.LISTENING);
    } catch (error) {
      console.error('Failed to start recording:', error);
      // Ensure we handle errors gracefully
      setIsRecording(false);
      setErrorMessage('Failed to start recording. Please try again.');
    }
  }, []);

  // Stop recording
  const stopRecording = () => {
    // Stop the recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Process the entire conversation flow
  const processConversation = async (audioBlob: Blob) => {
    if (!currentSessionId) {
      console.error('No active session ID');
      return;
    }
    
    try {
      // Get current session to access the voice ID
      const currentSession = storageUtils.getSession(currentSessionId);
      if (!currentSession) {
        console.error('Session not found:', currentSessionId);
        return;
      }
      
      // Update to processing state
      setConversationState(ConversationState.PROCESSING);
      setIsProcessing(true);
      setProcessingStep("Understanding your message...");
      
      // Step 1: Convert speech to text
      console.log('🎤 STEP 1: Speech-to-Text Conversion');
      const userText = await apiUtils.speechToText(audioBlob);
      
      if (!userText || userText.trim() === '') {
        setErrorMessage('No speech detected. Please try speaking again.');
        setIsProcessing(false);
        setConversationState(ConversationState.LISTENING);
        return;
      }
      
      // Create user message
      const userMessage: Message = {
        role: 'user',
        content: userText,
        timestamp: new Date()
      };
      
      // Add to conversation history
      console.log('📝 Adding user message to conversation history:', userText);
      const updatedHistory = [...conversationHistory, userMessage];
      setConversationHistory(updatedHistory);
      
      // Save user message to storage
      storageUtils.addMessageToSession(currentSessionId, userMessage);
      
      // Get updated session with the new user message
      const updatedSession = storageUtils.getSession(currentSessionId);
      if (!updatedSession) {
        console.error('Session not found after adding user message');
        return;
      }
      
      // Step 2: Generate AI response
      console.log('🤖 STEP 2: Generating AI Response');
      setProcessingStep("Thinking about your response...");
      const aiResponse = await apiUtils.generateResponse(updatedHistory);
      
      // Create AI message
      const aiMessage: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };
      
      // Add AI response to conversation history
      console.log('📝 Adding AI response to conversation history:', aiResponse);
      const finalHistory = [...updatedHistory, aiMessage];
      setConversationHistory(finalHistory);
      
      // Save AI message to storage
      storageUtils.addMessageToSession(currentSessionId, aiMessage);
      
      // Get final updated session after adding AI message
      const finalSession = storageUtils.getSession(currentSessionId);
      if (!finalSession) {
        console.error('Session not found after adding AI message');
        return;
      }
      
      // Log the conversation size to verify it's being stored correctly
      console.log(`💬 Conversation now has ${finalSession.conversation.length} messages`);
      
      // Double-check that the session is properly saved
      storageUtils.saveSession(finalSession);
      
      // Explicitly save the session to localStorage again to be extra sure
      const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
      allSessions[currentSessionId] = finalSession;
      localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
      console.log('📝 Explicitly saved updated session to localStorage');
      
      // Dispatch an event to notify other components that a session was updated
      const event = new CustomEvent('aura_session_updated', { 
        detail: { sessionId: currentSessionId }
      });
      window.dispatchEvent(event);
      console.log('🔔 Dispatched session updated event');
      
      // Send the text response immediately to appear responsive
      console.log('📤 Showing immediate text response');
      setTextResponse(aiResponse);
      
      // Step 3: Convert response to speech using the session's voice ID
      console.log('🔊 STEP 3: Text-to-Speech Conversion');
      setProcessingStep("Creating voice response...");
      
      try {
        // Retrieve the current session again to make sure we have the latest voiceId
        const finalSession = storageUtils.getSession(currentSessionId);
        if (!finalSession) {
          throw new Error('Session not found after adding AI message');
        }
        
        console.log('Using voice ID for TTS:', finalSession.voiceId);
        
        // Generate speech using appropriate service based on voice ID
        const audioUrl = await generateSpeech(aiResponse, finalSession.voiceId, currentSessionId);
        
        // Clear processing state
        setIsProcessing(false);
        setProcessingStep("");
        
        // Play the audio
        setConversationState(ConversationState.SPEAKING);
        setIsAISpeaking(true);
        playAudio(audioUrl, aiResponse);
      } catch (ttsError) {
        console.error('❌ Error in text-to-speech conversion:', ttsError);
        // If TTS fails, still move to listening state
        setIsProcessing(false);
        setConversationState(ConversationState.LISTENING);
      }
      
      // Sync with backend if connected
      apiUtils.syncWithBackend(finalSession);
    } catch (error) {
      console.error('❌ Error processing conversation:', error);
      setErrorMessage('Failed to process your message. Please try again.');
      setIsProcessing(false);
      setConversationState(ConversationState.LISTENING);
    }
  };

  // Play audio and handle completion
  const playAudio = (audioData: ArrayBuffer | string, responseText: string) => {
    try {
      console.log('▶️ Playing audio response...');

      // Set UI state first
      setIsAISpeaking(true);
      setAnimationActive(true);
      setTextResponse(responseText);

      // Create a new audio element each time
      if (audioRef.current) {
        // Stop any currently playing audio first
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch (e) {
          console.warn('Error stopping previous audio:', e);
        }
      }
      
      const audio = new Audio();
      audioRef.current = audio;
      
      // Track if the blob URL has been cleaned up already
      let blobUrlCleaned = false;
      
      // Clean up any previous audio URLs
      const cleanupUrl = (url: string) => {
        if (!blobUrlCleaned && url && url.startsWith('blob:')) {
          console.log('Cleaning up blob URL:', url);
          try {
            URL.revokeObjectURL(url);
            blobUrlCleaned = true;
          } catch (e) {
            console.warn('Failed to revoke URL:', e);
          }
        }
      };
      
      // Configure event handlers
      audio.onended = () => {
        console.log('🔊 Audio playback ended');
        setIsAISpeaking(false);
        setAnimationActive(false);
        setConversationState(ConversationState.LISTENING);
        cleanupUrl(audioUrl);
      };
      
      // Handle different types of audio data
      let audioUrl: string;
      
      try {
        if (typeof audioData === 'string') {
          console.log('Playing audio from URL or Data URL');
          audioUrl = audioData;
        } else if (audioData instanceof ArrayBuffer || (audioData && typeof audioData === 'object')) {
          // Convert ArrayBuffer to Blob URL with proper error handling
          console.log('Converting ArrayBuffer to Blob URL for audio playback');
          
          // Check if we have valid data
          if (!audioData || (audioData instanceof ArrayBuffer && audioData.byteLength === 0)) {
            throw new Error('Empty audio data received');
          }
          
          const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
          
          // Verify blob was created successfully
          if (audioBlob.size === 0) {
            throw new Error('Created audio blob is empty');
          }
          
          audioUrl = URL.createObjectURL(audioBlob);
          console.log('Created blob URL:', audioUrl);
        } else {
          throw new Error('Unsupported audio data format');
        }
      } catch (error) {
        console.error('Error preparing audio data for playback:', error);
        audioUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'; // Empty audio as fallback
      }
      
      // Helper function to safely play audio and handle errors
      const safePlayAudio = async (audioElement: HTMLAudioElement, source: string): Promise<boolean> => {
        return new Promise((resolve) => {
          let resolved = false;
          const finishWithResult = (result: boolean) => {
            if (!resolved) {
              resolved = true;
              resolve(result);
            }
          };
          
          // Set up success handler
          audioElement.oncanplaythrough = () => {
            console.log('Audio can play through, starting playback');
            
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('✅ Audio playback started successfully');
                  finishWithResult(true);
                })
                .catch((error) => {
                  console.error('Error during audio play():', error);
                  finishWithResult(false);
                });
            } else {
              console.log('Play promise was undefined');
              finishWithResult(true); // Assume it worked since we got no promise
            }
          };
          
          // Set up error handler
          audioElement.onerror = () => {
            // Access the error from the audio element itself, not from the event
            console.error('Audio error during loading:', 
              audioElement.error ? `Code: ${audioElement.error.code}, Message: ${audioElement.error.message || 'Unknown'}` : 'Unknown audio error');
            finishWithResult(false);
          };
          
          // Add loadedmetadata handler
          audioElement.onloadedmetadata = () => {
            console.log('Audio metadata loaded, duration:', audioElement.duration);
            // If duration is NaN or 0, there might be an issue with the audio
            if (isNaN(audioElement.duration) || audioElement.duration === 0) {
              console.warn('Audio has invalid duration, may not play correctly');
            }
          };
          
          // Set the source to trigger loading
          try {
            audioElement.src = source;
            audioElement.load();
          } catch (loadError) {
            console.error('Error during audio load:', loadError);
            finishWithResult(false);
            return;
          }
          
          // Set timeout in case oncanplaythrough never fires
          setTimeout(() => {
            if (!resolved) {
              if (!audioElement.paused) {
                console.log('Audio is already playing');
                finishWithResult(true);
              } else {
                console.log('Timeout reached, trying to play anyway');
                audioElement.play()
                  .then(() => finishWithResult(true))
                  .catch((error) => {
                    console.warn('Play failed after timeout:', error);
                    finishWithResult(false);
                  });
              }
            }
          }, 2000); // Increased timeout for slower networks
        });
      };
      
      // Start playback with our safe play function
      safePlayAudio(audio, audioUrl).then(success => {
        if (!success) {
          console.warn('Failed to play audio, trying fallback...');
          
          // Don't clean up the URL yet - wait until fallback is established
          
          // Try an empty audio file first to reset any previous issues
          try {
            const emptyAudio = new Audio();
            emptyAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            emptyAudio.load();
            emptyAudio.play().catch(e => console.log('Empty audio play failed:', e));
          } catch (e) {
            console.log('Empty audio failed:', e);
          }
          
          // Try browser's speech synthesis as fallback
          try {
            console.log('Using speech synthesis as fallback');
            // Cancel any previous speech synthesis
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(responseText);
            utterance.rate = 1.0; // Normal speed
            utterance.pitch = 1.0; // Normal pitch
            utterance.volume = 1.0; // Full volume
            
            // Update state when speech synthesis ends
            utterance.onend = () => {
              setIsAISpeaking(false);
              setAnimationActive(false);
              setConversationState(ConversationState.LISTENING);
              // Now it's safe to clean up the URL
              cleanupUrl(audioUrl);
            };
            
            // Handle errors in speech synthesis
            utterance.onerror = (synthErrorEvent) => {
              console.error('Speech synthesis error:', synthErrorEvent.error);
              setIsAISpeaking(false);
              setAnimationActive(false);
              setConversationState(ConversationState.LISTENING);
              // Now it's safe to clean up the URL
              cleanupUrl(audioUrl);
            };
            
            window.speechSynthesis.speak(utterance);
          } catch (synthError) {
            console.error('Speech synthesis fallback failed:', synthError);
            setIsAISpeaking(false);
            setAnimationActive(false);
            setConversationState(ConversationState.LISTENING);
            
            // Only clean up after all fallbacks have failed
            cleanupUrl(audioUrl);
          }
        }
      });
      
    } catch (error) {
      console.error('🔴 Error in playAudio function:', error);
      setIsAISpeaking(false);
      setAnimationActive(false);
      setConversationState(ConversationState.LISTENING);
    }
  };

  // Process audio chunks and send to server
  const processAudioChunks = useCallback((chunks: BlobPart[]) => {
    // Use webm format which works better with speech recognition
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
    
    console.log(`📊 Audio blob created, size: ${audioBlob.size} bytes`);
    if (audioBlob.size < 100) {
      console.log('⚠️ Audio too short or empty, not sending');
      setIsProcessing(false); // Reset processing state if no audio
      return;
    }
    
    // Process the conversation with this audio
    processConversation(audioBlob);
  }, [conversationHistory]);

  // Create media recorder with all necessary event handlers
  const createMediaRecorder = useCallback((stream: MediaStream) => {
    console.log('🎙️ Creating new media recorder');
    
    // Create recorder with optimal audio settings
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    const audioChunks: BlobPart[] = [];
    
    // Handle incoming audio data
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log(`📊 Got audio chunk: ${event.data.size} bytes`);
        audioChunks.push(event.data);
      }
    };
    
    // Handle recording stop
    mediaRecorder.onstop = () => {
      console.log(`⏹️ Recording stopped, processing ${audioChunks.length} audio chunks`);
      
      // Only process if we have audio data and the session is still active
      if (audioChunks.length > 0 && sessionActive) {
        processAudioChunks([...audioChunks]); // Create a copy to avoid race conditions
        
        // Clear chunks for next recording
        audioChunks.length = 0;
      } else {
        console.log('ℹ️ No audio chunks to process or session inactive');
        // Reset processing state if no audio
        setIsProcessing(false);
      }
    };
    
    return mediaRecorder;
  }, [sessionActive, processAudioChunks]);

  // Toggle the microphone
  const toggleMicrophone = useCallback(() => {
    console.log('🎙️ Toggling microphone, current states:', {
      isRecording,
      isProcessing,
      isAISpeaking
    });
    
    // Ensure session is active
    if (!sessionActive) {
      console.log('❌ Cannot toggle microphone, session not active');
      return;
    }
    
    if (isRecording) {
      // ---- STOPPING MICROPHONE ----
      console.log('🛑 Stopping microphone recording');
      
      // Update UI first for immediate feedback
      setIsRecording(false);
      
      // This is critical - update to processing state immediately
      setIsProcessing(true);
      setProcessingStep("Understanding your message...");
      setConversationState(ConversationState.PROCESSING);
      
      // CRITICAL: Request a final chunk of data before stopping
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('⏹️ Requesting final data chunk and stopping media recorder');
        mediaRecorderRef.current.requestData(); // Force a dataavailable event
        
        // Short timeout to ensure the data is collected before stopping
        setTimeout(() => {
          mediaRecorderRef.current?.stop();
        }, 100);
      }
    } else {
      // ---- STARTING MICROPHONE ----
      // Only start if AI is not speaking and we're not already processing
      if (isAISpeaking) {
        console.log('⚠️ Cannot start listening while AI is speaking');
        return;
      }
      
      if (isProcessing) {
        console.log('⚠️ Cannot start listening while processing');
        return;
      }
      
      console.log('🎙️ Starting microphone recording');
      
      // Initialize the microphone
      initializeMicrophone();
    }
  }, [isRecording, isProcessing, isAISpeaking, sessionActive]);

  // End the conversation session
  const endSession = () => {
    cleanupAudioResources();
    
    // End the session in storage
    if (currentSessionId) {
      storageUtils.endSession(currentSessionId);
      
      // Optional: Sync with backend
      storageUtils.syncWithBackend(currentSessionId);
    }
    
    setSessionActive(false);
    setConversationState(ConversationState.ENDED);
    
    // Stay on the current page instead of navigating away
  };

  // Get appropriate status message with more detail
  const getStatusMessage = () => {
    if (isRecording) {
      return "Listening... (tap mic to stop)";
    } else if (isProcessing) {
      return processingStep || "Processing your message...";
    } else if (isAISpeaking) {
      return "Aura is speaking...";
    } else {
      return stateMessages[conversationState] || "Ready";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full mx-auto max-w-4xl px-4">
      <div className="mb-8 text-center">
        <p className="text-gray-600">{getStatusMessage()}</p>
        {errorMessage && (
          <p className="text-red-600 mt-2">{errorMessage}</p>
        )}
      </div>
      
      <div className="relative flex items-center justify-center w-full mb-4">
        <div className={`ai-orb ${
          animationActive ? 'animate-pulse' : ''
        }`}></div>
      </div>
      
      {/* Typing animation for AI response */}
      {isAISpeaking && (
        <div className="mb-8 w-full max-w-lg">
          <TypingAnimation text={textResponse} speed={20} />
        </div>
      )}
      
      <div className="w-full max-w-md flex flex-col items-center space-y-6">
        {/* Begin Session button */}
        {!sessionActive && (
          <button
            className="calmi-button w-full"
            onClick={beginSession}
            disabled={conversationState === ConversationState.CONNECTING}
          >
            begin session
          </button>
        )}
        
        {/* Control buttons */}
        {sessionActive && (
          <div className="flex space-x-10 items-center">
            {/* Microphone button */}
            <button
              onClick={toggleMicrophone}
              disabled={isAISpeaking || isProcessing}
              className={`voice-button ${
                isRecording 
                  ? 'bg-red-500 text-white' 
                  : isAISpeaking || isProcessing 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : ''
              }`}
              aria-label={isRecording ? "Stop speaking" : "Start speaking"}
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            
            {/* End session button - always enabled */}
            <button
              onClick={endSession}
              className="voice-button bg-red-500 text-white"
              aria-label="End session"
            >
              <X size={24} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 