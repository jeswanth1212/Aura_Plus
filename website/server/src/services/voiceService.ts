import axios from 'axios';
import { User } from '../models/User';
import { Blob } from 'buffer';
import FormData from 'form-data';

const ELEVEN_LABS_API_URL = 'https://api.elevenlabs.io/v1';
const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export class VoiceService {
  private static headers = {
    'xi-api-key': ELEVEN_LABS_API_KEY,
    'Content-Type': 'application/json',
  };

  // Create a voice clone for a user
  static async createVoiceClone(userId: string, audioData: Buffer) {
    try {
      // Get Zyphra API key from environment variables
      const ZYPHRA_API_KEY = process.env.ZYPHRA_API_KEY;
      if (!ZYPHRA_API_KEY) {
        throw new Error('ZYPHRA_API_KEY not configured in server environment variables');
      }
      
      // Convert Buffer to base64 string
      const base64Audio = audioData.toString('base64');
      
      // Use the Zyphra text-to-speech API with sample_audio for voice cloning
      const ZYPHRA_API_URL = 'http://api.zyphra.com/v1/audio/text-to-speech';
      
      // First make a test request with the audio to create a voice profile
      // We use a sample test for the initial cloning
      const response = await axios.post(
        ZYPHRA_API_URL,
        {
          text: "This is a test of the voice cloning system",
          speaking_rate: 15,
          model: 'zonos-v0.1-transformer',
          speaker_audio: base64Audio
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ZYPHRA_API_KEY
          },
          responseType: 'arraybuffer',
        }
      );

      // Since Zyphra doesn't return a voice ID directly, we'll store the audio for reuse
      // Generate a unique ID for this voice
      const voiceId = `zyphra_${userId}_${Date.now()}`;

      // Update user with voice ID
      await User.findByIdAndUpdate(userId, {
        clonedVoiceId: base64Audio, // Store the actual base64 audio to reuse
        useClonedVoiceForNextSession: true,
        voiceProvider: 'zyphra'
      });

      return voiceId;
    } catch (error) {
      console.error('Error creating voice clone with Zyphra:', error);
      throw error;
    }
  }

  // Convert text to speech
  static async textToSpeech(text: string, voiceId?: string, useZyphra: boolean = false) {
    try {
      const defaultVoiceId = 'ErXwobaYiN019PkySvjV'; // Default ElevenLabs voice
      
      // If useZyphra flag is set, use Zyphra TTS
      if (useZyphra) {
        return await this.zyphraTTS(text, voiceId || defaultVoiceId);
      }
      
      // Otherwise use ElevenLabs
      return await this.elevenLabsTTS(text, voiceId || defaultVoiceId);
    } catch (error) {
      console.error('Error converting text to speech:', error);
      throw error;
    }
  }
  
  // ElevenLabs TTS implementation
  private static async elevenLabsTTS(text: string, voiceId: string) {
    try {
      const response = await axios.post(
        `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
          },
        },
        {
          headers: this.headers,
          responseType: 'arraybuffer',
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error with ElevenLabs TTS:', error);
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
      
      // Correct Zyphra API endpoint based on documentation
      const ZYPHRA_API_URL = 'http://api.zyphra.com/v1/audio/text-to-speech';
      
      const response = await axios.post(
        ZYPHRA_API_URL,
        {
          text,
          speaking_rate: 15,
          model: 'zonos-v0.1-transformer', // Default model from documentation
          mime_type: 'audio/mp3',
          // Use voice ID as speaker_audio if available (assumes it's a base64 audio reference)
          ...(voiceId && voiceId !== 'ErXwobaYiN019PkySvjV' ? { speaker_audio: voiceId } : {})
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ZYPHRA_API_KEY
          },
          responseType: 'arraybuffer',
        }
      );

      return response.data;
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