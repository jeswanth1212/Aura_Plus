import mongoose, { Document, Schema } from 'mongoose';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface ISession extends Document {
  user: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date | null;
  isActive: boolean;
  messages: Message[];
  summary?: string;
  startedAt?: Date;
  endedAt?: Date;
  conversation?: any[];
  sentiment?: string;
  voiceId?: string;
  metadata?: {
    clientSessionId?: string;
    [key: string]: any;
  };
  mentalHealthMetrics?: {
    anxiety?: number;
    depression?: number;
    stress?: number;
    positivity?: number;
  };
}

const messageSchema = new Schema({
  sender: {
    type: String,
    enum: ['user', 'ai'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const sessionSchema = new Schema<ISession>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  endTime: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  messages: [messageSchema],
  conversation: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  summary: String,
  sentiment: String,
  voiceId: String,
  metadata: {
    clientSessionId: String,
    type: Map,
    of: Schema.Types.Mixed
  },
  mentalHealthMetrics: {
    anxiety: Number,
    depression: Number,
    stress: Number,
    positivity: Number
  }
}, {
  timestamps: true
});

// Index for faster queries by user and start time
sessionSchema.index({ user: 1, startTime: -1 });

// Add another index for finding sessions by client ID (non-unique)
sessionSchema.index({ 'metadata.clientSessionId': 1 }, { background: true });

export const Session = mongoose.model<ISession>('Session', sessionSchema); 