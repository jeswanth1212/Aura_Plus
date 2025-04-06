'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Heart, MessageSquare, Brain } from 'lucide-react';
import { useEffect } from 'react';

export default function LandingPage() {
  const router = useRouter();
  
  // Function to clear auth cookies
  const clearAuthCookies = () => {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  useEffect(() => {
    // Clear cookies when landing page loads
    clearAuthCookies();
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Your AI Therapy Companion
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Experience meaningful conversations with Aura Plus, your personal AI therapist designed to help you navigate life's challenges.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/register"
                  onClick={clearAuthCookies}
                  className="bg-purple-600 text-white px-8 py-4 rounded-md text-lg font-medium hover:bg-purple-700 flex items-center justify-center"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
                <a
                  href="/login"
                  onClick={clearAuthCookies}
                  className="bg-white text-purple-600 border border-purple-600 px-8 py-4 rounded-md text-lg font-medium hover:bg-gray-50 flex items-center justify-center"
                >
                  Login
                </a>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="aspect-w-5 aspect-h-4 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-8">
                <div className="text-white text-center">
                  <div className="flex justify-center space-x-6 mb-6">
                    <Heart className="h-16 w-16" />
                    <MessageSquare className="h-16 w-16" />
                    <Brain className="h-16 w-16" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-2">Aura Plus</h3>
                  <p className="text-lg opacity-80">AI-Powered Therapy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Features */}
        <div className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">How Aura Plus Works</h2>
              <p className="mt-4 text-xl text-gray-600">Simple, intuitive, and private therapy sessions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="bg-purple-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Voice Conversations</h3>
                <p className="text-gray-600">Speak naturally and hear responses from your AI therapist through high-quality voice synthesis.</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="bg-purple-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">AI Understanding</h3>
                <p className="text-gray-600">Powered by advanced AI to comprehend context, emotions, and provide meaningful therapeutic responses.</p>
            </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="bg-purple-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <Heart className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Personal Support</h3>
                <p className="text-gray-600">Get personalized support and guidance whenever you need it, completely private and secure.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2024 Aura Plus. All rights reserved.</p>
            <p className="mt-2">AI-powered therapy companion for your mental wellbeing.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
