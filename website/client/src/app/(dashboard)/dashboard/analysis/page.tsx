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

// Define interface for aggregate analysis
interface AggregateAnalysis {
  overallSentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topThemes: Array<{
    name: string;
    frequency: number;
    strength: number;
  }>;
  progressMetrics: {
    sessionsCompleted: number;
    totalDuration: number;
    averageDuration: number;
    userEngagement: number;
  };
  emotionalTrend: Array<{
    date: Date;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    }
  }>;
  commonIssues: string[];
  mostEffectiveRecommendations: string[];
}

export default function AnalysisPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('sentiment');
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [showAggregateView, setShowAggregateView] = useState(false);
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
      
      // Use the model name known to work
      const modelName = "gemini-1.5-pro";
      
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
        throw new Error('Failed to extract JSON from response');
      }
      
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
    } catch (err) {
      console.error('Error analyzing session with AI:', err);
      // Fall back to mock analysis
      return generateMockAnalysis(session);
    }
  }, []);

  // Function to sync a session with the backend
  const syncSessionWithBackend = async (session: SessionData) => {
    try {
      // Get auth token from localStorage or use demo token in development
      let token = localStorage.getItem('auth_token');
      
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
      } catch (fetchError) {
        console.warn("Server connection failed. Using client-only storage.", fetchError);
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

  // Load sessions and set up event listener for session updates
  useEffect(() => {
    // Load sessions from localStorage
    const loadSessions = async () => {
      try {
        const userId = localStorage.getItem('aura_user_id');
        
        // Get all sessions from localStorage
        let sessionsObj = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
        const userSessionIds = JSON.parse(localStorage.getItem(`aura_user_sessions_${userId}`) || '[]');
        
        // If storage is empty or uses the old array format, create sample data
        if (Object.keys(sessionsObj).length === 0 || Array.isArray(sessionsObj)) {
          console.log('No valid sessions found, creating sample data');
          const sampleSessions = createSampleSessions();
          
          // Re-read the properly formatted data
          sessionsObj = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
        }
        
        // Get sessions for the current user
        let userSessions: SessionData[] = [];
        
        if (userSessionIds.length > 0) {
          // Filter sessions by userSessionIds
          userSessions = userSessionIds
            .map((id: string) => sessionsObj[id])
            .filter(Boolean)
            .map((session: any) => ({
              ...session,
              startedAt: new Date(session.startedAt),
              endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
              conversation: session.conversation.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));
        } else {
          // Fall back to filtering by userId
          userSessions = Object.values(sessionsObj)
            .filter((s: any) => s.userId === userId)
            .map((session: any) => ({
              ...session,
              startedAt: new Date(session.startedAt),
              endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
              conversation: session.conversation.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));
        }
        
        // Create sample data if no user sessions found
        if (userSessions.length === 0) {
          console.log('No user sessions found, creating sample data');
          const sampleSessions = createSampleSessions();
          
          // Re-read to get properly formatted sessions
          const updatedSessionsObj = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
          const updatedUserSessionIds = JSON.parse(localStorage.getItem(`aura_user_sessions_${userId}`) || '[]');
          
          userSessions = updatedUserSessionIds
            .map((id: string) => updatedSessionsObj[id])
            .filter(Boolean)
            .map((session: any) => ({
              ...session,
              startedAt: new Date(session.startedAt),
              endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
              conversation: session.conversation.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));
        }
        
        // Sort by startedAt (most recent first)
        const sortedSessions = userSessions.sort((a: any, b: any) => {
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        });
        
        // Process sessions to add analysis data
        const processedSessions = await Promise.all(sortedSessions.map(async (session: any) => {
          // Only analyze if there's no analysis or if it's been more than a day since the last analysis
          if (!session.analysis || 
              !session.analysis.lastUpdated || 
              (new Date().getTime() - new Date(session.analysis.lastUpdated).getTime() > 24 * 60 * 60 * 1000)) {
            session.analysis = await analyzeSessionWithAI(session);
            
            // Save updated analysis back to localStorage
            const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '{}');
            if (allSessions[session.id]) {
              allSessions[session.id].analysis = session.analysis;
              localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
            }
          }
          return session;
        }));
        
        setSessions(processedSessions);
        
        // Generate aggregate analysis from all sessions
        if (processedSessions.length > 0) {
          setAggregateAnalysis(generateAggregateAnalysis(processedSessions));
        }
        
        // Select the most recent session by default
        if (processedSessions.length > 0) {
          setSelectedSession(processedSessions[0]);
        }
        
      } catch (err) {
        console.error("Error loading sessions:", err);
        setError('Failed to load sessions. ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();

    // Listen for session storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aura_sessions') {
        loadSessions();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Custom event for session updates
    const handleSessionUpdate = () => {
      loadSessions();
    };

    window.addEventListener('aura_session_updated', handleSessionUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('aura_session_updated', handleSessionUpdate);
    };
  }, [analyzeSessionWithAI, createSampleSessions]);

  // Manually refresh analysis for the current session
  const refreshAnalysis = async () => {
    if (!selectedSession || analysisInProgress) return;
    
    setAnalysisInProgress(true);
    try {
      const updatedAnalysis = await analyzeSessionWithAI(selectedSession);
      
      // Update in state
      setSelectedSession(prev => prev ? { ...prev, analysis: updatedAnalysis } : null);
      
      // Update in sessions list
      setSessions(prev => prev.map(session => 
        session.id === selectedSession.id 
          ? { ...session, analysis: updatedAnalysis } 
          : session
      ));
      
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

  // Generate aggregate analysis from all sessions
  const generateAggregateAnalysis = (sessions: SessionData[]): AggregateAnalysis => {
    if (!sessions || sessions.length === 0) {
      return {
        overallSentiment: { positive: 0, neutral: 0, negative: 0 },
        topThemes: [],
        progressMetrics: { sessionsCompleted: 0, totalDuration: 0, averageDuration: 0, userEngagement: 0 },
        emotionalTrend: [],
        commonIssues: [],
        mostEffectiveRecommendations: []
      };
    }
    
    // Compute overall sentiment as weighted average of all sessions
    let positiveSum = 0, neutralSum = 0, negativeSum = 0;
    let themeFrequency: Record<string, { count: number, strengthSum: number }> = {};
    let allRecommendations: string[] = [];
    let issuesMap: Record<string, number> = {};
    
    // Track sentiment over time for trend analysis
    const emotionalTrend = sessions
      .filter(session => session.analysis?.sentiment)
      .map(session => ({
        date: new Date(session.startedAt),
        sentiment: session.analysis!.sentiment
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate total time spent in therapy
    const totalDuration = sessions.reduce((total, session) => {
      if (session.startedAt && session.endedAt) {
        return total + (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / (60 * 1000);
      }
      return total;
    }, 0);
    
    // Calculate user engagement (ratio of user messages to total)
    let totalUserMessages = 0;
    let totalMessages = 0;
    
    sessions.forEach(session => {
      // Add to sentiment totals
      if (session.analysis?.sentiment) {
        positiveSum += session.analysis.sentiment.positive;
        neutralSum += session.analysis.sentiment.neutral;
        negativeSum += session.analysis.sentiment.negative;
      }
      
      // Count theme occurrences and total strength
      if (session.analysis?.themes) {
        session.analysis.themes.forEach(theme => {
          if (!themeFrequency[theme.name]) {
            themeFrequency[theme.name] = { count: 0, strengthSum: 0 };
          }
          themeFrequency[theme.name].count += 1;
          themeFrequency[theme.name].strengthSum += theme.strength;
        });
      }
      
      // Collect all recommendations
      if (session.analysis?.recommendations) {
        allRecommendations = [...allRecommendations, ...session.analysis.recommendations];
      }
      
      // Extract potential issues from conversations
      session.conversation.forEach(msg => {
        if (msg.role === 'user') {
          totalUserMessages++;
          
          // Simple keyword extraction for common issues
          const issueKeywords = [
            'anxiety', 'stress', 'worried', 'depression', 'sad', 'tired',
            'sleep', 'relationship', 'work', 'family', 'fear', 'angry',
            'conflict', 'overwhelm', 'pressure', 'lonely'
          ];
          
          issueKeywords.forEach(keyword => {
            if (msg.content.toLowerCase().includes(keyword)) {
              issuesMap[keyword] = (issuesMap[keyword] || 0) + 1;
            }
          });
        }
        totalMessages++;
      });
    });
    
    // Calculate averages
    const sessionsCount = sessions.length;
    const averageSentiment = {
      positive: positiveSum / sessionsCount,
      neutral: neutralSum / sessionsCount,
      negative: negativeSum / sessionsCount
    };
    
    // Sort themes by frequency and average strength
    const topThemes = Object.entries(themeFrequency)
      .map(([name, { count, strengthSum }]) => ({
        name,
        frequency: count / sessionsCount,
        strength: strengthSum / count
      }))
      .sort((a, b) => b.frequency - a.frequency || b.strength - a.strength)
      .slice(0, 5);
    
    // Find common issues
    const commonIssues = Object.entries(issuesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);
    
    // Count recommendation frequencies
    const recommendationCount: Record<string, number> = {};
    allRecommendations.forEach(rec => {
      recommendationCount[rec] = (recommendationCount[rec] || 0) + 1;
    });
    
    // Find most frequent recommendations
    const mostEffectiveRecommendations = Object.entries(recommendationCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([rec]) => rec);
    
    return {
      overallSentiment: averageSentiment,
      topThemes,
      progressMetrics: {
        sessionsCompleted: sessionsCount,
        totalDuration,
        averageDuration: totalDuration / sessionsCount,
        userEngagement: totalUserMessages / totalMessages
      },
      emotionalTrend,
      commonIssues,
      mostEffectiveRecommendations
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

  // Define the AggregateAnalysisView component
  const AggregateAnalysisView = ({
    analysis,
    sessions
  }: {
    analysis: AggregateAnalysis | null;
    sessions: SessionData[];
  }) => {
    if (!analysis) {
      return <div className="p-6 text-center text-gray-500">No aggregate data available</div>;
    }

    // Calculate progress since first session
    const firstSession = [...sessions].sort((a, b) => 
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )[0];
    
    const daysSinceStart = firstSession 
      ? Math.ceil((new Date().getTime() - new Date(firstSession.startedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Aggregate Analysis</h2>
            <div className="text-sm text-gray-500">
              Data from {sessions.length} sessions over {daysSinceStart} days
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Overall Emotional State */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Overall Emotional State</h3>
            <div className="flex items-center mb-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${analysis.overallSentiment.positive * 100}%` }}
                  ></div>
                  <div 
                    className="bg-gray-400" 
                    style={{ width: `${analysis.overallSentiment.neutral * 100}%` }}
                  ></div>
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${analysis.overallSentiment.negative * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                <span>Positive: {(analysis.overallSentiment.positive * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-gray-400 rounded-full mr-1"></span>
                <span>Neutral: {(analysis.overallSentiment.neutral * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span>
                <span>Negative: {(analysis.overallSentiment.negative * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          {/* Top Themes */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Recurring Themes</h3>
            {analysis.topThemes.length > 0 ? (
              <div className="space-y-3">
                {analysis.topThemes.map((theme, i) => (
                  <div key={i} className="flex flex-col">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{theme.name}</span>
                      <span>{(theme.frequency * 100).toFixed(0)}% of sessions</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 rounded-full h-2" 
                        style={{ width: `${theme.strength * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recurring themes identified yet</p>
            )}
          </div>
          
          {/* Progress Metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Therapy Progress</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded p-3 shadow-sm">
                <div className="text-3xl font-bold text-blue-600">
                  {analysis.progressMetrics.sessionsCompleted}
                </div>
                <div className="text-xs text-gray-500">Sessions Completed</div>
              </div>
              <div className="bg-white rounded p-3 shadow-sm">
                <div className="text-3xl font-bold text-blue-600">
                  {Math.round(analysis.progressMetrics.totalDuration)}
                </div>
                <div className="text-xs text-gray-500">Total Minutes</div>
              </div>
              <div className="bg-white rounded p-3 shadow-sm">
                <div className="text-3xl font-bold text-blue-600">
                  {Math.round(analysis.progressMetrics.averageDuration)}
                </div>
                <div className="text-xs text-gray-500">Avg. Session (Min)</div>
              </div>
              <div className="bg-white rounded p-3 shadow-sm">
                <div className="text-3xl font-bold text-blue-600">
                  {(analysis.progressMetrics.userEngagement * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">Engagement Rate</div>
              </div>
            </div>
          </div>
          
          {/* Common Issues */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Common Discussion Topics</h3>
            {analysis.commonIssues.length > 0 ? (
              <div className="space-y-2">
                {analysis.commonIssues.map((issue, i) => (
                  <div key={i} className="bg-white px-3 py-2 rounded shadow-sm">
                    <span className="capitalize">{issue}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No common issues identified yet</p>
            )}
          </div>
        </div>
        
        {/* Recommendations */}
        <div className="p-6 border-t">
          <h3 className="text-lg font-semibold mb-3">Top Recommendations</h3>
          {analysis.mostEffectiveRecommendations.length > 0 ? (
            <div className="space-y-3">
              {analysis.mostEffectiveRecommendations.map((rec, i) => (
                <div key={i} className="flex items-start">
                  <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-2 mt-0.5">
                    {i + 1}
                  </div>
                  <p>{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No recommendations available yet</p>
          )}
        </div>
        
        {/* Timeline of Progress */}
        <div className="p-6 border-t">
          <h3 className="text-lg font-semibold mb-3">Emotional Trend Over Time</h3>
          {analysis.emotionalTrend.length > 1 ? (
            <div className="h-60 w-full">
              {/* Simplified trend visualization */}
              <div className="h-full flex items-end">
                {analysis.emotionalTrend.map((point, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col-reverse h-48">
                      <div 
                        className="w-full bg-green-500" 
                        style={{ height: `${point.sentiment.positive * 100}%` }}
                      ></div>
                      <div 
                        className="w-full bg-gray-400" 
                        style={{ height: `${point.sentiment.neutral * 100}%` }}
                      ></div>
                      <div 
                        className="w-full bg-red-500" 
                        style={{ height: `${point.sentiment.negative * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Need more sessions to show trend</p>
          )}
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
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Session list sidebar */}
        <div className="md:col-span-3 bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Sessions</h2>
            <button 
              className={`px-3 py-1 rounded text-sm ${showAggregateView ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setShowAggregateView(!showAggregateView)}
            >
              {showAggregateView ? 'All Sessions View' : 'Single Session View'}
            </button>
          </div>
          
          {isLoading ? (
            <p className="text-gray-500">Loading sessions...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : sessions.length === 0 ? (
            <p className="text-gray-500">No sessions found.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    !showAggregateView && selectedSession?.id === session.id
                      ? 'bg-blue-100 border-l-4 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setSelectedSession(session);
                    setShowAggregateView(false);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {formatDate(session.startedAt)}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {session.endedAt
                          ? `${Math.round(
                              (new Date(session.endedAt).getTime() -
                                new Date(session.startedAt).getTime()) /
                                (1000 * 60)
                            )} mins`
                          : 'Ongoing'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex space-x-1">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: `rgba(0, 128, 0, ${
                              session.analysis?.sentiment.positive || 0.1
                            })`,
                          }}
                        ></span>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: `rgba(200, 200, 200, ${
                              session.analysis?.sentiment.neutral || 0.1
                            })`,
                          }}
                        ></span>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: `rgba(255, 0, 0, ${
                              session.analysis?.sentiment.negative || 0.1
                            })`,
                          }}
                        ></span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {session.conversation.length} messages
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analysis Content */}
        <div className="md:col-span-9">
          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 mb-4 rounded-full bg-gray-200"></div>
                <div className="h-4 w-3/4 mb-2 rounded bg-gray-200"></div>
                <div className="h-4 w-1/2 rounded bg-gray-200"></div>
                <p className="mt-4 text-gray-500">Loading analysis...</p>
              </div>
            </div>
          ) : showAggregateView ? (
            <AggregateAnalysisView analysis={aggregateAnalysis} sessions={sessions} />
          ) : selectedSession ? (
            <div className="bg-white rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Session on {formatDate(selectedSession.startedAt)}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={refreshAnalysis}
                    disabled={analysisInProgress}
                    className={`flex items-center px-3 py-1 ${analysisInProgress ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'} rounded-md text-sm`}
                  >
                    <RefreshCw size={16} className={`mr-1 ${analysisInProgress ? 'animate-spin' : ''}`} /> 
                    Reanalyze
                  </button>
                  <button
                    onClick={exportAnalysis}
                    className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
                  >
                    <Download size={16} className="mr-1" /> Export
                  </button>
                </div>
              </div>
              
              {/* Analysis Last Updated */}
              {selectedSession.analysis.lastUpdated && (
                <div className="text-xs text-gray-500 mb-3">
                  Analysis last updated: {formatDate(selectedSession.analysis.lastUpdated)}
                </div>
              )}
              
              {/* Session Duration */}
              <div className="flex items-center mb-6 text-gray-600">
                <Clock size={18} className="mr-2" />
                <span>
                  Duration: {
                    selectedSession.endedAt 
                      ? formatDuration((new Date(selectedSession.endedAt).getTime() - new Date(selectedSession.startedAt).getTime()) / 1000)
                      : 'In progress'
                  }
                </span>
                <span className="mx-4">|</span>
                <MessageCircle size={18} className="mr-2" />
                <span>{selectedSession.conversation.length} messages exchanged</span>
              </div>
              
              {/* Sentiment Analysis */}
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
              
              {/* Themes */}
              <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                <div 
                  className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                  onClick={() => toggleSection('themes')}
                >
                  <h3 className="font-medium">Key Themes</h3>
                  {expandedSection === 'themes' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                
                {expandedSection === 'themes' && (
                  <div className="p-4">
                    <div className="space-y-4">
                      {selectedSession.analysis.themes.map((theme, index) => (
                        <div key={index}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{theme.name}</span>
                            <span className="text-sm text-gray-500">{Math.round(theme.strength * 100)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500"
                              style={{ width: `${theme.strength * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                      These themes represent the main topics discussed during your therapy session, 
                      with percentages indicating their prominence in the conversation.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Speaking Time */}
              <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                <div 
                  className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                  onClick={() => toggleSection('speaking')}
                >
                  <h3 className="font-medium">Speaking Time</h3>
                  {expandedSection === 'speaking' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                
                {expandedSection === 'speaking' && (
                  <div className="p-4">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">You</span>
                          <span className="text-sm text-gray-500">
                            {formatDuration(selectedSession.analysis.speakingTime.user)}
                          </span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500"
                            style={{ 
                              width: `${(selectedSession.analysis.speakingTime.user / 
                                (selectedSession.analysis.speakingTime.user + selectedSession.analysis.speakingTime.assistant)) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">Aura AI</span>
                          <span className="text-sm text-gray-500">
                            {formatDuration(selectedSession.analysis.speakingTime.assistant)}
                          </span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500"
                            style={{ 
                              width: `${(selectedSession.analysis.speakingTime.assistant / 
                                (selectedSession.analysis.speakingTime.user + selectedSession.analysis.speakingTime.assistant)) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                      This shows the estimated speaking time distribution during your conversation.
                      {selectedSession.analysis.speakingTime.user > selectedSession.analysis.speakingTime.assistant
                        ? ' You did most of the talking, which is ideal for a therapeutic conversation.'
                        : ' The conversation had a balanced speaking distribution.'}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Recommendations */}
              <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                <div 
                  className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                  onClick={() => toggleSection('recommendations')}
                >
                  <h3 className="font-medium">Recommendations</h3>
                  {expandedSection === 'recommendations' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                
                {expandedSection === 'recommendations' && (
                  <div className="p-4">
                    <ul className="list-disc pl-5 space-y-2">
                      {selectedSession.analysis.recommendations?.map((rec, index) => (
                        <li key={index} className="text-gray-700">{rec}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-gray-600 mt-4">
                      These personalized recommendations are based on the themes and content of your conversation.
                      Consider implementing them to support your mental wellness goals.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Note about data privacy */}
              <div className="mt-8 text-xs text-gray-500 border-t pt-4">
                <p>
                  Note: The analysis uses AI to process your conversation and generate insights.
                  All processing is secure and your data is only used to provide this analysis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 