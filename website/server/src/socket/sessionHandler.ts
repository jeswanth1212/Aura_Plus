import { Server, Socket } from 'socket.io';
import { VoiceService } from '../services/voiceService';
import { Session } from '../models/Session';

export const handleSocketConnection = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Handle joining a session room
    socket.on('join-session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      console.log(`Client ${socket.id} joined session ${sessionId}`);
    });

    // Handle voice data from user
    socket.on('voice-data', async (data: { sessionId: string; audioData: Buffer }) => {
      try {
        const { sessionId, audioData } = data;

        // Convert speech to text
        const text = await VoiceService.speechToText(audioData);

        // Find the session
        const session = await Session.findById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }

        // Add user message to conversation
        const userMessage = {
          speaker: 'user' as const,
          text,
          timestamp: new Date()
        };
        session.conversationHistory.push(userMessage);

        // Generate AI response
        const aiMessage = {
          speaker: 'ai' as const,
          text: 'AI response placeholder', // This will be replaced by actual AI response
          timestamp: new Date()
        };
        session.conversationHistory.push(aiMessage);
        await session.save();

        // Convert AI response to speech
        const speechData = await VoiceService.textToSpeech(
          aiMessage.text,
          session.userId.toString() // Use user's voice clone if available
        );

        // Emit the response back to the client
        io.to(`session:${sessionId}`).emit('voice-response', {
          text: aiMessage.text,
          audioData: speechData,
          messages: [userMessage, aiMessage]
        });
      } catch (error) {
        console.error('Error processing voice data:', error);
        socket.emit('error', { message: 'Error processing voice data' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}; 