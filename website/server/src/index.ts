import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes';
import sessionRoutes from './routes/sessionRoutes';
import { handleSocketConnection } from './socket/sessionHandler';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Initialize socket handlers
handleSocketConnection(io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Database connection
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      heartbeatFrequencyMS: 5000,      // Check server status more frequently
      retryWrites: true,               // Enable retry on write operations
      writeConcern: { w: 'majority' },  // Ensure write operations are acknowledged by majority
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error: any) {
    console.error('MongoDB Connection Error Details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errInfo: error.errInfo
    });
    if (process.env.NODE_ENV === 'development') {
      console.warn('Running in development mode without MongoDB connection');
      return false;
    } else {
      process.exit(1);
    }
  }
};

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
const startServer = async () => {
  // Connect to MongoDB
  const dbConnected = await connectDB();
  
  const PORT = process.env.PORT || 5000;
  
  httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    if (!dbConnected) {
      console.warn('⚠️ Server running WITHOUT MongoDB connection - limited functionality available');
    }
  });
};

startServer(); 