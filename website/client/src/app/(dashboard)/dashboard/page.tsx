'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, X, Play, History, BarChart2 } from 'lucide-react';

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
  // Voice Cloning with ElevenLabs
  async cloneVoice(name: string): Promise<string> {
    try {
      console.log('🎭 Cloning voice with name:', name);
      
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
      
      console.log('✅ Successfully cloned voice with ID:', data.voice_id);
      
      return data.voice_id;
    } catch (error) {
      console.error('❌ Error in voice cloning:', error);
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
      const modelName = "gemini-1.5-pro";
      
      // Create a better system prompt with length guidelines
      const systemPrompt = {
        role: "user",
        parts: [{
          text: `You are a professional therapist named Aura. Respond to the client with empathy, insight, and therapeutic techniques appropriate to their needs. Keep responses concise (under 3 sentences for simple responses, 4-5 sentences maximum for complex topics).

Your responses should:
- Be warm, empathetic and supportive
- Use reflective listening techniques
- Provide gentle guidance when appropriate
- Ask open-ended questions to encourage exploration
- Avoid overly clinical language or jargon
- Never exceed 150 words total

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
            similarity_boost: 0.75
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
      }
      
      const audioData = await response.arrayBuffer();
      console.log('✅ Successfully converted text to speech');
      
      return audioData;
    } catch (error) {
      console.error('❌ Error in text-to-speech conversion:', error);
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

export default function Dashboard() {
  const router = useRouter();
  const [state, setState] = useState<ConversationState>(ConversationState.INACTIVE);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAISpeaking, setIsAISpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [animationActive, setAnimationActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [processingStep, setProcessingStep] = useState<string>("");
  const [textResponse, setTextResponse] = useState<string>("");
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isGeneratingAIResponse, setIsGeneratingAIResponse] = useState<boolean>(false);
  const [aIChatMessage, setAIChatMessage] = useState<string>("");
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  
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
      setState(ConversationState.CONNECTING);
      setProcessingStep("");
      setTextResponse("");
      
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
      
      // Create initial greeting
      setState(ConversationState.GREETING);
      
      // Generate greeting message
      const greeting = "Hello, I'm Aura, your AI therapy companion. How are you feeling today?";
      console.log('Using greeting:', greeting);
      
      // Add to conversation history
      const greetingMessage: Message = {
        role: 'assistant',
        content: greeting,
        timestamp: new Date()
      };
      
      // Update local state
      setConversationHistory([greetingMessage]);
      
      // Save to storage
      if (session.id) {
        storageUtils.addMessageToSession(session.id, greetingMessage);
      }
      
      // Convert greeting to speech using the session's voice
      try {
        setState(ConversationState.SPEAKING);
        setIsAISpeaking(true);
        setAnimationActive(true);
        
        const audioData = await apiUtils.textToSpeech(greeting, session.voiceId);
        playAudio(audioData, greeting);
      } catch (error) {
        console.error('Failed to create greeting audio:', error);
        setIsAISpeaking(false);
        setAnimationActive(false);
        setState(ConversationState.LISTENING);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      setErrorMessage('Failed to start session');
      setSessionActive(false);
      setState(ConversationState.ERROR);
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
      setIsListening(false);
      setState(ConversationState.ERROR);
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
      
      setIsListening(true);
      setState(ConversationState.LISTENING);
    } catch (error) {
      console.error('Failed to start recording:', error);
      // Ensure we handle errors gracefully
      setIsListening(false);
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
      setState(ConversationState.PROCESSING);
      setIsProcessing(true);
      setProcessingStep("Understanding your message...");
      
      // Step 1: Convert speech to text
      console.log('🎤 STEP 1: Speech-to-Text Conversion');
      const userText = await apiUtils.speechToText(audioBlob);
      
      if (!userText || userText.trim() === '') {
        setErrorMessage('No speech detected. Please try speaking again.');
        setIsProcessing(false);
        setState(ConversationState.LISTENING);
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
        // Use the voice ID associated with this session
        const audioData = await apiUtils.textToSpeech(aiResponse, finalSession.voiceId);
        
        // Clear processing state
        setIsProcessing(false);
        setProcessingStep("");
        
        // Play the audio
        setState(ConversationState.SPEAKING);
        setIsAISpeaking(true);
        playAudio(audioData, aiResponse);
      } catch (ttsError) {
        console.error('❌ Error in text-to-speech conversion:', ttsError);
        // If TTS fails, still move to listening state
        setIsProcessing(false);
        setState(ConversationState.LISTENING);
      }
      
      // Sync with backend if connected
      apiUtils.syncWithBackend(finalSession);
    } catch (error) {
      console.error('❌ Error processing conversation:', error);
      setErrorMessage('Failed to process your message. Please try again.');
      setIsProcessing(false);
      setState(ConversationState.LISTENING);
    }
  };

  // Play audio and handle completion
  const playAudio = (audioData: ArrayBuffer, text: string) => {
    if (!audioRef.current) return;
    
    try {
      // Update UI to show we're playing audio
      setIsAISpeaking(true);
      setAnimationActive(true);
      setTextResponse(""); // Clear text response when audio plays
      
      // Convert the buffer to a Blob
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Log the actual audio size
      console.log(`🔊 Created audio blob size: ${audioBlob.size} bytes`);
      
      // Set the audio source
      audioRef.current.src = audioUrl;
      
      // Set up onended before playing
      audioRef.current.onended = () => {
        console.log('🔊 Audio playback completed');
        // Clean up the URL object to prevent memory leaks
        URL.revokeObjectURL(audioUrl);
        
        setIsAISpeaking(false);
        setAnimationActive(false);
        
        // Move back to listening state after AI finished speaking
        setState(ConversationState.LISTENING);
      };
      
      // Handle audio loading error
      audioRef.current.onerror = (e) => {
        console.error('🔴 Audio loading error:', e);
        URL.revokeObjectURL(audioUrl);
        setIsAISpeaking(false);
        setAnimationActive(false);
        setState(ConversationState.LISTENING);
      };
      
      // Play with error handling
      audioRef.current.play().catch(error => {
        console.error('🔴 Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        setIsAISpeaking(false);
        setAnimationActive(false);
        setState(ConversationState.LISTENING);
      });
    } catch (error) {
      console.error('🔴 Error creating audio blob:', error);
      setIsAISpeaking(false);
      setAnimationActive(false);
      setState(ConversationState.LISTENING);
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
      isListening,
      isProcessing,
      isAISpeaking
    });
    
    // Ensure session is active
    if (!sessionActive) {
      console.log('❌ Cannot toggle microphone, session not active');
      return;
    }
    
    if (isListening) {
      // ---- STOPPING MICROPHONE ----
      console.log('🛑 Stopping microphone recording');
      
      // Update UI first for immediate feedback
      setIsListening(false);
      
      // This is critical - update to processing state immediately
      setIsProcessing(true);
      setProcessingStep("Understanding your message...");
      setState(ConversationState.PROCESSING);
      
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
  }, [isListening, isProcessing, isAISpeaking, sessionActive]);

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
    setState(ConversationState.ENDED);
    
    // Navigate to history page after a delay
    setTimeout(() => {
      router.push('/dashboard/analysis');
    }, 2000);
  };

  // Get appropriate status message
  const getStatusMessage = () => {
    return stateMessages[state] || "Ready";
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {serverAvailable === false && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-lg mb-6">
            <h3 className="text-amber-800 font-medium mb-1">Server Unavailable</h3>
            <p className="text-amber-700 text-sm">
              The app is currently operating in offline mode. Your conversations will be stored locally, 
              but sync with the server is unavailable. Start the server with <code className="bg-amber-100 px-1 rounded">npm run dev</code> 
              in the server directory to enable full functionality.
            </p>
          </div>
        )}
      
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Voice Therapy Session</h1>
          <p className="text-gray-600">{getStatusMessage()}</p>
          {errorMessage && (
            <p className="text-red-500 mt-2">{errorMessage}</p>
          )}
        </div>
        
        <div className="flex flex-col items-center justify-center py-8">
          {/* AI Orb */}
          <div 
            className={`relative w-40 h-40 rounded-full flex items-center justify-center mb-10 
                     bg-gradient-to-br from-blue-400 to-purple-600 shadow-lg
                     transition-all duration-300
                     ${animationActive ? 'animate-pulse scale-105' : ''}`}
          >
            <div className={`absolute w-36 h-36 rounded-full 
                          bg-gradient-to-br from-blue-300 to-purple-500 
                          opacity-75 transition-opacity duration-300
                          ${animationActive ? 'animate-ping' : 'opacity-50'}`}></div>
            <div className="z-10 w-32 h-32 rounded-full bg-white flex items-center justify-center">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-700 
                           transition-all duration-300
                           ${animationActive ? 'animate-pulse' : ''}`}></div>
            </div>
              </div>
          
          {/* Begin Session button */}
          {!sessionActive && (
            <button
              onClick={beginSession}
              className="w-48 h-14 rounded-full bg-green-600 text-white hover:bg-green-700 flex items-center justify-center mb-10 transition-colors duration-200"
            >
              <Play size={20} className="mr-2" />
              Begin Session
            </button>
          )}
          
          {/* Control buttons */}
          {sessionActive && (
            <div className="flex space-x-10 items-center">
              {/* Microphone button */}
              <button
                onClick={toggleMicrophone}
                disabled={isAISpeaking || isProcessing}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isListening 
                    ? 'bg-red-500 text-white' 
                    : isAISpeaking || isProcessing 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                aria-label={isListening ? "Stop speaking" : "Start speaking"}
              >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              
              {/* End session button - always enabled */}
              <button
                onClick={endSession}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 bg-red-600 text-white hover:bg-red-700"
                aria-label="End session"
              >
                <X size={24} />
              </button>
            </div>
          )}
          
          {/* AI Speaking indicator */}
          {isAISpeaking && (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-sm text-gray-500 mb-2">
                Aura is speaking...
              </div>
              <div className="flex items-center space-x-1">
                <div className="bg-blue-500 w-2 h-6 rounded-full animate-pulse"></div>
                <div className="bg-blue-500 w-2 h-10 rounded-full animate-pulse delay-75"></div>
                <div className="bg-blue-500 w-2 h-8 rounded-full animate-pulse delay-150"></div>
                <div className="bg-blue-500 w-2 h-4 rounded-full animate-pulse delay-300"></div>
                <div className="bg-blue-500 w-2 h-7 rounded-full animate-pulse delay-200"></div>
              </div>
            </div>
          )}
          
          {/* Processing indicator */}
          {isProcessing && (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-sm text-gray-500 mb-2">
                {processingStep || "Processing your message..."}
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce delay-300"></div>
              </div>
              {textResponse && (
                <div className="mt-4 text-sm text-gray-600 max-w-md text-center">
                  <p>{textResponse}</p>
                  <p className="text-xs text-gray-400 mt-2">Creating voice response...</p>
                </div>
              )}
            </div>
          )}
          
          {/* Recording status */}
          {isListening && (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-sm text-gray-500 mb-2">
                Listening...
          </div>
              <div className="flex items-center space-x-1">
                <div className="bg-red-500 w-2 h-6 rounded-full animate-pulse"></div>
                <div className="bg-red-500 w-2 h-10 rounded-full animate-pulse delay-75"></div>
                <div className="bg-red-500 w-2 h-8 rounded-full animate-pulse delay-150"></div>
                <div className="bg-red-500 w-2 h-4 rounded-full animate-pulse delay-300"></div>
                <div className="bg-red-500 w-2 h-7 rounded-full animate-pulse delay-200"></div>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Tap mic to stop recording
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 