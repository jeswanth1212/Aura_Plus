import nodemailer from 'nodemailer';

// Configure email transport
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Additional Gmail-specific settings
    secure: true,
    port: 465,
    debug: process.env.NODE_ENV === 'development',
  });
};

export class EmailService {
  /**
   * Send a verification email to a user
   */
  static async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    try {
      const transporter = createTransporter();
      
      // Check connection first
      await transporter.verify();
      console.log('SMTP connection verified');
      
      // Get client URL from env or use default
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      
      // Create verification URL
      const verificationUrl = `${clientUrl}/verify-email?token=${token}`;
      
      // Send the email
      const info = await transporter.sendMail({
        from: `"Aura Plus" <${process.env.EMAIL_USER}>`,
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
  static async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const transporter = createTransporter();
    
    // Check connection first
    try {
      await transporter.verify();
      console.log('SMTP connection verified for password reset email');
    } catch (error) {
      console.error('SMTP connection failed:', error);
      throw new Error('Failed to connect to email server');
    }
    
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"Aura Plus" <${process.env.EMAIL_USER}>`,
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
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }
} 