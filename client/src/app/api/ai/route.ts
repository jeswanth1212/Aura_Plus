import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const initGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  return new GoogleGenerativeAI(apiKey);
};

export async function POST(request: Request) {
  try {
    const { message, sessionHistory = [] } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Missing message parameter' },
        { status: 400 }
      );
    }

    // Initialize Gemini API
    const genAI = initGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Format the conversation history
    const formattedHistory = sessionHistory.map((msg: any) => ({
      role: msg.speaker === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
    
    // Create a chat session
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
    
    // Generate a response
    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();
    
    return NextResponse.json({ message: aiResponse });
  } catch (error: any) {
    console.error('AI processing error:', error);
    
    // Return a more helpful error message
    return NextResponse.json(
      { 
        error: 'Failed to generate AI response', 
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
} 