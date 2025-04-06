import mongoose, { Document, Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';

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
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (value: string) => validator.isEmail(value),
      message: 'Please provide a valid email address'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
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
  // Only hash the password if it's been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Generate a stronger salt (12 rounds instead of 10)
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    // If this instance already has the password (e.g., was selected with '+password')
    if (this.password) {
      return await bcrypt.compare(candidatePassword, this.password);
    }
    
    // Otherwise, need to query for it again
    const user = await User.findById(this._id).select('+password');
    if (!user || !user.password) {
      console.error('Could not find user or password for comparison');
      return false;
    }
    
    return await bcrypt.compare(candidatePassword, user.password);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
};

export const User = model<IUser>('User', userSchema); 