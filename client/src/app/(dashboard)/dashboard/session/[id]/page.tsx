'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { formatDate, formatTime } from '@/lib/utils';
import { ArrowLeft, Clock, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function SessionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { fetchSession, error, isLoading } = useSession();
  const [session, setSession] = useState<any>(null);
  
  useEffect(() => {
    const getSession = async () => {
      if (params.id) {
        const sessionData = await fetchSession(params.id as string);
        if (sessionData) {
          setSession(sessionData);
        }
      }
    };
    
    getSession();
  }, [params.id, fetchSession]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-pulse flex space-x-4">
          <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
          <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
          <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-10">
          <h2 className="text-xl font-semibold text-red-500 mb-2">Error Loading Session</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.back()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-10">
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-gray-600 mb-4">The session you're looking for doesn't exist or has been removed.</p>
          <Link 
            href="/dashboard/history" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md inline-block"
          >
            Back to History
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link 
          href="/dashboard/history" 
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back to History</span>
        </Link>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Session Details</h1>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-1" />
          <span>{formatDate(session.startTime)} at {formatTime(session.startTime)}</span>
        </div>
      </div>
      
      {session.summary && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">Session Summary</h2>
          <p className="text-gray-700">{session.summary}</p>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversation</h2>
          <div className="flex items-center text-sm text-gray-500">
            <MessageSquare className="w-4 h-4 mr-1" />
            <span>{session.messages?.length || 0} messages</span>
          </div>
        </div>
        
        <div className="space-y-4">
          {session.messages?.map((message: any, index: number) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg p-3 ${
                  message.sender === 'user'
                    ? 'bg-blue-50 text-gray-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="mb-1 text-xs text-gray-500">
                  {message.sender === 'user' ? 'You' : 'Aura AI'} • {new Date(message.timestamp).toLocaleTimeString()}
                </div>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          
          {(!session.messages || session.messages.length === 0) && (
            <div className="text-center py-6 text-gray-500">
              No messages in this session
            </div>
          )}
        </div>
      </div>
      
      {session.endTime ? (
        <div className="text-center text-sm text-gray-500">
          Session ended on {formatDate(session.endTime)} at {formatTime(session.endTime)}
        </div>
      ) : (
        <div className="text-center">
          <Link
            href="/dashboard/session"
            className="px-4 py-2 bg-blue-600 text-white rounded-md inline-block"
          >
            Continue Session
          </Link>
        </div>
      )}
    </div>
  );
} 