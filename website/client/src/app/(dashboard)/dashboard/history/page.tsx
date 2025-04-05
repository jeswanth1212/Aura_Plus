'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calendar, MessageSquare, PlayCircle, BarChart2 } from 'lucide-react';

// Session data structure (must match the one from dashboard page)
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SessionData {
  id: string;
  userId: string | null;
  startedAt: Date;
  endedAt?: Date;
  conversation: Message[];
  voiceId?: string;
  metadata?: {
    mongoDbId?: string;
    [key: string]: any;
  };
}

// Storage utility for managing user conversations (simplified version)
const storageUtils = {
  // Get current user ID
  getUserId(): string | null {
    let userId = localStorage.getItem('aura_user_id');
    return userId;
  },
  
  // Get session by ID
  getSession(sessionId: string): SessionData | null {
    try {
      const sessionsJson = localStorage.getItem('aura_sessions') || '{}';
      const sessions = JSON.parse(sessionsJson);
      
      // Parse dates which are stored as strings
      const session = sessions[sessionId];
      if (session) {
        session.startedAt = new Date(session.startedAt);
        if (session.endedAt) session.endedAt = new Date(session.endedAt);
        
        // Parse message timestamps
        session.conversation = session.conversation.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      
      return session || null;
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
      
      // Map session IDs to actual session data and parse dates
      return sessionIds.map((id: string) => {
        const session = allSessions[id];
        if (!session) return null;
        
        // Parse dates
        session.startedAt = new Date(session.startedAt);
        if (session.endedAt) session.endedAt = new Date(session.endedAt);
        
        // Parse message timestamps
        session.conversation = session.conversation.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        return session;
      }).filter(Boolean);
    } catch (error) {
      console.error('Error retrieving user sessions:', error);
      return [];
    }
  }
};

// Format date for display
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }).format(date);
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load sessions on mount
  useEffect(() => {
    const loadSessions = () => {
      try {
        const userId = storageUtils.getUserId();
        if (!userId) {
          setError('No user found. Please start a new session first.');
          setLoading(false);
          return;
        }
        
        const userSessions = storageUtils.getUserSessions(userId);
        
        // Sort by startedAt, newest first
        userSessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        
        setSessions(userSessions);
        
        // Select the first session if available
        if (userSessions.length > 0) {
          setSelectedSession(userSessions[0]);
        }
      } catch (error) {
        console.error('Error loading sessions:', error);
        setError('Failed to load conversation history.');
      } finally {
        setLoading(false);
      }
    };
    
    loadSessions();
  }, []);
  
  // Handle session selection
  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSelectedSession(session);
    }
  };
  
  // Go back to dashboard
  const goBack = () => {
    router.push('/dashboard');
  };
  
  // Start a new session
  const startNewSession = () => {
    router.push('/dashboard');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          onClick={startNewSession}
        >
          Start New Session
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Conversation History</h1>
          <p className="text-gray-600 mt-2">
            Review your past therapy sessions and track your progress
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row h-full">
            {/* Session list */}
            <div className="w-full md:w-80 md:border-r overflow-y-auto max-h-[70vh] md:max-h-[80vh]">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No conversation history yet. Start a new session to begin.
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {sessions.map(session => (
                    <li
                      key={session.id}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selectedSession?.id === session.id ? 'bg-purple-50' : ''
                      }`}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      <div className="px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(session.startedAt)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {session.conversation.length} messages
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-900 truncate">
                          {session.conversation.length > 0
                            ? session.conversation[0].content.substring(0, 50) + '...'
                            : 'Empty conversation'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Conversation view */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedSession ? (
                <>
                  <div className="bg-gray-50 p-4 border-b">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      Session started: {formatDate(selectedSession.startedAt)}
                      {selectedSession.endedAt && (
                        <span className="ml-4">
                          Ended: {formatDate(selectedSession.endedAt)}
                        </span>
                      )}
                      {selectedSession.voiceId && (
                        <span className="ml-4 flex items-center">
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Voice: {selectedSession.voiceId === 'EXAVITQu4vr4xnSDxMaL' ? 'Default (Adam)' : 'Custom Session Voice'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 max-h-[60vh] md:max-h-[70vh]">
                    {selectedSession.conversation.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        This conversation is empty.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedSession.conversation.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl rounded-lg px-4 py-2 ${
                                message.role === 'user'
                                  ? 'bg-purple-100 text-gray-900'
                                  : 'bg-gray-200 text-gray-900'
                              }`}
                            >
                              <div className="text-sm">{message.content}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatDate(message.timestamp)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center flex-1 text-gray-500 p-12">
                  Select a conversation from the list to view details.
                </div>
              )}
            </div>
          </div>
        </div>
        
        {sessions.length === 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={startNewSession}
              className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Start New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 