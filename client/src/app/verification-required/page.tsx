'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import axios from 'axios';

export default function VerificationRequiredPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState<string>('');

  useEffect(() => {
    // If user is authenticated and verified, redirect to dashboard
    if (!isLoading && isAuthenticated && user?.isVerified) {
      router.push('/dashboard');
    }
    
    // If user is authenticated, pre-fill the email
    if (user?.email) {
      setEmail(user.email);
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleResendVerification = async () => {
    // Check if we have an email to work with
    const emailToUse = email || user?.email;
    
    if (!emailToUse || resendStatus === 'loading') {
      setResendStatus('error');
      setResendMessage('Please enter a valid email address');
      return;
    }

    setResendStatus('loading');
    setResendMessage('');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
      const response = await axios.post(`${API_URL}/auth/resend-verification`, {
        email: emailToUse
      });

      setResendStatus('success');
      setResendMessage('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('Failed to resend verification email:', error);
      setResendStatus('error');
      
      const errorMessage = error.response?.data?.message || 
        'Failed to send verification email. Please try again later.';
      setResendMessage(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Email Verification Required
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {user?.email 
              ? `We've sent a verification link to ${user.email}.` 
              : 'You need to verify your email address to continue.'}
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="space-y-4">
            <p className="text-gray-700">
              Please check your inbox and click the verification link to activate your account.
            </p>

            <p className="text-gray-700">
              If you don't see the email, please check your spam folder.
            </p>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-500 mb-2">
                Didn't receive the email?
              </p>
              
              {!user?.email && (
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Your email address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              )}
              
              <button 
                className={`mt-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                  resendStatus === 'loading' 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                onClick={handleResendVerification}
                disabled={resendStatus === 'loading'}
              >
                {resendStatus === 'loading' 
                  ? 'Sending...' 
                  : 'Resend verification email'}
              </button>
              
              {resendMessage && (
                <p className={`mt-2 text-sm ${
                  resendStatus === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {resendMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Return to login
          </Link>
        </div>
      </div>
    </div>
  );
} 