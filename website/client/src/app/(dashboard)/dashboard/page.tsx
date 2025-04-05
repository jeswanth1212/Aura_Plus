'use client';

import React, { use, useEffect, useReducer, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, X, Play, History, BarChart2 } from 'lucide-react';
import TypingAnimation from '@/components/TypingAnimation';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ZyphraClient } from '@zyphra/client';

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
  // Voice Cloning with Zyphra
  async cloneVoice(name: string): Promise<string> {
    try {
      console.log('🎭 Cloning voice with name:', name);
      
      // Get Zyphra API key
      const ZYPHRA_API_KEY = process.env.NEXT_PUBLIC_ZYPHRA_API_KEY;
      if (!ZYPHRA_API_KEY) {
        throw new Error('ZYPHRA_API_KEY not configured');
      }
      
      // Create Zyphra client instance
      const client = new ZyphraClient({ apiKey: ZYPHRA_API_KEY });
      
      // According to the documentation, Zyphra doesn't have a separate voice cloning
      // endpoint - instead, you provide a speaker_audio with each TTS request.
      // For now, we'll just set the flag to use Zyphra for the next session,
      // and the actual voice clone will need to be provided when making the TTS request.
      
      // Set the flag to use Zyphra for the next session
      localStorage.setItem('aura_use_zyphra_next_session', 'true');
      
      // Generate a placeholder voice ID 
      const voiceId = `zyphra_${name}_${Date.now()}`;
      
      console.log('✅ Prepared for Zyphra voice usage:', voiceId);
      
      // Save a placeholder voice entry to localStorage
      const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
      savedVoices.push({
        id: voiceId,
        name: `Aura Session ${name}`,
        createdAt: new Date().toISOString(),
        provider: 'zyphra'
      });
      localStorage.setItem('aura_cloned_voices', JSON.stringify(savedVoices));
      
      return voiceId;
    } catch (error) {
      console.error('❌ Error setting up Zyphra voice:', error);
      throw error;
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
  
  // Text-to-Speech service selector
  async textToSpeech(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<ArrayBuffer> {
    // Check if we should use Zyphra for this session
    const useZyphra = localStorage.getItem('aura_use_zyphra_next_session') === 'true';
    
    if (useZyphra) {
      try {
        return await this.zyphraTTS(text, voiceId);
      } catch (error) {
        console.error('❌ Error using Zyphra TTS, falling back to ElevenLabs:', error);
        // Fall back to ElevenLabs on error
        return await this.elevenLabsTTS(text, voiceId);
      }
    } else {
      // Use default ElevenLabs TTS
      return await this.elevenLabsTTS(text, voiceId);
    }
  },
  
  // Zyphra Text-to-Speech implementation
  async zyphraTTS(text: string, voiceId: string): Promise<ArrayBuffer> {
    try {
      console.log('🎵 Converting text to speech using Zyphra');
      
      // Get Zyphra API key from environment variables
      const ZYPHRA_API_KEY = process.env.NEXT_PUBLIC_ZYPHRA_API_KEY;
      if (!ZYPHRA_API_KEY) {
        throw new Error('ZYPHRA_API_KEY not configured in environment variables');
      }
      
      // Create a Zyphra client instance
      const client = new ZyphraClient({ apiKey: ZYPHRA_API_KEY });
      
      // Parameters for TTS
      const params: any = {
        text: text,
        speaking_rate: 15,
        model: 'zonos-v0.1-transformer'
      };
      
      // Look for saved Zyphra voices
      try {
        const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
        
        // Find the most recent Zyphra voice
        const zyphraVoices = savedVoices.filter((voice: any) => voice.provider === 'zyphra');
        
        if (zyphraVoices.length > 0) {
          // Sort by creation date (newest first)
          const sortedVoices = [...zyphraVoices].sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Use the most recent one
          const latestVoice = sortedVoices[0];
          
          if (latestVoice && latestVoice.id) {
            console.log('✅ Using cloned Zyphra voice:', latestVoice.name);
            
            // Use the saved base64 audio directly as speaker_audio
            params.speaker_audio = latestVoice.id;
            console.log('📊 Using voice data from saved profile');
          } else {
            console.log('⚠️ No valid Zyphra voice found, using default voice parameters');
          }
        } else {
          console.log('⚠️ No Zyphra voices found in local storage');
        }
      } catch (error) {
        console.error('❌ Error retrieving saved voices:', error);
      }
      
      // Log the request (excluding the full base64 data for brevity)
      console.log('🔄 Making Zyphra TTS request with parameters:', {
        ...params,
        speaker_audio: params.speaker_audio ? '[BASE64_AUDIO_DATA]' : 'none'
      });
      
      // Use the Zyphra client directly
      const audioBlob = await client.audio.speech.create(params);
      
      // Convert Blob to ArrayBuffer
      const audioData = await audioBlob.arrayBuffer();
      
      console.log('✅ Successfully converted text to speech with Zyphra');
      
      return audioData;
    } catch (error) {
      console.error('❌ Error in Zyphra text-to-speech conversion:', error);
      throw error;
    }
  },
  
  // Helper method to validate base64 strings
  isValidBase64(str: string): boolean {
    if (typeof str !== 'string') return false;
    if (str.length === 0) return false;
    
    // Simple regex for base64 validation
    return /^[A-Za-z0-9+/=]+$/.test(str);
  },
  
  // Original ElevenLabs Text-to-Speech implementation
  async elevenLabsTTS(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<ArrayBuffer> {
    try {
      console.log('🎵 Converting text to speech using ElevenLabs with voice ID:', voiceId);
      
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
      console.error('❌ Error in ElevenLabs text-to-speech conversion:', error);
      throw error;
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

// Generate speech from text using ElevenLabs API
const generateSpeech = async (text: string, voiceId?: string): Promise<string> => {
  try {
    // In a real implementation, use environment variable for the API key
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice if none provided
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
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
    
    if (!response.ok) {
      throw new Error(`Speech generation failed: ${response.status}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
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
  const socketRef = useRef<any>(null);

  // Check server availability on load
  useEffect(() => {
    const checkServerAvailability = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${apiUrl}/api/health`, {
          method: 'GET',
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        setServerAvailable(!!response && response.ok);
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
    
    // Cleanup function
    return () => {
      cleanupAudioResources();
      
      // End current session if active
      if (currentSessionId) {
        storageUtils.endSession(currentSessionId);
      }
    };
  }, [currentSessionId]);

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
      let isZyphraVoice = false;
      
      try {
        // CRITICAL: Check for cloned voices, with better logging
        console.log('🔍 Checking for cloned voices...');
        
        // Get saved voices from localStorage
        const savedVoices = JSON.parse(localStorage.getItem('aura_cloned_voices') || '[]');
        console.log(`📊 Found ${savedVoices.length} saved voices`);
        
        // If we have saved voices, use the most recent one
        if (savedVoices.length > 0) {
          // Sort by creation date (newest first)
          const sortedVoices = [...savedVoices].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          const mostRecentVoice = sortedVoices[0];
          console.log('🎤 Most recent voice:', {
            name: mostRecentVoice.name,
            provider: mostRecentVoice.provider,
            createdAt: mostRecentVoice.createdAt
          });
          
          // Check if it's a Zyphra voice
          if (mostRecentVoice.provider === 'zyphra') {
            console.log('🎤 Using Zyphra voice:', mostRecentVoice.name);
            // For Zyphra, we need to set this flag
            localStorage.setItem('aura_use_zyphra_next_session', 'true');
            isZyphraVoice = true;
            // For Zyphra, the voice ID is the base64 audio
            sessionVoiceId = mostRecentVoice.id;
            console.log('✅ Zyphra voice selected and flag set');
          } else {
            // For ElevenLabs, use the voice ID directly
            console.log('🎤 Using ElevenLabs voice:', mostRecentVoice.name);
            sessionVoiceId = mostRecentVoice.id;
          }
        } else {
          // If no saved voices, just use the default voice
          console.log('🎤 No cloned voices found, using default voice');
          sessionVoiceId = DEFAULT_VOICE_ID;
        }
      } catch (voiceError) {
        console.error('❌ Error handling voice retrieval:', voiceError);
        // Fallback to default voice
        sessionVoiceId = DEFAULT_VOICE_ID;
      }
      
      // Create a new session with the voice ID
      const session = storageUtils.createSession(sessionId, sessionVoiceId);
      
      // Store whether this is a Zyphra voice in the session metadata
      if (isZyphraVoice) {
        console.log('📝 Setting session metadata for Zyphra voice');
        session.metadata = session.metadata || {};
        session.metadata.voiceProvider = 'zyphra';
        storageUtils.saveSession(session);
      }
      
      setCurrentSessionId(session.id);
      setSessionActive(true);
      
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
      
      // Add the message to conversation history
      setConversationHistory([{
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }]);
      
      console.log('🔊 Generating initial greeting audio with voice provider:', isZyphraVoice ? 'Zyphra' : 'ElevenLabs');
      
      // Generate the initial greeting audio using the appropriate voice
      let audioUrl;
      if (isZyphraVoice) {
        console.log('🎤 Using Zyphra TTS for initial greeting');
        // Use Zyphra TTS for the greeting
        const audioData = await apiUtils.zyphraTTS(aiResponse, sessionVoiceId);
        const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
        audioUrl = URL.createObjectURL(audioBlob);
      } else {
        console.log('🎤 Using ElevenLabs TTS for initial greeting');
        // Use ElevenLabs for the greeting
        audioUrl = await generateSpeech(aiResponse, sessionVoiceId);
      }
      
      // Play the audio
      playAudio(audioUrl, aiResponse);
    } catch (error) {
      console.error('❌ Error starting session:', error);
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
    if (!currentSessionId) return;
    
    setIsProcessing(true);
    setConversationState(ConversationState.PROCESSING);
    
    try {
      // Prepare current session
      console.log('🚀 Processing conversation for session:', currentSessionId);
      const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
      const currentSession = allSessions[currentSessionId];
      
      if (!currentSession) {
        throw new Error(`Session ${currentSessionId} not found in storage`);
      }
      
      // STEP 1: Speech-to-Text Conversion
      console.log('🎤 STEP 1: Speech-to-Text Conversion');
      setProcessingStep("Converting speech to text...");
      
      // Capture user's speech as text
      let userText = '';
      try {
        userText = await apiUtils.speechToText(audioBlob);
        console.log('✅ Speech converted to text:', userText);
      } catch (sttError) {
        console.error('❌ Error in speech-to-text conversion:', sttError);
        // If STT fails, use a default message
        userText = "I'm having trouble processing what you said. Could you please repeat that?";
      }
      
      // Update transcript and UI
      setTranscription(userText);
      
      // Add user's message to conversation history
      const userMessage: Message = {
        role: 'user',
        content: userText,
        timestamp: new Date()
      };
      currentSession.conversation.push(userMessage);
      
      // Save session update to localStorage
      allSessions[currentSessionId] = currentSession;
      localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
      
      // Get final state of session for next steps
      const finalSession = JSON.parse(localStorage.getItem('aura_sessions') || '{}')[currentSessionId];
      
      // Step 2: Generate AI Response
      console.log('🧠 STEP 2: Generating AI Response');
      setProcessingStep("Generating response...");
      
      let aiResponse = '';
      try {
        aiResponse = await apiUtils.generateResponse(conversationHistory);
        console.log('✅ Generated AI response:', aiResponse);
      } catch (aiError) {
        console.error('❌ Error generating AI response:', aiError);
        // Fallback response if AI generation fails
        aiResponse = "I'm having a moment - let me gather my thoughts. What else would you like to discuss?";
      }
      
      // Add AI message to conversation
      const aiMessage: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };
      
      finalSession.conversation.push(aiMessage);
      allSessions[currentSessionId] = finalSession;
      localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
      setConversationHistory(prev => [...prev, userMessage, aiMessage]);
      
      // Step 3: Convert response to speech using the session's voice ID
      console.log('🔊 STEP 3: Text-to-Speech Conversion');
      setProcessingStep("Creating voice response...");
      
      try {
        // Check if the session has Zyphra voice provider in metadata
        const isZyphraVoice = finalSession.metadata?.voiceProvider === 'zyphra' || 
                             localStorage.getItem('aura_use_zyphra_next_session') === 'true';
        
        let audioData;
        if (isZyphraVoice) {
          console.log('🎤 Using Zyphra voice for TTS');
          // Use Zyphra for TTS
          audioData = await apiUtils.zyphraTTS(aiResponse, finalSession.voiceId);
        } else {
          console.log('🎤 Using ElevenLabs voice for TTS');
          // Use ElevenLabs for TTS
          audioData = await apiUtils.elevenLabsTTS(aiResponse, finalSession.voiceId);
        }
        
        // Clear processing state
        setIsProcessing(false);
        setProcessingStep("");
        
        // Play the audio
        setConversationState(ConversationState.SPEAKING);
        setIsAISpeaking(true);
        playAudio(audioData, aiResponse);
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
      setIsAISpeaking(true);
      setAnimationActive(true);
      
      // Set the text to be shown in the typing animation
      setTextResponse(responseText);
      
      // Add the AI message to conversation history
      setConversationHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: responseText,
          timestamp: new Date()
        }
      ]);
      
      if (audioRef.current) {
        // Handle different types of audio data
        if (typeof audioData === 'string') {
          // Already a URL or Data URL
          audioRef.current.src = audioData;
        } else {
          // Convert ArrayBuffer to Blob URL
          const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current.src = audioUrl;
          
          // Set up cleanup for the created URL
          const originalOnEnded = audioRef.current.onended;
          audioRef.current.onended = (event) => {
            URL.revokeObjectURL(audioUrl);
            if (originalOnEnded && typeof originalOnEnded === 'function') {
              // Use proper function call with correct this context
              originalOnEnded.call(audioRef.current!, event);
            }
          };
        }
        
        audioRef.current.onended = () => {
          console.log('🔊 Audio playback ended');
          setIsAISpeaking(false);
          setAnimationActive(false);
          setConversationState(ConversationState.LISTENING);
          
          // After the AI finishes speaking, reset the Zyphra flag
          // This ensures it's only used for one complete AI response
          localStorage.removeItem('aura_use_zyphra_next_session');
        };
        
        audioRef.current.onerror = () => {
          console.error('🔴 Audio playback error');
          setIsAISpeaking(false);
          setAnimationActive(false);
          setConversationState(ConversationState.LISTENING);
          
          // Also reset on error
          localStorage.removeItem('aura_use_zyphra_next_session');
        };
        
        // Play the audio
        audioRef.current.play().catch(err => {
          console.error('🔴 Failed to play audio:', err);
          setIsAISpeaking(false);
          setAnimationActive(false);
          setConversationState(ConversationState.LISTENING);
          
          // Also reset on playback failure
          localStorage.removeItem('aura_use_zyphra_next_session');
        });
      } else {
        console.error('🔴 Audio element not found');
        setIsAISpeaking(false);
        setAnimationActive(false);
        setConversationState(ConversationState.LISTENING);
        
        // Also reset if audio element missing
        localStorage.removeItem('aura_use_zyphra_next_session');
      }
    } catch (error) {
      console.error('🔴 Error playing audio:', error);
      setIsAISpeaking(false);
      setAnimationActive(false);
      setConversationState(ConversationState.LISTENING);
      
      // Also reset on general error
      localStorage.removeItem('aura_use_zyphra_next_session');
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
      
      // Reset Zyphra use flag since session is now complete
      localStorage.removeItem('aura_use_zyphra_next_session');
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

  // Process audio through socket
  const processAudioThroughSocket = async (audioBlob: Blob) => {
    try {
      if (!socketRef.current) {
        throw new Error('Socket connection not established');
      }
      
      // Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = new Uint8Array(arrayBuffer);
      
      // Check if we should use Zyphra for this session
      const useZyphra = localStorage.getItem('aura_use_zyphra_next_session') === 'true';
      
      // Send audio data to the server
      socketRef.current.emit('voice-data', {
        sessionId: currentSessionId,
        audioData: Array.from(audioBuffer),
        useZyphra
      });
      
      return new Promise((resolve, reject) => {
        // Set up a one-time listener for the response
        socketRef.current?.once('voice-response', (response: any) => {
          resolve(response);
        });
        
        // Handle errors
        socketRef.current?.once('error', (error: any) => {
          reject(error);
        });
        
        // Set a timeout in case the server doesn't respond
        setTimeout(() => {
          reject(new Error('Socket response timeout'));
        }, 10000); // 10-second timeout
      });
    } catch (error) {
      console.error('Error processing audio through socket:', error);
      throw error;
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