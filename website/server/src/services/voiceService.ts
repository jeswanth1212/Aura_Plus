import axios from 'axios';
import dotenv from 'dotenv';

// Try to import ZyphraClient with a fallback
let ZyphraClient;
try {
  // Use dynamic import instead of static import
  const ZyphraModule = require('@zyphra/client');
  ZyphraClient = ZyphraModule.ZyphraClient;
} catch (error) {
  console.warn('Warning: @zyphra/client package not found. Voice cloning with Zyphra will be disabled.');
  // Create a placeholder that will throw an error if used
  ZyphraClient = class MockZyphraClient {
    constructor() {
      throw new Error('Zyphra client is not available. Please install @zyphra/client package.');
    }
  };
}

dotenv.config();

const ELEVEN_LABS_API_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const defaultVoiceId = 'ErXwobaYiN019PkySvjV'; // Default voice ID

export class VoiceService {
  private static headers = {
    'xi-api-key': ELEVENLABS_API_KEY || '',
  };

  static async createVoiceClone(userId: string, audioData: Buffer) {
    try {
      // Get Zyphra API key from environment variables
      const ZYPHRA_API_KEY = process.env.ZYPHRA_API_KEY;
      if (!ZYPHRA_API_KEY) {
        throw new Error('ZYPHRA_API_KEY not configured in server environment variables');
      }

      // Create a Zyphra client instance
      const client = new ZyphraClient({ apiKey: ZYPHRA_API_KEY });
      
      // Convert buffer to base64
      const base64Audio = audioData.toString('base64');
      
      // Generate a simple sample text for voice cloning test
      const demoText = "This is a test of my voice clone with Zyphra";
      
      // Use the client to create voice clone
      const audioResponse = await client.audio.speech.create({
        text: demoText,
        speaking_rate: 15,
        model: 'zonos-v0.1-transformer',
        speaker_audio: base64Audio
      });
      
      // Since Zyphra doesn't return a voice ID directly, we'll store the audio for reuse
      // Create a unique voice ID
      const voiceId = `zyphra_${userId}_${Date.now()}`;
      
      return {
        voiceId,
        createdAt: new Date(),
        voiceProvider: 'zyphra',
        // Store the base64 audio so we can use it for future TTS requests
        speakerAudio: base64Audio
      };
    } catch (error) {
      console.error('Error creating voice clone with Zyphra:', error);
      throw error;
    }
  }

  static async textToSpeech(text: string, voiceId?: string, useZyphra: boolean = false) {
    try {
      const effectiveVoiceId = voiceId || defaultVoiceId;
      
      // If useZyphra flag is set, use Zyphra TTS
      if (useZyphra) {
        return await this.zyphraTTS(text, voiceId || defaultVoiceId);
      }
      
      // Otherwise use ElevenLabs as default
      return await this.elevenLabsTTS(text, effectiveVoiceId);
    } catch (error) {
      console.error('Error in text-to-speech conversion:', error);
      throw error;
    }
  }

  private static async elevenLabsTTS(text: string, voiceId: string) {
    try {
      const response = await axios.post(
        `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            ...this.headers,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error in ElevenLabs TTS:', error);
      throw error;
    }
  }
  
  // Zyphra TTS implementation
  private static async zyphraTTS(text: string, voiceId: string) {
    try {
      console.log('Using Zyphra TTS for voice clone with ID:', voiceId);
      
      // Get Zyphra API key from environment variables
      const ZYPHRA_API_KEY = process.env.ZYPHRA_API_KEY;
      if (!ZYPHRA_API_KEY) {
        throw new Error('ZYPHRA_API_KEY not configured in server environment variables');
      }
      
      // Create a Zyphra client instance
      const client = new ZyphraClient({ apiKey: ZYPHRA_API_KEY });
      
      // Parameters for TTS
      const params: any = {
        text: text,
        speaking_rate: 15,
        model: 'zonos-v0.1-transformer'
      };
      
      // If voiceId is a Zyphra voice ID (it would be the base64 audio data)
      if (voiceId && voiceId !== defaultVoiceId) {
        params.speaker_audio = voiceId;
      }
      
      // Use the client to create TTS
      const audioBlob = await client.audio.speech.create(params);
      
      // Convert Blob to ArrayBuffer
      const audioBuffer = await audioBlob.arrayBuffer();
      
      // Convert ArrayBuffer to Buffer for Node.js
      const buffer = Buffer.from(audioBuffer);
      
      return buffer;
    } catch (error) {
      console.error('Error with Zyphra TTS, falling back to ElevenLabs:', error);
      // Fall back to ElevenLabs if Zyphra fails
      return this.elevenLabsTTS(text, voiceId);
    }
  }

  // Convert speech to text
  static async speechToText(audioData: Buffer) {
    try {
      const response = await axios.post(
        `${ELEVEN_LABS_API_URL}/speech-to-text`,
        audioData,
        {
          headers: {
            ...this.headers,
            'Content-Type': 'audio/mpeg',
          },
        }
      );

      return response.data.text;
    } catch (error) {
      console.error('Error converting speech to text:', error);
      throw error;
    }
  }

  // Delete a voice clone
  static async deleteVoiceClone(voiceId: string) {
    try {
      await axios.delete(
        `${ELEVEN_LABS_API_URL}/voices/${voiceId}`,
        { headers: this.headers }
      );
    } catch (error) {
      console.error('Error deleting voice clone:', error);
      throw error;
    }
  }
} 