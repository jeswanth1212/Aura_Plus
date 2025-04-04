'use client';

import Link from 'next/link';
import { MessageSquare, History, Brain, Mic } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/dashboard/session"
            className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">Begin Therapy Session</h3>
              <p className="text-gray-500 mb-4">
                Start a new conversation with your AI therapist.
              </p>
              <span className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium">
                Start Now
              </span>
            </div>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Your Journey</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                <History className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-1">Session History</h3>
                <p className="text-gray-500 text-sm mb-3">
                  Review your previous therapy conversations.
                </p>
                <Link
                  href="/dashboard/history"
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  View History
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-1">Session Analysis</h3>
                <p className="text-gray-500 text-sm mb-3">
                  Gain insights from your therapy journey.
                </p>
                <Link
                  href="/dashboard/analysis"
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  View Analysis
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-4">
                <Mic className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-1">Voice Cloning</h3>
                <p className="text-gray-500 text-sm mb-3">
                  Customize your AI therapist's voice.
                </p>
                <Link
                  href="/dashboard/voice"
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  Manage Voice
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 