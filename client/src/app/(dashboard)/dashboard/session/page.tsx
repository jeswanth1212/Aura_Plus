'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Send, X, PauseCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth, useAuthProtection } from '@/hooks/useAuth';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export default function SessionPage() {
  // Use auth protection to redirect if not authenticated
  const { isAuthenticated, isLoading: authLoading } = useAuthProtection();
  const { getToken } = useAuth();
  
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Start session with AI talking first when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      initiateSession();
    }
  }, [isAuthenticated, authLoading]);

  // Periodically sync session to MongoDB
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    
    const syncSession = async () => {
      try {
        const token = getToken();
        if (!token) return;
        
        console.log('Auto-syncing session to MongoDB');
        const sessionData = {
          id: sessionId,
          startedAt: new Date(),
          conversation: messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
            timestamp: msg.timestamp
          }))
        };
        
        await axios.post('/api/proxy', {
          endpoint: 'sessions/sync',
          sessionData
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Session auto-synced successfully');
      } catch (error) {
        console.error('Failed to auto-sync session:', error);
      }
    };
    
    // Sync every 30 seconds
    const intervalId = setInterval(syncSession, 30000);
    
    // Also sync when messages change
    syncSession();
    
    return () => clearInterval(intervalId);
  }, [sessionId, messages, getToken]);

  const initiateSession = async () => {
    setIsThinking(true);
    setError(null);
    
    try {
      const token = getToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Call our proxy API to start a new session
      const response = await axios.post('/api/proxy', {
        endpoint: 'sessions/start'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const { sessionId, message, audioUrl } = response.data;
      
      // Save session ID for future interactions
      setSessionId(sessionId);
      
      // Set the current AI message
      setCurrentAiMessage(message);
      
      // Add the AI message to history
      const aiMessage: Message = {
        id: Date.now().toString(),
        sender: 'ai',
        text: message,
        timestamp: new Date(),
      };
      
      setMessages([aiMessage]);
      
      // Play the audio if available
      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        try {
          setIsSpeaking(true);
          await audioRef.current.play();
        } catch (playError) {
          console.error("Error playing audio:", playError);
          setIsSpeaking(false);
        }
      }
    } catch (error: any) {
      console.error('Failed to start session:', error);
      
      // Provide more detailed error information
      const errorMessage = error.response?.data?.error || error.message || "Network error";
      const errorDetails = error.response?.data?.details || "";
      console.error("Error details:", errorMessage, errorDetails);
      
      setError(`${errorMessage}${errorDetails ? ': ' + errorDetails : ''}`);
      
      // Fallback message if API fails
      const fallbackMessage = "Hello! I'm your AI therapist from Aura Plus. How are you feeling today?";
      setCurrentAiMessage(fallbackMessage);
      
      setMessages([{
        id: '1',
        sender: 'ai',
        text: fallbackMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !sessionId) return;

    setIsThinking(true);
    setError(null);
    
    // Store the user message
    const userText = inputMessage;
    
    // Add user message to history
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    try {
      const token = getToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Call our proxy API to send a message
      const response = await axios.post('/api/proxy', {
        endpoint: 'sessions/message',
        sessionId,
        message: userText
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const { message, audioUrl } = response.data;
      
      // Set the current AI message
      setCurrentAiMessage(message);
      
      // Add the AI message to history
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: message,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, aiMessage]);
      
      // Play the audio if available
      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        try {
          setIsSpeaking(true);
          await audioRef.current.play();
        } catch (playError) {
          console.error("Error playing audio:", playError);
          setIsSpeaking(false);
        }
      }
    } catch (error: any) {
      console.error('Failed to get AI response:', error);
      
      // Provide more detailed error information
      const errorMessage = error.response?.data?.error || error.message || "Network error";
      const errorDetails = error.response?.data?.details || "";
      console.error("Error details:", errorMessage, errorDetails);
      
      setError(`${errorMessage}${errorDetails ? ': ' + errorDetails : ''}`);
      
      // Fallback message if API fails
      const fallbackMessage = "I'm sorry, I'm having trouble processing that right now. Could you try again?";
      setCurrentAiMessage(fallbackMessage);
      
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: fallbackMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // In a full implementation, this would use the Web Speech API for voice recognition
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      router.push('/dashboard/history');
      return;
    }
    
    try {
      const token = getToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // First sync the session to MongoDB
      console.log('Syncing session to MongoDB before ending');
      const sessionData = {
        id: sessionId,
        startedAt: new Date(),
        endedAt: new Date(),
        conversation: messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
          timestamp: msg.timestamp
        }))
      };
      
      try {
        await axios.post('/api/proxy', {
          endpoint: 'sessions/sync',
          sessionData
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Session synced successfully');
      } catch (syncError) {
        console.error('Failed to sync session:', syncError);
      }
      
      // Call our proxy API to end the session
      await axios.post('/api/proxy', {
        endpoint: 'sessions/end',
        sessionId
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Redirect to history page
      router.push('/dashboard/history');
    } catch (error: any) {
      console.error('Failed to end session:', error);
      // Still redirect to history page even if there's an error
      router.push('/dashboard/history');
    }
  };

  // If still loading auth, show a loading indicator
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm h-[80vh]">
      <div className="w-full flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold">Therapy Session</h2>
          <p className="text-sm text-gray-500">Started {new Date().toLocaleTimeString()}</p>
        </div>
        <button
          onClick={handleEndSession}
          className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium flex items-center"
        >
          <X className="h-4 w-4 mr-1" />
          End Session
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 w-full text-center text-sm border-b border-red-100">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto p-6">
        {/* Main orb visualization */}
        <div className="relative mb-8">
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center shadow-lg ${isThinking ? 'animate-pulse' : ''}`}>
            {isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 animate-ping opacity-50" style={{ animationDuration: '2s' }}></div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 animate-ping opacity-30" style={{ animationDuration: '3s' }}></div>
              </>
            )}
          </div>
        </div>
        
        {/* Current AI message */}
        <div className="text-center mb-8 max-w-xs">
          {isThinking ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="h-2 w-2 bg-gray-400 rounded-full animate-pulse"></div>
              <div className="h-2 w-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
              <div className="h-2 w-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
            </div>
          ) : (
            <p className="text-gray-700">{currentAiMessage}</p>
          )}
        </div>
        
        {/* Audio element (hidden) */}
        <audio
          ref={audioRef}
          onEnded={() => setIsSpeaking(false)}
          onError={() => setIsSpeaking(false)}
          className="hidden"
        />
        
        {/* Input form */}
        <form onSubmit={handleSendMessage} className="w-full flex items-center">
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-2 mr-2 rounded-full ${
              isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isRecording ? <PauseCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
            disabled={isThinking}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded-r-md disabled:bg-blue-300"
            disabled={!inputMessage.trim() || isThinking}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
} 