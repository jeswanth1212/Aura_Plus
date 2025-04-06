import { create } from 'zustand';
import axios from 'axios';

// Define types
interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface Session {
  _id: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  messages: Message[];
  summary?: string;
}

interface SessionState {
  currentSession: Session | null;
  sessionHistory: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessionHistory: () => Promise<void>;
  fetchSession: (sessionId: string) => Promise<Session | null>;
  clearError: () => void;
}

// Create the session store
export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessionHistory: [],
  isLoading: false,
  error: null,

  fetchSessionHistory: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Call the proxy API to get all sessions
      const response = await axios.get('/api/proxy', {
        params: { endpoint: 'sessions' },
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        }
      });

      // Format dates for proper display
      const sessions = response.data.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined,
        messages: session.messages?.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) || []
      }));

      set({ sessionHistory: sessions, isLoading: false });
    } catch (error: any) {
      console.error('Error fetching session history:', error);
      set({
        error: error.response?.data?.error || 'Error fetching session history',
        isLoading: false,
      });
    }
  },

  fetchSession: async (sessionId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // Call the proxy API to get a specific session
      const response = await axios.get('/api/proxy', {
        params: { 
          endpoint: `sessions/${sessionId}` 
        },
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        }
      });

      // Format dates for proper display
      const session = {
        ...response.data,
        startTime: new Date(response.data.startTime),
        endTime: response.data.endTime ? new Date(response.data.endTime) : undefined,
        messages: response.data.messages?.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) || []
      };

      set({ 
        currentSession: session, 
        isLoading: false 
      });
      
      return session;
    } catch (error: any) {
      console.error('Error fetching session:', error);
      set({
        error: error.response?.data?.error || 'Error fetching session',
        isLoading: false,
      });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));

// Create a hook for easier usage
export function useSession() {
  const { 
    sessionHistory, 
    currentSession,
    isLoading,
    error,
    fetchSessionHistory,
    fetchSession,
    clearError
  } = useSessionStore();

  return {
    sessionHistory,
    currentSession,
    isLoading,
    error,
    fetchSessionHistory,
    fetchSession,
    clearError
  };
} 