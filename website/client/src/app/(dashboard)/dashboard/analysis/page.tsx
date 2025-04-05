'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, Clock, MessageCircle, Download, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

// API Constants
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

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
  analysis?: SessionAnalysis;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SessionAnalysis {
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  themes: Array<{
    name: string;
    strength: number;
  }>;
  speakingTime: {
    user: number;
    assistant: number;
  };
  recommendations?: string[];
  lastUpdated?: Date;
}

interface AggregateAnalysis {
  overallSentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  commonThemes: Array<{
    name: string;
    frequency: number; // How many sessions mention this theme
    averageStrength: number;
  }>;
  progressOverTime: {
    sessions: number;
    sentimentTrend: 'improving' | 'steady' | 'declining' | 'mixed';
    averageSessionLength: number; // in minutes
  };
  topRecommendations: string[];
  themeEvolution?: Array<{
    name: string;
    evolution: Array<{
      sessionIndex: number; // 0 = oldest, increasing = newer
      strength: number;
      date: string; // ISO string
    }>;
  }>;
  lastUpdated: Date;
}

export default function AnalysisPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('sentiment');
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [aggregateAnalysis, setAggregateAnalysis] = useState<AggregateAnalysis | null>(null);
  const router = useRouter();

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

  // Create sample sessions if none exist
  const createSampleSessions = useCallback(() => {
    // Generate a mock user ID if none exists
    let userId = localStorage.getItem('aura_user_id');
    if (!userId) {
      userId = `user-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('aura_user_id', userId);
    }

    // Create sample therapy conversations
    const sampleSessions: SessionData[] = [
      {
        id: `session-${Date.now()}-1`,
        userId,
        startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        endedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min session
        voiceId: 'sample-voice-1',
        conversation: [
          {
            role: 'assistant',
            content: 'Hello! I\'m Aura, your AI therapy assistant. How are you feeling today?',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          },
          {
            role: 'user',
            content: 'I\'ve been feeling anxious lately, especially with work deadlines coming up.',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 1000)
          },
          {
            role: 'assistant',
            content: 'I understand. Work pressure can be overwhelming. Can you tell me more about these deadlines and how they\'re affecting you?',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 10 * 1000)
          },
          {
            role: 'user',
            content: 'I have three major projects due next week and I\'m worried I won\'t be able to complete them on time. I\'ve been having trouble sleeping and it\'s hard to focus.',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 20 * 1000)
          },
          {
            role: 'assistant',
            content: 'That sounds challenging. Sleep issues and difficulty focusing are common responses to stress. Have you tried breaking down these projects into smaller, manageable tasks?',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 25 * 1000)
          },
          {
            role: 'user',
            content: 'I haven\'t really. I just see them as these huge mountains I need to climb and it feels overwhelming.',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 35 * 1000)
          },
          {
            role: 'assistant',
            content: 'Breaking large tasks into smaller ones can make them feel more manageable. Perhaps we could discuss some stress management techniques that might help you sleep better too?',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 40 * 1000)
          }
        ]
      },
      {
        id: `session-${Date.now()}-2`,
        userId,
        startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        endedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 min session
        voiceId: 'sample-voice-2',
        conversation: [
          {
            role: 'assistant',
            content: 'Welcome back! How have you been since our last session?',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            role: 'user',
            content: 'I\'ve been a bit better. I tried breaking down one of my projects like you suggested, and it helped me get started.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 10 * 1000)
          },
          {
            role: 'assistant',
            content: 'That\'s great progress! How did it feel to approach your work that way?',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 1000)
          },
          {
            role: 'user',
            content: 'It was less intimidating. I still feel stressed, but at least I\'ve made some progress. My sleep is still not great though.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 25 * 1000)
          },
          {
            role: 'assistant',
            content: 'I\'m glad you found it helpful. Sleep disturbances can take longer to resolve. Would you like to explore some relaxation techniques that might help with your sleep?',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 30 * 1000)
          },
          {
            role: 'user',
            content: 'Yes, that would be really helpful. I\'ve tried some breathing exercises, but they don\'t seem to help much.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 40 * 1000)
          },
          {
            role: 'assistant',
            content: 'Different techniques work for different people. Progressive muscle relaxation might be a good alternative. It involves tensing and then relaxing each muscle group in your body, which can help release physical tension that contributes to anxiety and sleep problems.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 50 * 1000)
          },
          {
            role: 'user',
            content: 'That sounds interesting. I\'ll try that tonight and see if it helps. I also wanted to talk about my communication with my team. I think I need to be more open about my workload.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60 * 1000)
          },
          {
            role: 'assistant',
            content: 'Opening up about your workload is a great step. Clear communication can help set realistic expectations and might even lead to better distribution of tasks. What\'s been holding you back from discussing this with your team?',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 70 * 1000)
          }
        ]
      }
    ];

    // Save to localStorage in the correct format (as an object with IDs as keys)
    const sessionsObject: {[key: string]: SessionData} = {};
    sampleSessions.forEach(session => {
      sessionsObject[session.id] = session;
    });
    
    localStorage.setItem('aura_sessions', JSON.stringify(sessionsObject));
    
    // Also create the user sessions list
    localStorage.setItem(`aura_user_sessions_${userId}`, JSON.stringify(sampleSessions.map(s => s.id)));
    
    return sampleSessions;
  }, []);

  // Function to analyze a session with AI
  const analyzeSessionWithAI = useCallback(async (session: SessionData): Promise<SessionAnalysis> => {
    // Use environment variable directly
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found, using mock analysis');
      return generateMockAnalysis(session);
    }

    try {
      // Prepare conversation data for analysis
      const conversationText = session.conversation.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n\n');
      
      // Calculate speaking time based on message length as an estimate
      const userMessages = session.conversation.filter(msg => msg.role === 'user');
      const assistantMessages = session.conversation.filter(msg => msg.role === 'assistant');
      
      const userTextLength = userMessages.reduce((total, msg) => total + msg.content.length, 0);
      const assistantTextLength = assistantMessages.reduce((total, msg) => total + msg.content.length, 0);
      
      // Estimate speaking time (1 character ≈ 0.05 seconds of speech)
      const userSpeakingTime = Math.round(userTextLength * 0.05);
      const assistantSpeakingTime = Math.round(assistantTextLength * 0.05);
      
      // Prompt for Gemini API
      const prompt = `
      You are an expert therapy session analyzer. Analyze the following conversation between a user and an AI therapy assistant named Aura.
      
      CONVERSATION:
      ${conversationText}
      
      Provide a detailed analysis in the following JSON format only, with no additional text:
      {
        "sentiment": {
          "positive": [0-1 decimal representing percentage],
          "neutral": [0-1 decimal representing percentage],
          "negative": [0-1 decimal representing percentage]
        },
        "themes": [
          {"name": "theme name", "strength": [0-1 decimal representing strength]}
        ],
        "recommendations": [
          "recommendation 1",
          "recommendation 2",
          "recommendation 3"
        ]
      }
      
      Note that the sentiment values should sum to 1 exactly. Include 3-5 main themes with their strength (0-1 scale), and provide 2-3 personalized therapy recommendations based on the conversation content.
      `;
      
      // Use a model name that's available in your API version
      const modelName = "gemini-2.0-flash"; // Updated model name to match what's used elsewhere
      
      // Call Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error (${response.status}):`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('Invalid response structure from Gemini API:', data);
        throw new Error('Failed to get valid response from AI model');
      }
      
      // Extract the response text
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Extract the JSON from the response text
      const jsonMatch = responseText.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        console.error('Failed to extract JSON from response:', responseText);
        return generateMockAnalysis(session);
      }
      
      try {
        const analysisData = JSON.parse(jsonMatch[0]);
        
        // Also sync the session with the backend
        syncSessionWithBackend(session);
        
        return {
          sentiment: {
            positive: parseFloat(analysisData.sentiment.positive.toFixed(2)),
            neutral: parseFloat(analysisData.sentiment.neutral.toFixed(2)),
            negative: parseFloat(analysisData.sentiment.negative.toFixed(2))
          },
          themes: analysisData.themes.map((theme: any) => ({
            name: theme.name,
            strength: parseFloat(theme.strength.toFixed(2))
          })),
          speakingTime: {
            user: userSpeakingTime,
            assistant: assistantSpeakingTime
          },
          recommendations: analysisData.recommendations,
          lastUpdated: new Date()
        };
      } catch (jsonError) {
        console.error('Error parsing JSON from response:', jsonError, responseText);
        return generateMockAnalysis(session);
      }
    } catch (err) {
      console.error('Error analyzing session with AI:', err);
      // Fall back to mock analysis
      return generateMockAnalysis(session);
    }
  }, []);

  // Function to sync a session with the backend
  const syncSessionWithBackend = async (session: SessionData) => {
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
        
        // Make the API call with proper auth headers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout
        
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
          return createLocalFallbackResponse(session.id);
        }
        
        const response = await fetch(`${apiUrl}/api/sessions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionData: session
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Session sync failed (${response.status}):`, errorData);
          return createLocalFallbackResponse(session.id);
        }
        
        const data = await response.json();
        console.log('Session synced successfully:', data);
        
        // Mark the session as synced in localStorage
        updateLocalSessionWithSyncInfo(session.id, data.sessionId);
        
        return data.sessionId;
      } catch (fetchError: any) {
        console.warn("Server connection failed. Using client-only storage:", fetchError.message);
        // Create a fallback response for development mode
        return createLocalFallbackResponse(session.id);
      }
    } catch (error) {
      console.error('Error in syncSessionWithBackend:', error);
      return null;
    }
  };
  
  // Helper function to create a fallback response when server is unavailable
  const createLocalFallbackResponse = (sessionId: string) => {
    // Generate a fake MongoDB-like ID for development use
    const mockId = `local_${Date.now()}_${sessionId}`;
    
    // Mark session as handled locally
    updateLocalSessionWithSyncInfo(sessionId, mockId);
    
    console.log(`Created local fallback session ID: ${mockId}`);
    return mockId;
  };
  
  // Helper to update localStorage with sync info
  const updateLocalSessionWithSyncInfo = (sessionId: string, serverId: string) => {
    const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
    if (allSessions[sessionId]) {
      allSessions[sessionId].synced = true;
      allSessions[sessionId].serverSessionId = serverId;
      allSessions[sessionId].syncedAt = new Date().toISOString();
      localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
    }
  };

  // Function to generate aggregate analysis from all sessions
  const generateAggregateAnalysis = useCallback((allSessions: SessionData[]): AggregateAnalysis => {
    console.log('Generating aggregate analysis from', allSessions.length, 'sessions');
    
    // Only use sessions that have analysis data
    const sessionsWithAnalysis = allSessions.filter(s => s.analysis);
    
    // If no sessions have analysis, return null
    if (sessionsWithAnalysis.length === 0) {
      return {
        overallSentiment: { positive: 0, neutral: 0, negative: 0 },
        commonThemes: [],
        progressOverTime: { 
          sessions: 0, 
          sentimentTrend: 'steady',
          averageSessionLength: 0 
        },
        topRecommendations: [],
        lastUpdated: new Date()
      };
    }
    
    // Sort sessions by date (oldest first) for trend analysis
    const sortedSessions = [...sessionsWithAnalysis].sort((a, b) => 
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    
    // Calculate overall sentiment (average of all sessions)
    const overallSentiment = {
      positive: parseFloat((sortedSessions.reduce((sum, s) => sum + (s.analysis?.sentiment.positive || 0), 0) / sortedSessions.length).toFixed(2)),
      neutral: parseFloat((sortedSessions.reduce((sum, s) => sum + (s.analysis?.sentiment.neutral || 0), 0) / sortedSessions.length).toFixed(2)),
      negative: parseFloat((sortedSessions.reduce((sum, s) => sum + (s.analysis?.sentiment.negative || 0), 0) / sortedSessions.length).toFixed(2))
    };
    
    // Collect all themes from all sessions
    const themesMap = new Map<string, { count: number, totalStrength: number }>();
    
    sortedSessions.forEach(session => {
      session.analysis?.themes.forEach(theme => {
        const existing = themesMap.get(theme.name.toLowerCase());
        if (existing) {
          existing.count += 1;
          existing.totalStrength += theme.strength;
        } else {
          themesMap.set(theme.name.toLowerCase(), { 
            count: 1, 
            totalStrength: theme.strength 
          });
        }
      });
    });
    
    // Convert map to array and sort by frequency
    const commonThemes = Array.from(themesMap.entries())
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize
        frequency: data.count,
        averageStrength: parseFloat((data.totalStrength / data.count).toFixed(2))
      }))
      .sort((a, b) => b.frequency - a.frequency || b.averageStrength - a.averageStrength)
      .slice(0, 5); // Top 5 themes
    
    // Calculate sentiment trend
    let sentimentTrend: 'improving' | 'steady' | 'declining' | 'mixed' = 'steady';
    
    if (sortedSessions.length > 1) {
      // Compare first and last session positive sentiment
      const firstPositive = sortedSessions[0].analysis?.sentiment.positive || 0;
      const lastPositive = sortedSessions[sortedSessions.length - 1].analysis?.sentiment.positive || 0;
      const difference = lastPositive - firstPositive;
      
      if (difference > 0.15) {
        sentimentTrend = 'improving';
      } else if (difference < -0.15) {
        sentimentTrend = 'declining';
      } else {
        // Check for fluctuations in between
        const allPositives = sortedSessions.map(s => s.analysis?.sentiment.positive || 0);
        const maxDifference = Math.max(...allPositives) - Math.min(...allPositives);
        
        if (maxDifference > 0.25) {
          sentimentTrend = 'mixed';
        } else {
          sentimentTrend = 'steady';
        }
      }
    }
    
    // Calculate average session length
    const averageSessionLength = parseFloat((sortedSessions.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      const length = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / (1000 * 60); // in minutes
      return sum + length;
    }, 0) / sortedSessions.length).toFixed(1));
    
    // Collect all recommendations
    const recommendationsCount = new Map<string, number>();
    
    sortedSessions.forEach(session => {
      session.analysis?.recommendations?.forEach(rec => {
        const normalizedRec = rec.toLowerCase().trim();
        recommendationsCount.set(
          normalizedRec, 
          (recommendationsCount.get(normalizedRec) || 0) + 1
        );
      });
    });
    
    // Get top recommendations
    const topRecommendations = Array.from(recommendationsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([rec]) => rec.charAt(0).toUpperCase() + rec.slice(1)); // Capitalize
      
    // Track theme evolution over time (only for themes that appear in multiple sessions)
    const themeEvolution: AggregateAnalysis['themeEvolution'] = [];
    
    // Only analyze evolution if we have more than 1 session
    if (sortedSessions.length > 1) {
      // Find themes that appear in at least 2 sessions
      const recurrentThemes = Array.from(themesMap.entries())
        .filter(([_, data]) => data.count >= 2)
        .map(([name]) => name.toLowerCase());
      
      // For each recurrent theme, track its presence and strength across sessions
      recurrentThemes.forEach(themeName => {
        const evolution = sortedSessions.map((session, idx) => {
          // Find theme in this session
          const themeInSession = session.analysis?.themes.find(
            t => t.name.toLowerCase() === themeName
          );
          
          return {
            sessionIndex: idx,
            strength: themeInSession?.strength || 0,
            date: session.startedAt.toISOString().split('T')[0] // Just the date part
          };
        });
        
        // Only include themes that appear with non-zero strength in at least one session
        if (evolution.some(e => e.strength > 0)) {
          themeEvolution.push({
            name: themeName.charAt(0).toUpperCase() + themeName.slice(1), // Capitalize
            evolution
          });
        }
      });
      
      // Sort by number of occurrences (descending)
      themeEvolution.sort((a, b) => {
        const aCount = a.evolution.filter(e => e.strength > 0).length;
        const bCount = b.evolution.filter(e => e.strength > 0).length;
        return bCount - aCount;
      });
      
      // Limit to top 4 for visualization
      themeEvolution.splice(4);
    }
    
    return {
      overallSentiment,
      commonThemes,
      progressOverTime: {
        sessions: sortedSessions.length,
        sentimentTrend,
        averageSessionLength
      },
      topRecommendations,
      themeEvolution,
      lastUpdated: new Date()
    };
  }, []);

  // Add event listener for session updates from the dashboard
  useEffect(() => {
    // Load sessions initially
    loadSessions();
    
    // Listen for custom events from dashboard
    const handleSessionUpdate = (e: CustomEvent) => {
      console.log('Session updated event received:', e.detail);
      loadSessions();
    };
    
    // Listen for storage changes (for multi-tab support)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aura_sessions' || e.key?.startsWith('aura_user_sessions_')) {
        console.log('Local storage changed, reloading sessions');
        loadSessions();
      }
    };
    
    // Add event listeners
    window.addEventListener('aura_session_updated', handleSessionUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);
    
    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('aura_session_updated', handleSessionUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Debug function to check session storage format
  const debugSessionStorage = () => {
    try {
      const sessionsJson = localStorage.getItem('aura_sessions');
      console.log('Raw aura_sessions from localStorage:', sessionsJson);
      
      const sessions = sessionsJson ? JSON.parse(sessionsJson) : {};
      console.log('Parsed sessions:', sessions);
      
      // Check if it's in the expected object format
      const isObjectFormat = typeof sessions === 'object' && !Array.isArray(sessions);
      console.log('Is sessions in object format?', isObjectFormat);
      
      // Get user ID
      const userId = localStorage.getItem('aura_user_id');
      console.log('Current user ID:', userId);
      
      if (userId) {
        const userSessionsJson = localStorage.getItem(`aura_user_sessions_${userId}`);
        console.log(`Raw aura_user_sessions_${userId} from localStorage:`, userSessionsJson);
        
        const userSessions = userSessionsJson ? JSON.parse(userSessionsJson) : [];
        console.log('User session IDs:', userSessions);
        
        // Check which of these sessions exist in the main sessions object
        if (isObjectFormat && Array.isArray(userSessions)) {
          userSessions.forEach(id => {
            console.log(`Session ${id} exists in main sessions object:`, !!sessions[id]);
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error debugging session storage:', error);
      return false;
    }
  };

  // Function to load sessions from localStorage
  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Debug session storage to identify issues
      debugSessionStorage();
      
      // Get user ID from localStorage
      const userId = localStorage.getItem('aura_user_id');
      
      if (!userId) {
        console.warn("No user ID found in localStorage");
        setError("No user ID found. Please complete a therapy session first.");
        setIsLoading(false);
        return;
      }
      
      // Get session data from localStorage
      const sessionsJson = localStorage.getItem('aura_sessions');
      let allSessions: Record<string, any> = {};
      
      if (sessionsJson) {
        try {
          allSessions = JSON.parse(sessionsJson);
          // Verify sessions is not an array (old format)
          if (Array.isArray(allSessions)) {
            console.warn('Sessions in old array format, converting to object format');
            const sessionsObj: Record<string, any> = {};
            allSessions.forEach(session => {
              if (session.id) {
                sessionsObj[session.id] = session;
              }
            });
            allSessions = sessionsObj;
          }
        } catch (parseError) {
          console.error('Failed to parse sessions JSON:', parseError);
          // Create empty object if parse fails
          allSessions = {};
        }
      }
      
      // Get the list of session IDs for this user
      const userSessionsJson = localStorage.getItem(`aura_user_sessions_${userId}`);
      let userSessionIds: string[] = [];
      
      if (userSessionsJson) {
        try {
          userSessionIds = JSON.parse(userSessionsJson);
          if (!Array.isArray(userSessionIds)) {
            console.warn('User session IDs not in array format, resetting');
            userSessionIds = [];
          }
        } catch (parseError) {
          console.error('Failed to parse user sessions JSON:', parseError);
          userSessionIds = [];
        }
      }
      
      // If there are no sessions, create sample data
      if (Object.keys(allSessions).length === 0 || userSessionIds.length === 0) {
        console.log("No sessions found, creating sample data");
        createSampleSessions();
        
        // Re-fetch sessions after creating samples
        const newSessionsJson = localStorage.getItem('aura_sessions');
        const newUserSessionsJson = localStorage.getItem(`aura_user_sessions_${userId}`);
        
        if (newSessionsJson && newUserSessionsJson) {
          allSessions = JSON.parse(newSessionsJson);
          userSessionIds = JSON.parse(newUserSessionsJson);
        }
      }
      
      // Get sessions either from user session IDs or by filtering all sessions
      let loadedSessions: SessionData[] = [];
      
      if (userSessionIds.length > 0) {
        // Get sessions by ID from the master sessions object
        loadedSessions = userSessionIds
          .map(id => allSessions[id])
          .filter(Boolean) // Remove any null/undefined entries
          .map(processSessionDates); // Process dates
        console.log(`Loaded ${loadedSessions.length} sessions from user session IDs`);
      } else {
        // Fallback to filtering by user ID
        loadedSessions = Object.values(allSessions)
          .filter((session: any) => session.userId === userId)
          .map(processSessionDates);
        console.log(`Loaded ${loadedSessions.length} sessions by filtering for user ID`);
      }
      
      // Sort by most recent first
      loadedSessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      
      console.log(`Successfully loaded ${loadedSessions.length} sessions for analysis`);
      
      // Generate mock analysis for sessions that don't have it
      const sessionsWithAnalysis = await Promise.all(
        loadedSessions.map(async (session) => {
          if (!session.analysis) {
            console.log(`Generating mock analysis for session ${session.id}`);
            session.analysis = generateMockAnalysis(session);
            
            // Save the analysis back to localStorage
            if (allSessions[session.id]) {
              allSessions[session.id].analysis = session.analysis;
              localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
            }
          }
          return session;
        })
      );
      
      // Set the loaded sessions
      setSessions(sessionsWithAnalysis);
      
      // If there are sessions, set the first one as selected
      if (sessionsWithAnalysis.length > 0) {
        const firstSession = sessionsWithAnalysis[0];
        setSelectedSession(firstSession);
        
        // Generate aggregate analysis from sessions with analysis
        const newAggregateAnalysis = generateAggregateAnalysis(sessionsWithAnalysis);
        setAggregateAnalysis(newAggregateAnalysis);
      }
      
      // Schedule a proper AI-based analysis refresh
      if (loadedSessions.length > 0) {
        setTimeout(() => {
          refreshAnalysis();
        }, 300);
      }
      
      setIsLoading(false);
    } catch (loadError: any) {
      console.error("Error loading sessions:", loadError);
      setError(`Error loading sessions: ${loadError.message || "Unknown error"}`);
      setIsLoading(false);
    }
  };
  
  // Helper function to process dates in session data
  const processSessionDates = (session: any): SessionData => {
    try {
      return {
        ...session,
        startedAt: new Date(session.startedAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
        conversation: Array.isArray(session.conversation) ? session.conversation.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) : []
      };
    } catch (error) {
      console.error("Error processing session dates:", error, session);
      // Return a minimally valid session
      return {
        id: session.id || 'invalid-id',
        userId: session.userId || null,
        startedAt: new Date(),
        conversation: []
      };
    }
  };

  // Manually refresh analysis for the current session
  const refreshAnalysis = async () => {
    if (!selectedSession) return;
    
    setAnalysisInProgress(true);
    try {
      console.log("Refreshing analysis for session:", selectedSession.id);
      
      // Generate analysis
      const updatedAnalysis = await analyzeSessionWithAI(selectedSession);
      console.log("Generated analysis:", updatedAnalysis);
      
      // Update in state
      setSelectedSession(prev => prev ? { ...prev, analysis: updatedAnalysis } : null);
      
      // Update in sessions list
      setSessions(prev => prev.map(session => 
        session.id === selectedSession.id 
          ? { ...session, analysis: updatedAnalysis } 
          : session
      ));
      
      // Generate aggregate analysis
      const updatedSessions = sessions.map(session => 
        session.id === selectedSession.id 
          ? { ...session, analysis: updatedAnalysis } 
          : session
      );
      const newAggregateAnalysis = generateAggregateAnalysis(updatedSessions);
      setAggregateAnalysis(newAggregateAnalysis);
      
      // Save to localStorage with correct structure
      const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
      if (allSessions[selectedSession.id]) {
        allSessions[selectedSession.id].analysis = updatedAnalysis;
        localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
        
        // Dispatch an event to notify other components
        window.dispatchEvent(new Event('aura_session_updated'));
      }
    } catch (err) {
      console.error("Error refreshing analysis:", err);
      
      // If analysis fails, generate mock analysis
      if (selectedSession && !selectedSession.analysis) {
        const mockAnalysis = generateMockAnalysis(selectedSession);
        setSelectedSession(prev => prev ? { ...prev, analysis: mockAnalysis } : null);
      }
    } finally {
      setAnalysisInProgress(false);
    }
  };

  // Generate mock analysis data for demonstration or fallback
  const generateMockAnalysis = (session: SessionData): SessionAnalysis => {
    const userMessages = session.conversation.filter(msg => msg.role === 'user');
    const assistantMessages = session.conversation.filter(msg => msg.role === 'assistant');
    
    // Generate random sentiment values that sum to 1
    const positive = Math.random() * 0.6 + 0.2; // 0.2 to 0.8
    const remaining = 1 - positive;
    const negative = Math.random() * remaining * 0.7; // 0 to 0.7 * remaining
    const neutral = remaining - negative;
    
    // Generate common therapy themes
    const allThemes = [
      'Anxiety', 'Stress', 'Relationships', 'Work-Life Balance', 
      'Self-Esteem', 'Depression', 'Personal Growth', 'Sleep Issues',
      'Communication', 'Motivation'
    ];
    
    // Select 3-5 random themes
    const numThemes = Math.floor(Math.random() * 3) + 3; // 3 to 5 themes
    const selectedThemes = [...allThemes]
      .sort(() => 0.5 - Math.random())
      .slice(0, numThemes)
      .map(name => ({
        name,
        strength: Math.random() * 0.8 + 0.2 // 0.2 to 1.0
      }))
      .sort((a, b) => b.strength - a.strength);
    
    // Generate random speaking time (in seconds)
    const sessionLength = session.endedAt 
      ? (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
      : 600; // Default to 10 minutes if no end time
    
    const userSpeakingTime = Math.floor(sessionLength * (Math.random() * 0.3 + 0.2)); // 20-50% of total time
    const assistantSpeakingTime = Math.floor(sessionLength * (Math.random() * 0.3 + 0.2)); // 20-50% of total time
    
    // Generate recommendations
    const recommendations = [
      "Practice deep breathing exercises when feeling anxious",
      "Consider keeping a daily journal to track your thoughts",
      "Schedule regular breaks during your workday to reduce stress",
      "Try progressive muscle relaxation techniques before bedtime",
      "Reach out to friends or family members for social support"
    ];
    
    // Select 2-3 random recommendations
    const numRecommendations = Math.floor(Math.random() * 2) + 2; // 2 to 3 recommendations
    const selectedRecommendations = [...recommendations]
      .sort(() => 0.5 - Math.random())
      .slice(0, numRecommendations);
    
    return {
      sentiment: {
        positive: parseFloat(positive.toFixed(2)),
        neutral: parseFloat(neutral.toFixed(2)),
        negative: parseFloat(negative.toFixed(2))
      },
      themes: selectedThemes,
      speakingTime: {
        user: userSpeakingTime,
        assistant: assistantSpeakingTime
      },
      recommendations: selectedRecommendations,
      lastUpdated: new Date()
    };
  };

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Generate a color based on sentiment value
  const getSentimentColor = (value: number, type: 'positive' | 'neutral' | 'negative') => {
    if (type === 'positive') {
      return `rgb(20, ${Math.floor(150 + (value * 100))}, 20)`;
    } else if (type === 'negative') {
      return `rgb(${Math.floor(200 + (value * 55))}, 20, 20)`;
    } else {
      return `rgb(100, 100, 100)`;
    }
  };

  // Export analysis as JSON
  const exportAnalysis = () => {
    if (!selectedSession) return;
    
    const dataStr = JSON.stringify(selectedSession, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `aura-session-${selectedSession.id}-analysis.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Render aggregate analysis section
  const renderAggregateAnalysis = () => {
    if (!aggregateAnalysis || sessions.length === 0) {
      return null;
    }

    const getTrendIcon = () => {
      switch (aggregateAnalysis.progressOverTime.sentimentTrend) {
        case 'improving':
          return '↗️';
        case 'declining':
          return '↘️';
        case 'mixed':
          return '↕️';
        default:
          return '→';
      }
    };

    const getTrendDescription = () => {
      switch (aggregateAnalysis.progressOverTime.sentimentTrend) {
        case 'improving':
          return 'Your emotional state is improving over time.';
        case 'declining':
          return 'Your emotional state has been declining recently.';
        case 'mixed':
          return 'Your emotional state has been fluctuating across sessions.';
        default:
          return 'Your emotional state has remained relatively stable.';
      }
    };
    
    // Function to refresh the comprehensive analysis
    const refreshComprehensiveAnalysis = () => {
      if (analysisInProgress) return;
      
      setAnalysisInProgress(true);
      
      // Regenerate analysis for all sessions
      Promise.all(sessions.map(async (session) => {
        const updatedAnalysis = await analyzeSessionWithAI(session);
        
        // Update in localStorage
        const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
        if (allSessions[session.id]) {
          allSessions[session.id].analysis = updatedAnalysis;
          localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
        }
        
        return {
          ...session,
          analysis: updatedAnalysis
        };
      }))
      .then((updatedSessions) => {
        setSessions(updatedSessions);
        const newAggregate = generateAggregateAnalysis(updatedSessions);
        setAggregateAnalysis(newAggregate);
        
        // If a session is selected, update it too
        if (selectedSession) {
          const updatedSelected = updatedSessions.find(s => s.id === selectedSession.id);
          if (updatedSelected) {
            setSelectedSession(updatedSelected);
          }
        }
        
        // Dispatch event to notify other components
        window.dispatchEvent(new Event('aura_session_updated'));
      })
      .catch((err) => {
        console.error("Error refreshing comprehensive analysis:", err);
      })
      .finally(() => {
        setAnalysisInProgress(false);
      });
    };
    
    // Generate a simple theme evolution chart
    const renderThemeEvolution = () => {
      if (!aggregateAnalysis.themeEvolution || aggregateAnalysis.themeEvolution.length === 0) {
        return (
          <div className="text-center py-6 text-gray-500">
            <p>Not enough sessions to track theme evolution</p>
            <p className="text-xs mt-1">Complete more sessions to see how themes change over time</p>
          </div>
        );
      }
      
      // Determine how many sessions we're tracking
      const sessionCount = Math.max(
        ...aggregateAnalysis.themeEvolution.flatMap(t => 
          t.evolution.map(e => e.sessionIndex)
        )
      ) + 1;
      
      // Generate colors for themes
      const themeColors = [
        'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
        'bg-red-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-pink-500'
      ];
      
      return (
        <div className="mt-6">
          <div className="flex justify-between mb-2">
            <h3 className="font-medium text-gray-900">Theme Evolution</h3>
            <div className="text-xs text-gray-500">Tracking across {sessionCount} sessions</div>
          </div>
          
          <div className="theme-evolution-chart">
            {/* Legend */}
            <div className="flex flex-wrap mb-3 gap-2">
              {aggregateAnalysis.themeEvolution.map((theme, idx) => (
                <div key={idx} className="flex items-center text-xs">
                  <span className={`w-3 h-3 rounded-full mr-1 ${themeColors[idx % themeColors.length]}`}></span>
                  <span>{theme.name}</span>
                </div>
              ))}
            </div>
            
            {/* Chart */}
            <div className="relative h-40 bg-gray-50 rounded-lg p-2 border border-gray-100">
              {/* Session markers on x-axis */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-gray-500">
                {Array.from({length: sessionCount}).map((_, idx) => {
                  const sessionDate = aggregateAnalysis.themeEvolution?.[0]?.evolution[idx]?.date;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div>S{idx+1}</div>
                      {sessionDate && <div className="text-[0.65rem]">{sessionDate}</div>}
                    </div>
                  );
                })}
              </div>
              
              {/* Strength lines */}
              <div className="absolute top-0 left-0 right-0 bottom-6 flex">
                {aggregateAnalysis.themeEvolution.map((theme, themeIdx) => {
                  // Filter out zero-strength points
                  const points = theme.evolution
                    .filter(e => e.strength > 0)
                    .map(e => ({
                      x: (e.sessionIndex / (sessionCount - 1)) * 100,
                      y: 100 - (e.strength * 100),
                      strength: e.strength
                    }));
                  
                  if (points.length < 2) return null;
                  
                  // Create SVG path
                  let path = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 1; i < points.length; i++) {
                    path += ` L ${points[i].x} ${points[i].y}`;
                  }
                  
                  return (
                    <svg key={themeIdx} className="absolute inset-0 w-full h-full overflow-visible">
                      <path
                        d={path}
                        fill="none"
                        stroke={themeColors[themeIdx % themeColors.length].replace('bg-', 'stroke-')}
                        strokeWidth="2"
                        className="opacity-80"
                      />
                      
                      {/* Data points */}
                      {points.map((point, pointIdx) => (
                        <circle
                          key={pointIdx}
                          cx={`${point.x}%`}
                          cy={`${point.y}%`}
                          r="3"
                          className={`${themeColors[themeIdx % themeColors.length].replace('bg-', 'fill-')} stroke-white`}
                          strokeWidth="1"
                          data-strength={point.strength.toFixed(2)}
                        />
                      ))}
                    </svg>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 mb-6 border border-blue-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center text-indigo-900">
            <BarChart2 className="mr-2 w-5 h-5" /> 
            Comprehensive Analysis
          </h2>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Updated: {new Date(aggregateAnalysis.lastUpdated).toLocaleString()}
            </span>
            <button 
              onClick={refreshComprehensiveAnalysis}
              disabled={analysisInProgress}
              className={`flex items-center text-sm px-3 py-1.5 rounded-full
                ${analysisInProgress 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${analysisInProgress ? 'animate-spin' : ''}`} />
              {analysisInProgress ? 'Updating...' : 'Refresh All'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-gray-900 mb-2">Overall Sentiment</h3>
            <div className="flex justify-between mb-2">
              <div className="text-green-600">
                Positive: {Math.round(aggregateAnalysis.overallSentiment.positive * 100)}%
              </div>
              <div className="text-blue-500">
                Neutral: {Math.round(aggregateAnalysis.overallSentiment.neutral * 100)}%
              </div>
              <div className="text-red-500">
                Negative: {Math.round(aggregateAnalysis.overallSentiment.negative * 100)}%
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-500 h-2.5 rounded-l-full" style={{ 
                width: `${aggregateAnalysis.overallSentiment.positive * 100}%`,
                display: 'inline-block'
              }}></div>
              <div className="bg-blue-500 h-2.5" style={{ 
                width: `${aggregateAnalysis.overallSentiment.neutral * 100}%`,
                display: 'inline-block'
              }}></div>
              <div className="bg-red-500 h-2.5 rounded-r-full" style={{ 
                width: `${aggregateAnalysis.overallSentiment.negative * 100}%`,
                display: 'inline-block'
              }}></div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-gray-900 mb-2">Progress Over Time</h3>
            <div className="text-sm mb-1">
              <span className="font-medium">{sessions.length}</span> sessions analyzed
            </div>
            <div className="text-sm mb-1">
              <span className="font-medium">{aggregateAnalysis.progressOverTime.averageSessionLength}</span> min average session length
            </div>
            <div className="flex items-center mt-3 text-sm font-medium">
              <span className="text-lg mr-2 bg-indigo-100 p-1 rounded-full">{getTrendIcon()}</span>
              {getTrendDescription()}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-gray-900 mb-2">Common Themes</h3>
            {aggregateAnalysis.commonThemes.length > 0 ? (
              <ul className="space-y-2.5">
                {aggregateAnalysis.commonThemes.map((theme, index) => (
                  <li key={index} className="flex justify-between items-center">
                    <span>{theme.name}</span>
                    <div className="text-xs text-gray-500 flex items-center">
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full mr-2">
                        {theme.frequency} sessions
                      </span>
                      <span className="w-16 bg-gray-200 rounded-full h-1.5">
                        <span 
                          className="bg-indigo-600 h-1.5 rounded-full" 
                          style={{ width: `${theme.averageStrength * 100}%` }}
                        ></span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No common themes identified yet.</p>
            )}
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-gray-900 mb-2">Top Recommendations</h3>
            {aggregateAnalysis.topRecommendations.length > 0 ? (
              <ul className="space-y-2">
                {aggregateAnalysis.topRecommendations.map((rec, index) => (
                  <li key={index} className="text-sm bg-gray-50 p-2.5 rounded border border-gray-200">
                    {rec}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No recommendations collected yet.</p>
            )}
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          {renderThemeEvolution()}
        </div>
        
        <div className="mt-4 text-sm text-indigo-800 bg-indigo-50 p-3 rounded-lg">
          <p className="font-medium">This analysis is continuously updated as you complete more therapy sessions.</p>
          <p className="mt-1">It combines data from all your sessions to provide insights into your overall progress and recurring themes.</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
        <p className="text-center mb-6">{error}</p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">No Sessions Available</h1>
        <p className="text-center mb-6">You haven't completed any therapy sessions yet. Start a session to get personalized analysis.</p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
        >
          Start a Session
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {serverAvailable === false && (
        <div className="mb-6 bg-amber-50 border border-amber-300 p-4 rounded-lg">
          <h3 className="text-amber-800 font-medium mb-1">Server Unavailable</h3>
          <p className="text-amber-700 text-sm">
            The app is currently operating in offline mode. Session analysis is working 
            with local data only. Start the server with <code className="bg-amber-100 px-1 rounded">npm run dev</code> 
            in the server directory to enable full functionality.
          </p>
        </div>
      )}
      
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <BarChart2 className="mr-2" /> Voice Session Analysis
      </h1>
      
      {aggregateAnalysis && renderAggregateAnalysis()}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Session Selector */}
        <div className="mb-8">
          <label htmlFor="session-select" className="block text-sm font-medium mb-2">
            Select Session
          </label>
          <select
            id="session-select"
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedSession?.id || ''}
            onChange={(e) => {
              const session = sessions.find(s => s.id === e.target.value);
              if (session) {
                // If the session doesn't have analysis, generate mock analysis
                if (!session.analysis) {
                  const mockAnalysis = generateMockAnalysis(session);
                  session.analysis = mockAnalysis;
                  
                  // Save to localStorage
                  const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
                  if (allSessions[session.id]) {
                    allSessions[session.id].analysis = mockAnalysis;
                    localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
                  }
                }
                setSelectedSession(session);
              }
            }}
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {formatDate(session.startedAt)} ({session.conversation.length} messages)
              </option>
            ))}
          </select>
        </div>
        
        {/* Analysis Panel */}
        <div className="lg:col-span-3">
          {selectedSession && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Session Analysis</h2>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500">
                    {selectedSession.analysis?.lastUpdated 
                      ? `Updated: ${formatDate(selectedSession.analysis.lastUpdated)}`
                      : 'Not analyzed yet'}
                  </span>
                  <button 
                    onClick={refreshAnalysis}
                    disabled={analysisInProgress}
                    className={`flex items-center text-sm px-3 py-1.5 rounded-full
                      ${analysisInProgress 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${analysisInProgress ? 'animate-spin' : ''}`} />
                    {analysisInProgress ? 'Updating...' : 'Refresh Analysis'}
                  </button>
                  <button 
                    onClick={exportAnalysis}
                    className="flex items-center text-sm px-3 py-1.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Export
                  </button>
                </div>
              </div>
              
              {/* Session Overview */}
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Session Date</div>
                  <div className="text-lg font-medium flex items-center">
                    <Clock className="mr-1 w-4 h-4" /> 
                    {formatDate(selectedSession.startedAt)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Duration</div>
                  <div className="text-lg font-medium">
                    {selectedSession.endedAt 
                      ? `${Math.round((new Date(selectedSession.endedAt).getTime() - 
                          new Date(selectedSession.startedAt).getTime()) / 60000)} minutes`
                      : 'Ongoing'}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Messages</div>
                  <div className="text-lg font-medium flex items-center">
                    <MessageCircle className="mr-1 w-4 h-4" /> 
                    {selectedSession.conversation.length}
                  </div>
                </div>
              </div>
              
              {/* Ensure analysis exists before showing analysis components */}
              {selectedSession.analysis ? (
                <>
                  {/* Sentiment */}
                  <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                    <div 
                      className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                      onClick={() => toggleSection('sentiment')}
                    >
                      <h3 className="font-medium">Sentiment Analysis</h3>
                      {expandedSection === 'sentiment' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    
                    {expandedSection === 'sentiment' && (
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row justify-between mb-4">
                          <div className="mb-4 sm:mb-0 sm:mr-4 flex-1">
                            <h4 className="text-sm font-medium mb-2">Emotional Tone</h4>
                            <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full flex"
                                style={{ 
                                  width: '100%',
                                }}
                              >
                                <div 
                                  style={{ 
                                    width: `${selectedSession.analysis.sentiment.positive * 100}%`,
                                    backgroundColor: getSentimentColor(selectedSession.analysis.sentiment.positive, 'positive')
                                  }} 
                                  className="h-full"
                                ></div>
                                <div 
                                  style={{ 
                                    width: `${selectedSession.analysis.sentiment.neutral * 100}%`,
                                    backgroundColor: getSentimentColor(selectedSession.analysis.sentiment.neutral, 'neutral')
                                  }} 
                                  className="h-full"
                                ></div>
                                <div 
                                  style={{ 
                                    width: `${selectedSession.analysis.sentiment.negative * 100}%`,
                                    backgroundColor: getSentimentColor(selectedSession.analysis.sentiment.negative, 'negative')
                                  }} 
                                  className="h-full"
                                ></div>
                              </div>
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-gray-500">
                              <span>Positive: {Math.round(selectedSession.analysis.sentiment.positive * 100)}%</span>
                              <span>Neutral: {Math.round(selectedSession.analysis.sentiment.neutral * 100)}%</span>
                              <span>Negative: {Math.round(selectedSession.analysis.sentiment.negative * 100)}%</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-4">
                          This analysis represents the emotional tone detected throughout your conversation.
                          {selectedSession.analysis.sentiment.positive > 0.5 
                            ? ' Your session had a predominantly positive tone.' 
                            : selectedSession.analysis.sentiment.negative > 0.3 
                              ? ' Your session had significant negative emotional content, which is normal when discussing challenges.'
                              : ' Your session had a balanced emotional tone.'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-gray-500 mb-4">No analysis available for this session yet.</p>
                  <button 
                    onClick={refreshAnalysis} 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                  >
                    Generate Analysis
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 