import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import { Schema } from 'mongoose';
import { EmailService } from '../services/emailService';

// Generate JWT token
const generateToken = (id: Schema.Types.ObjectId | string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'defaultsecret', {
    expiresIn: '30d'
  });
};

// Register a new user
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      verificationToken
    });

    // Try to send verification email, but don't fail registration if it fails
    try {
      await EmailService.sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Don't return error - allow registration to continue
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Return user info and token
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login user
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user info and token
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Verify email
export const verifyEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    
    // Find user with this verification token
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      res.status(400).json({ message: 'Invalid verification token' });
      return;
    }
    
    // Mark user as verified and clear the verification token
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    // Return success
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

// Request password reset
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return res.status(500).json({ message: 'Failed to send password reset email' });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user: IUser | null = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
}; 