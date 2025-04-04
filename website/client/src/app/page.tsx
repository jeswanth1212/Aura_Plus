import Link from 'next/link';
import { ArrowRight, Brain, MessageSquare, History, Mic } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center bg-gradient-to-b from-white to-blue-50">
        <div className="ai-orb mb-8"></div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Meet <span className="text-blue-600">Aura Plus</span>
        </h1>
        <p className="mt-4 text-xl md:text-2xl text-gray-600 max-w-3xl">
          Your AI-powered therapy companion for mental wellness and personal growth.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-white shadow-sm hover:bg-blue-700 transition-colors">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link 
            href="/about" 
            className="inline-flex items-center justify-center rounded-md bg-white border border-gray-300 px-6 py-3 shadow-sm hover:bg-gray-100 transition-colors">
            Learn More
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How Aura Plus Helps You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="dashboard-card flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-medium mb-2">Interactive Sessions</h3>
              <p className="text-gray-600">
                Have natural conversations with an AI that understands your needs and responds with empathy.
              </p>
            </div>

            <div className="dashboard-card flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Mic className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-medium mb-2">Voice Enabled</h3>
              <p className="text-gray-600">
                Speak naturally with advanced voice recognition and lifelike AI responses.
              </p>
            </div>

            <div className="dashboard-card flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <History className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-medium mb-2">Progress Tracking</h3>
              <p className="text-gray-600">
                Review past sessions and track your mental health journey over time.
              </p>
            </div>

            <div className="dashboard-card flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-medium mb-2">Mental Health Insights</h3>
              <p className="text-gray-600">
                Gain valuable insights into your thinking patterns and emotional responses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Begin Your Wellness Journey Today</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Take the first step toward a healthier mindset with AI-guided therapy that's available anytime, anywhere.
          </p>
          <Link 
            href="/register" 
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-8 py-3 text-lg text-white shadow-md hover:bg-blue-700 transition-colors">
            Create Your Account
          </Link>
        </div>
      </section>
    </main>
  );
}
