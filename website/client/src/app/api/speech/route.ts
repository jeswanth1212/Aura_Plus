import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Missing text parameter' },
        { status: 400 }
      );
    }

    // ElevenLabs API configuration
    const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_LABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key is not configured' },
        { status: 500 }
      );
    }
    
    // Use a stable, warm female voice
    const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice
    
    console.log('Generating speech with ElevenLabs API');
    
    // Call ElevenLabs API to generate speech
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVEN_LABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs API Error:', response.status, response.statusText);
      let errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        console.error('ElevenLabs Error Details:', errorJson);
      } catch (e) {
        console.error('ElevenLabs Raw Error:', errorText);
      }
      
      return NextResponse.json(
        { error: `Failed to generate speech: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the audio as an ArrayBuffer
    const audioArrayBuffer = await response.arrayBuffer();
    
    // Create a Buffer from the ArrayBuffer
    const audioBuffer = Buffer.from(audioArrayBuffer);
    
    // Return the audio as a base64 string for the browser to play
    const base64Audio = audioBuffer.toString('base64');
    
    return NextResponse.json({
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
    });
  } catch (error: any) {
    console.error('Speech generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 