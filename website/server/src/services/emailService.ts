import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables to ensure they're available
dotenv.config();

// Cached transporter instance
let cachedTransporter: Transporter | null = null;

// Configure email transport with fallback options
const createTransporter = (): Transporter => {
  // Return cached transporter if available
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Check if required email credentials are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('Email credentials not configured properly. Check .env file');
    
    if (process.env.NODE_ENV === 'development') {
      // In development, create a test account with Ethereal
      console.log('Creating test email account for development...');
      throw new Error('Test account creation requires async operation, use getTransporter() instead');
    } else {
      throw new Error('Email service not configured');
    }
  }
  
  // Create production transporter
  const transportOptions = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 465,
    secure: process.env.EMAIL_SECURE !== 'false', // default to true if not explicitly set to false
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    debug: process.env.NODE_ENV === 'development'
  };
  
  cachedTransporter = nodemailer.createTransport(transportOptions);
  return cachedTransporter;
};

// Create a test email account for development
const createTestTransporter = async (): Promise<Transporter> => {
  try {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();
    console.log('Created test email account:', testAccount.user);
    
    // Create a testing transporter
    const testTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    cachedTransporter = testTransporter;
    return testTransporter;
  } catch (error) {
    console.error('Failed to create test email account:', error);
    throw new Error('Could not set up email testing environment');
  }
};

export class EmailService {
  /**
   * Validates email service connection
   */
  static async validateConnection(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      console.log('Email service connection verified successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
  
  /**
   * Get transporter with automatic fallback to test account in development
   */
  private static async getTransporter(): Promise<Transporter> {
    // Return cached transporter if available
    if (cachedTransporter) {
      return cachedTransporter;
    }
  
    // Check if we need to create a test account
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Email credentials not configured, creating test account');
        return await createTestTransporter();
      } else {
        throw new Error('Email service not configured');
      }
    }
    
    try {
      return createTransporter();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Falling back to test email account');
        return await createTestTransporter();
      }
      throw error;
    }
  }
  
  /**
   * Get client URL from environment or use default
   */
  private static getClientUrl(): string {
    return process.env.CLIENT_URL || 'http://localhost:3000';
  }
  
  /**
   * Send a verification email to a user
   */
  static async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      const clientUrl = this.getClientUrl();
      
      // Create verification URL
      const verificationUrl = `${clientUrl}/verify-email?token=${token}`;
      
      // Send the email
      const info = await transporter.sendMail({
        from: `"Aura Plus" <${process.env.EMAIL_USER || 'noreply@auraplus.ai'}>`,
        to: email,
        subject: 'Verify Your Email - Aura Plus',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #9333ea); margin: 0 auto;"></div>
              <h2 style="color: #333; margin-top: 10px;">Aura Plus</h2>
            </div>
            
            <h3 style="color: #333;">Verify Your Email Address</h3>
            
            <p style="color: #555; line-height: 1.5;">
              Thank you for signing up with Aura Plus! To complete your registration and access all features, please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #9333ea); color: white; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold;">
                Verify Email
              </a>
            </div>
            
            <p style="color: #555; line-height: 1.5;">
              If the button doesn't work, you can also copy and paste the following link into your browser:
            </p>
            
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
              <a href="${verificationUrl}" style="color: #4f46e5;">${verificationUrl}</a>
            </p>
            
            <p style="color: #555; line-height: 1.5;">
              If you didn't create an account with Aura Plus, please ignore this email.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px;">
              <p>Aura Plus - Your AI Therapy Companion</p>
            </div>
          </div>
        `
      });
      
      // Log preview URL in development mode
      if (process.env.NODE_ENV === 'development' && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('Email preview URL:', previewUrl);
        }
      }
      
      console.log('Verification email sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  /**
   * Send a password reset email to a user
   */
  static async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      const clientUrl = this.getClientUrl();
      
      // Create reset URL
      const resetUrl = `${clientUrl}/reset-password?token=${token}`;
      
      const info = await transporter.sendMail({
        from: `"Aura Plus" <${process.env.EMAIL_USER || 'noreply@auraplus.ai'}>`,
        to: email,
        subject: 'Reset Your Password - Aura Plus',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Aura Plus</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <h2>Reset Your Password</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Reset Password
                </a>
              </div>
              <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
              <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
              <p>This password reset link will expire in 1 hour.</p>
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
              <p>&copy; 2024 Aura Plus. All rights reserved.</p>
            </div>
          </div>
        `,
      });

      // Log preview URL in development mode
      if (process.env.NODE_ENV === 'development' && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('Email preview URL:', previewUrl);
        }
      }
      
      console.log(`Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }
  
  /**
   * Send a welcome email to a newly verified user
   */
  static async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      const clientUrl = this.getClientUrl();
      
      const info = await transporter.sendMail({
        from: `"Aura Plus" <${process.env.EMAIL_USER || 'noreply@auraplus.ai'}>`,
        to: email,
        subject: 'Welcome to Aura Plus!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #9333ea); margin: 0 auto;"></div>
              <h2 style="color: #333; margin-top: 10px;">Aura Plus</h2>
            </div>
            
            <h3 style="color: #333;">Welcome to Aura Plus, ${name}!</h3>
            
            <p style="color: #555; line-height: 1.5;">
              Thank you for joining Aura Plus. Your account has been fully activated, and you can now access all features of our AI therapy platform.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${clientUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #9333ea); color: white; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #555; line-height: 1.5;">
              Here are some things you can do with Aura Plus:
            </p>
            
            <ul style="color: #555; line-height: 1.5;">
              <li>Start an AI therapy session</li>
              <li>Track your mental health progress</li>
              <li>Set up voice cloning for more personal interactions</li>
              <li>Review your previous therapy sessions</li>
            </ul>
            
            <p style="color: #555; line-height: 1.5;">
              If you have any questions or need assistance, please don't hesitate to contact our support team.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px;">
              <p>Aura Plus - Your AI Therapy Companion</p>
            </div>
          </div>
        `,
      });
      
      // Log preview URL in development mode
      if (process.env.NODE_ENV === 'development' && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('Email preview URL:', previewUrl);
        }
      }
      
      console.log(`Welcome email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }
} 