import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import mongoose from 'mongoose';

interface JwtPayload {
  id: mongoose.Types.ObjectId | string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
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
          success: false,
          error: 'Not authorized', 
          message: 'No token provided in Authorization header' 
        });
      }

      // Get JWT secret from environment
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ 
          success: false,
          error: 'Server configuration error', 
          message: 'JWT configuration error' 
        });
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

        // Check for valid id
        if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
          return res.status(401).json({ 
            success: false,
            error: 'Not authorized', 
            message: 'Invalid token payload' 
          });
        }

        // Get user from database
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          return res.status(401).json({ 
            success: false,
            error: 'Not authorized', 
            message: 'User not found' 
          });
        }

        // Attach user to request
        req.user = user;
        next();
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            success: false,
            error: 'Not authorized', 
            message: 'Token expired' 
          });
        }
        
        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            success: false,
            error: 'Not authorized', 
            message: 'Invalid token' 
          });
        }
        
        console.error('JWT verification error:', jwtError);
        return res.status(401).json({ 
          success: false,
          error: 'Not authorized', 
          message: 'Token verification failed' 
        });
      }
    } else {
      return res.status(401).json({ 
        success: false,
        error: 'Not authorized', 
        message: 'Authorization header missing or invalid format' 
      });
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Server error', 
      message: 'Error processing authentication' 
    });
  }
};

/**
 * Middleware to check if user's email is verified
 */
export const requireVerified = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      error: 'Not authorized', 
      message: 'Authentication required' 
    });
  }
  
  if (!req.user.isVerified) {
    return res.status(403).json({ 
      success: false,
      error: 'Access denied', 
      message: 'Email verification required',
      requiresVerification: true
    });
  }
  
  next();
};

/**
 * Optional middleware to check authentication without requiring it
 * Attaches user to request if token is valid, but doesn't block the request if not
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // Check for Authorization header with Bearer token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      if (token) {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
          // Verify token
          const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
          
          // Check for valid id and attach user if found
          if (decoded.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
              req.user = user;
            }
          }
        }
      }
    } catch (error) {
      // Don't throw errors in optional auth - just don't attach the user
      console.debug('Optional auth error:', error);
    }
  }
  
  next();
}; 