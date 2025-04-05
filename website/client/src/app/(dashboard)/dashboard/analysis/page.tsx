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

export default function AnalysisPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('sentiment');
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const router = useRouter();

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

    // Save to localStorage
    localStorage.setItem('aura_sessions', JSON.stringify(sampleSessions));
    return sampleSessions;
  }, []);

  // Function to analyze a session with AI
  const analyzeSessionWithAI = useCallback(async (session: SessionData): Promise<SessionAnalysis> => {
    if (!GEMINI_API_KEY) {
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
      
      // Call Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
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
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the response text
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Extract the JSON from the response text
      const jsonMatch = responseText.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }
      
      const analysisData = JSON.parse(jsonMatch[0]);
      
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

  // Load sessions and set up event listener for session updates
  useEffect(() => {
    // Load sessions from localStorage
    const loadSessions = async () => {
      try {
        const userId = localStorage.getItem('aura_user_id');
        
        // Get all sessions for the user
        let storedSessions = JSON.parse(localStorage.getItem('aura_sessions') || '[]');
        let userSessions = storedSessions.filter((s: any) => s.userId === userId);
        
        // If no sessions exist or user has no sessions, create sample data
        if (storedSessions.length === 0 || userSessions.length === 0) {
          console.log('No sessions found, creating sample data');
          const sampleSessions = createSampleSessions();
          userSessions = sampleSessions;
          storedSessions = sampleSessions;
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
            const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '[]');
            const sessionIndex = allSessions.findIndex((s: any) => s.id === session.id);
            
            if (sessionIndex !== -1) {
              allSessions[sessionIndex].analysis = session.analysis;
              localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
            }
          }
          return session;
        }));
        
        setSessions(processedSessions);
        
        // Select the most recent session by default
        if (processedSessions.length > 0) {
          setSelectedSession(processedSessions[0]);
        }
        
      } catch (err) {
        console.error("Error loading sessions:", err);
        setError('Failed to load sessions');
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
      
      // Save to localStorage
      const allSessions = JSON.parse(localStorage.getItem('aura_sessions') || '[]');
      const sessionIndex = allSessions.findIndex((s: any) => s.id === selectedSession.id);
      
      if (sessionIndex !== -1) {
        allSessions[sessionIndex].analysis = updatedAnalysis;
        localStorage.setItem('aura_sessions', JSON.stringify(allSessions));
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
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <BarChart2 className="mr-2" /> Voice Session Analysis
      </h1>
      
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
            if (session) setSelectedSession(session);
          }}
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {formatDate(session.startedAt)} ({session.conversation.length} messages)
            </option>
          ))}
        </select>
      </div>
      
      {selectedSession && selectedSession.analysis && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
  );
} 