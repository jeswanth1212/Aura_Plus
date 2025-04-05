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
  let retries = 5;
  
  while (retries > 0) {
    try {
      console.log(`Attempting to connect to MongoDB (${retries} retries left)...`);
      mongoose.set('debug', process.env.NODE_ENV === 'development');
      
      const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://test:Viswa2403@cluster0.jsgnf1h.mongodb.net/test?retryWrites=true&w=majority';
      
      console.log(`Using MongoDB connection string: ${mongoUri.replace(/:[^:]*@/, ':****@')}`);
      
      // Test if the URL is valid
      try {
        const parsedUrl = new URL(mongoUri);
        console.log(`MongoDB host: ${parsedUrl.hostname}`);
        console.log(`MongoDB database: ${parsedUrl.pathname.substring(1) || 'None (using default)'}`);
      } catch (parseError) {
        console.error('Error parsing MongoDB URI:', parseError);
      }
      
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 43005,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        family: 4 // Force IPv4
      });
      
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      console.log(`Database name: ${conn.connection.name}`);
      console.log(`Connection state: ${mongoose.STATES[conn.connection.readyState]}`);
      
      // Test the connection by listing collections
      try {
        const collections = await conn.connection.db.listCollections().toArray();
        console.log(`Available collections: ${collections.map(c => c.name).join(', ') || 'None'}`);
      } catch (listError) {
        console.error('Error listing collections:', listError);
      }
      
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
      
      // Connection was successful, so break out of retry loop
      return;
      
    } catch (error: any) {
      console.error('MongoDB Connection Error Details:');
      console.error(`Error Type: ${error.name}`);
      console.error(`Error Message: ${error.message}`);
      if (error.code) console.error(`Error Code: ${error.code}`);
      if (error.syscall) console.error(`System Call: ${error.syscall}`);
      if (error.hostname) console.error(`Hostname: ${error.hostname}`);
      
      retries--;
      
      if (retries > 0) {
        // Wait before next retry (exponential backoff)
        const waitTime = Math.pow(2, 5 - retries) * 1000;
        console.log(`Retrying in ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('All connection attempts failed');
        process.exit(1);
      }
    }
  }
};

// Start server
const PORT = process.env.PORT || 3005;
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 