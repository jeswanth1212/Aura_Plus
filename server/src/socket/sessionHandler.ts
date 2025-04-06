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
    socket.on('voice-data', async (data: { sessionId: string; audioData: Buffer, useZyphra?: boolean }) => {
      try {
        const { sessionId, audioData, useZyphra = false } = data;

        // Convert speech to text
        const text = await VoiceService.speechToText(audioData);

        // Find the session
        const session = await Session.findById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }

        // Add user message to conversation
        const userMessage = {
          role: 'user',
          content: text,
          timestamp: new Date()
        };
        
        // Ensure conversation array exists
        if (!session.conversation) {
          session.conversation = [];
        }
        session.conversation.push(userMessage);

        // Generate AI response
        const aiMessage = {
          role: 'assistant',
          content: 'AI response placeholder', // This will be replaced by actual AI response
          timestamp: new Date()
        };
        session.conversation.push(aiMessage);
        await session.save();

        // Convert AI response to speech using Zyphra if flag is set
        const speechData = await VoiceService.textToSpeech(
          aiMessage.content,
          session.voiceId,
          useZyphra
        );

        // Emit the response back to the client
        io.to(`session:${sessionId}`).emit('voice-response', {
          text: aiMessage.content,
          audioData: speechData,
          messages: [userMessage, aiMessage]
        });
      } catch (error) {
        console.error('Error processing voice data:', error);
        socket.emit('error', { message: 'Failed to process voice data' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}; 