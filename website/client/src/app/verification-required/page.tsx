'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import axios from 'axios';

export default function VerificationRequiredPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState<string>('');

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // If user is verified, redirect to dashboard
    if (user?.isVerified) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleResendVerification = async () => {
    if (!user?.email || resendStatus === 'loading') {
      return;
    }

    setResendStatus('loading');
    setResendMessage('');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
      const response = await axios.post(`${API_URL}/api/auth/resend-verification`, {
        email: user.email
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
            We've sent a verification link to your email address {user?.email}.
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
              <p className="text-sm text-gray-500">
                Didn't receive the email?
              </p>
              <button 
                className={`mt-2 text-sm font-medium ${
                  resendStatus === 'loading' 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-blue-600 hover:text-blue-500'
                }`}
                onClick={handleResendVerification}
                disabled={resendStatus === 'loading'}
              >
                {resendStatus === 'loading' 
                  ? 'Sending...' 
                  : 'Click here to resend'}
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