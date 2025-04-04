import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import mongoose from 'mongoose';

interface JwtPayload {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Authentication middleware to protect routes
 * Verifies the JWT token and attaches the user to the request
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  try {
    // Check for Authorization header with Bearer token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Check if token exists
      if (!token) {
        return res.status(401).json({ 
          error: 'Not authorized', 
          details: 'No token provided in Authorization header' 
        });
      }

      // Get JWT secret from environment
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ 
          error: 'Server configuration error', 
          details: 'JWT_SECRET missing' 
        });
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

        // Check for valid userId
        if (!decoded.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
          return res.status(401).json({ 
            error: 'Not authorized', 
            details: 'Invalid token payload' 
          });
        }

        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
          return res.status(401).json({ 
            error: 'Not authorized', 
            details: 'User not found' 
          });
        }

        // Attach user to request
        req.user = user;
        next();
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: 'Not authorized', 
            details: 'Token expired' 
          });
        }
        
        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            error: 'Not authorized', 
            details: 'Invalid token' 
          });
        }
        
        console.error('JWT verification error:', jwtError);
        return res.status(401).json({ 
          error: 'Not authorized', 
          details: 'Token verification failed' 
        });
      }
    } else {
      return res.status(401).json({ 
        error: 'Not authorized', 
        details: 'Authorization header missing or invalid format' 
      });
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      details: 'Error processing authentication' 
    });
  }
};

/**
 * Middleware to check if user's email is verified
 */
export const isVerified = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Not authorized', 
      details: 'Authentication required' 
    });
  }
  
  if (!req.user.isVerified) {
    return res.status(403).json({ 
      error: 'Access denied', 
      details: 'Email verification required' 
    });
  }
  
  next();
}; 