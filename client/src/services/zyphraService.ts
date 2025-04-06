import { ZyphraClient } from '@zyphra/client';

interface VoiceSettings {
  speaking_rate: number;
  model: string;
}

interface UploadStatus {
  status: 'preparing' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

type UploadStatusCallback = (status: UploadStatus) => void;

interface AudioValidationResult {
  isValid: boolean;
  message: string;
}

// Create a singleton ZyphraService for consistent client usage
class ZyphraService {
  private client: any;
  private initialized: boolean = false;
  private voiceAudioBase64: string | null = null;
  private lastUploadStatus: UploadStatus = {
    status: 'completed',
    progress: 100,
    message: 'Ready'
  };
  
  // Empty MP3 file as a Uint8Array (valid minimal MP3 with better browser compatibility)
  private emptyMp3 = new Uint8Array([
    0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x54, 0x41, 0x47, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  constructor() {
    this.client = new ZyphraClient({ 
      apiKey: 'zsk-729237f9c3ca8eb3396136c07c537375ec89c71f5511b0000ad506b3522ea174' 
    });
    this.initialized = true;
    console.log('ZyphraService initialized');
  }

  // Check if client is initialized
  isInitialized(): boolean {
    return this.initialized;
  }

  // Validate audio files for voice cloning
  private validateAudioFiles(files: File[]): AudioValidationResult {
    if (!files || files.length === 0) {
      return { isValid: false, message: 'No audio files provided' };
    }

    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-m4a'];
    const invalidFiles: string[] = [];

    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        invalidFiles.push(`${file.name} (invalid type: ${file.type})`);
      }
      
      // Check file size (max 15MB per file)
      if (file.size > 15 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (exceeds 15MB limit)`);
      }
    }

    if (invalidFiles.length > 0) {
      return {
        isValid: false,
        message: `Invalid files detected:\n${invalidFiles.join('\n')}`
      };
    }

    return { isValid: true, message: 'Audio files validated successfully' };
  }

  // Update upload status callback
  private updateStatus(
    status: UploadStatus['status'],
    progress: number,
    message: string,
    callback?: UploadStatusCallback
  ): void {
    this.lastUploadStatus = { status, progress, message };
    if (callback) {
      callback(this.lastUploadStatus);
    }
  }

  // Create a voice clone and store the reference audio
  async createVoice(
    name: string, 
    audioFiles: File[], 
    voiceId: string,
    onStatusUpdate?: UploadStatusCallback,
    options: {
      removeBackgroundNoise?: boolean;
      description?: string;
    } = {}
  ): Promise<string> {
    try {
      this.updateStatus('preparing', 0, 'Validating audio files...', onStatusUpdate);
      
      const validation = this.validateAudioFiles(audioFiles);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      this.updateStatus('preparing', 30, 'Processing audio file...', onStatusUpdate);

      // Convert audio file to base64
      const audioFile = audioFiles[0]; // Take the first file
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioFile);
      });

      this.updateStatus('processing', 60, 'Creating voice clone...', onStatusUpdate);

      // Store the base64 audio for later use
      this.voiceAudioBase64 = audioBase64;

      // Generate a unique voice ID if not provided
      const finalVoiceId = voiceId || `zyphra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save the audio reference to localStorage
      localStorage.setItem(`zyphra_audio_${finalVoiceId}`, audioBase64);

      this.updateStatus('completed', 100, 'Voice clone created successfully!', onStatusUpdate);

      return finalVoiceId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.updateStatus('error', 0, `Error: ${errorMessage}`, onStatusUpdate);
      console.error('Error creating voice:', error);
      throw new Error(errorMessage);
    }
  }

  // Generate speech using the cloned voice reference
  async generateSpeechWithSavedVoice(text: string, speakerAudioBase64: string, voiceId: string): Promise<Blob> {
    try {
      console.log(`Generating speech with Zyphra using voice ID: ${voiceId}`);
      
      // Process audio base64 data if needed
      const base64Only = speakerAudioBase64.includes(',') ? 
        speakerAudioBase64.split(',')[1] : speakerAudioBase64;
      
      try {
        // Call Zyphra API to generate speech
        const response = await this.client.audio.speech.create({
          text: text,
          speaker_audio: base64Only,
          model: 'zonos-v0.1-hybrid',
          speaking_rate: 15
        });
        
        // Validate the response
        if (!(response instanceof Blob) || response.size < 100) {
          console.warn('Invalid response from Zyphra API, using fallback audio');
          return new Blob([this.emptyMp3], { type: 'audio/mpeg' });
        }
        
        // Ensure correct MIME type
        return new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
      } catch (error) {
        console.error('Zyphra API error:', error);
        return new Blob([this.emptyMp3], { type: 'audio/mpeg' });
      }
    } catch (error) {
      console.error('Error in generateSpeechWithSavedVoice:', error);
      return new Blob([this.emptyMp3], { type: 'audio/mpeg' });
    }
  }

  // Check if we have a cloned voice
  hasClonedVoice(): boolean {
    return this.voiceAudioBase64 !== null;
  }

  // Get voice ID
  getVoiceId(): string | null {
    return this.voiceAudioBase64 ? 'zyphra_voice' : null;
  }
}

// Export a singleton instance
const zyphraService = new ZyphraService();
export default zyphraService; 