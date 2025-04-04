import mongoose, { Document, Schema } from 'mongoose';

// Message interface
interface IMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// Session interface
export interface ISession extends Document {
  user: mongoose.Schema.Types.ObjectId;
  startTime: Date;
  endTime: Date | null;
  isActive: boolean;
  messages: IMessage[];
  summary: string;
}

// Message schema
const messageSchema = new Schema<IMessage>({
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

// Session schema
const sessionSchema = new Schema<ISession>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  messages: [messageSchema],
  summary: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster queries
sessionSchema.index({ user: 1, startTime: -1 });

export const Session = mongoose.model<ISession>('Session', sessionSchema); 