import mongoose, { Document, Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: Schema.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  clonedVoiceId?: string;
  useClonedVoiceForNextSession?: boolean;
  mentalHealthAnalysis?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  clonedVoiceId: String,
  useClonedVoiceForNextSession: {
    type: Boolean,
    default: false
  },
  mentalHealthAnalysis: String
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
};

export const User = model<IUser>('User', userSchema); 