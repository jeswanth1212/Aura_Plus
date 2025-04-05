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
  // Check if JWT_SECRET is set in environment variables
  const jwtSecret = '872d69bde6a1851539e1692d9c8c8b589494319136e7f368c4dfa808440abda5de832d5684fd3e1ff456bcf19109f9d3208e4e93fb840c728e653e150378fada';
  if (!jwtSecret) {
    console.error('JWT_SECRET not set in environment variables');
    throw new Error('JWT configuration error');
  }
  
  // Log that we're generating a token (without exposing the token itself)
  console.log(`Generating JWT token for user ID: ${id}`);
  
  // Generate token with the JWT_SECRET from environment variables
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRY || '30d'
  } as jwt.SignOptions);
};

// Register a new user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    console.log('Registration attempt:', { name, email, passwordLength: password?.length });
    
    // Validate inputs
    if (!name || !email || !password) {
      console.log('Missing required fields:', { name: !!name, email: !!email, password: !!password });
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'All fields are required'
      });
      return;
    }

    if (password.length < 6) {
      console.log('Password too short:', password.length);
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Check if user already exists
    console.log('Checking for existing user with email:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists with email:', email);
      res.status(400).json({
        success: false,
        error: 'Registration failed',
        message: 'Email is already registered'
      });
      return;
    }

    // Generate verification token
    console.log('Generating verification token');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user - don't hash password here, the pre-save hook will do it
    console.log('Creating new user');
    const user = await User.create({
      name,
      email,
      password, // Pass the plain password, model's pre-save hook will hash it
      verificationToken
    });
    console.log('User created successfully:', user._id);

    // Try to send verification email, but don't fail registration if it fails
    try {
      console.log('Attempting to send verification email');
      await EmailService.sendVerificationEmail(email, verificationToken);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Don't return error - allow registration to continue
    }

    // Generate JWT token
    console.log('Generating JWT token');
    const token = generateToken(user._id);
    console.log('JWT token generated successfully');

    // Return user info and token
    console.log('Sending successful registration response');
    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      token
    });
  } catch (error: any) {
    console.error('Registration error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error during registration'
    });
  }
});

// Login user
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  try {
    console.log(`Attempting login for email: ${email}`);
    
    // Validate inputs
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Email and password are required'
      });
      return;
    }

    // Find user - explicitly include password field for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log(`Login failed: User with email ${email} not found`);
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
      return;
    }

    console.log(`User found, checking password (hash: ${user.password.substring(0, 10)}...)`);
    
    // Check password using bcrypt directly instead of the method
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match result: ${isMatch}`);
    
    if (!isMatch) {
      console.log(`Login failed: Invalid password for ${email}`);
      res.status(401).json({
        success: false,
        error: 'Authentication failed', 
        message: 'Invalid credentials'
      });
      return;
    }

    // Generate token
    const token = generateToken(user._id);
    console.log(`Login successful for ${email}, token generated`);

    // Return user info and token (excluding the password)
    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error during login'
    });
  }
});

// Verify email
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Verification token is required'
      });
      return;
    }
    
    // Find user with this verification token
    let user;
    try {
      user = await User.findOne({ verificationToken: token });
    } catch (dbError: any) {
      console.error('Database error during email verification:', dbError);
      if (dbError.name === 'MongoNetworkError') {
        res.status(503).json({
          success: false,
          error: 'Service unavailable',
          message: 'Unable to verify email at the moment. Please try again later.'
        });
        return;
      }
      throw dbError;
    }
    
    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Verification failed',
        message: 'Invalid or expired verification token'
      });
      return;
    }
    
    // Mark user as verified and clear the verification token
    user.isVerified = true;
    user.verificationToken = undefined;
    
    try {
      await user.save();
    } catch (saveError: any) {
      console.error('Error saving user verification status:', saveError);
      res.status(500).json({
        success: false,
        error: 'Server error',
        message: 'Failed to update verification status'
      });
      return;
    }
    
    // Send welcome email
    try {
      await EmailService.sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error during email verification'
    });
  }
});

// Request password reset
export const forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Email is required'
      });
      return;
    }

    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether user exists for security reasons
      res.status(200).json({
        success: true,
        message: 'If your email exists in our system, you will receive a password reset link'
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token before storing it (for better security)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      res.status(500).json({
        success: false,
        error: 'Email service error',
        message: 'Failed to send password reset email'
      });
      return;
    }

    res.json({
      success: true,
      message: 'If your email exists in our system, you will receive a password reset link'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error during password reset request'
    });
  }
});

// Reset password
export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Token and new password are required'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Hash the token from the URL to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user: IUser | null = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Reset failed',
        message: 'Invalid or expired reset token'
      });
      return;
    }

    // Set new password (hashing happens in the pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error during password reset'
    });
  }
});

// Get current user
export const getCurrentUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Not authorized'
      });
      return;
    }
    
    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error while retrieving user information'
    });
  }
});

// Resend verification email
export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Email is required'
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });

    // For security reasons, don't reveal if user exists
    if (!user) {
      res.status(200).json({
        success: true,
        message: 'If your email exists in our system, a verification email will be sent'
      });
      return;
    }

    // If user is already verified
    if (user.isVerified) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'This email is already verified'
      });
      return;
    }

    // Generate new verification token if not exists
    if (!user.verificationToken) {
      user.verificationToken = crypto.randomBytes(32).toString('hex');
      await user.save();
    }

    // Send verification email
    try {
      await EmailService.sendVerificationEmail(email, user.verificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      res.status(500).json({
        success: false,
        error: 'Email service error',
        message: 'Failed to send verification email'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'If your email exists in our system, a verification email will be sent'
    });
  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Server error during verification email resend'
    });
  }
}); 