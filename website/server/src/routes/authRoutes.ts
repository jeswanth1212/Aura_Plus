import express from 'express';
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword
} from '../controllers/authController';

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Add verify email route
router.get('/verify-email/:token', verifyEmail);

export default router; 