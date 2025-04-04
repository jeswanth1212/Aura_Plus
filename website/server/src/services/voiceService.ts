import axios from 'axios';
import { User } from '../models/User';

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
      const response = await axios.post(
        `${ELEVEN_LABS_API_URL}/voices/add`,
        {
          name: `user_${userId}`,
          files: [audioData],
          description: 'Therapy session voice clone',
        },
        { headers: this.headers }
      );

      const voiceId = response.data.voice_id;

      // Update user with voice ID
      await User.findByIdAndUpdate(userId, {
        clonedVoiceId: voiceId,
        useClonedVoiceForNextSession: true,
      });

      return voiceId;
    } catch (error) {
      console.error('Error creating voice clone:', error);
      throw error;
    }
  }

  // Convert text to speech
  static async textToSpeech(text: string, voiceId?: string) {
    try {
      const defaultVoiceId = 'ErXwobaYiN019PkySvjV'; // Default ElevenLabs voice
      const response = await axios.post(
        `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId || defaultVoiceId}`,
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
      console.error('Error converting text to speech:', error);
      throw error;
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