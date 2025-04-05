import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handleSocketConnection } from './socket/sessionHandler';
import authRoutes from './routes/authRoutes';
import sessionRoutes from './routes/sessionRoutes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Set up Socket.io with CORS options
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize socket connection handler
handleSocketConnection(io);

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increase limit for audio data

// Routes
app.use('/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    mongoose.set('debug', process.env.NODE_ENV === 'development');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://test:Viswa2403@cluster0.jsgnf1h.mongodb.net/auraplus?retryWrites=true&w=majority';
    
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      family: 4 // Force IPv4
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Set up error handlers for the connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (error: any) {
    console.error('MongoDB Connection Error Details:');
    console.error(`Error Type: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    if (error.code) console.error(`Error Code: ${error.code}`);
    if (error.syscall) console.error(`System Call: ${error.syscall}`);
    if (error.hostname) console.error(`Hostname: ${error.hostname}`);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 