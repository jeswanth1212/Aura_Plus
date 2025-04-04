'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { formatDate, formatTime, truncateText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Clock, MessageSquare } from 'lucide-react';

export default function HistoryPage() {
  const { sessionHistory, fetchSessionHistory, error } = useSession();

  useEffect(() => {
    fetchSessionHistory();
  }, [fetchSessionHistory]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-destructive">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchSessionHistory}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!sessionHistory.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">No Sessions Yet</h2>
          <p className="text-muted-foreground">
            Start your first therapy session to begin your journey
          </p>
          <Link href="/dashboard">
            <Button>Start Session</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Session History</h1>
        <p className="text-muted-foreground mt-2">
          Review your past therapy sessions and track your progress
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sessionHistory.map((session) => (
          <div key={session._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm text-gray-500">
                {formatDate(session.startTime)} at {formatTime(session.startTime)}
              </div>
              <Link href={`/dashboard/session/${session._id}`} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                View Details
              </Link>
            </div>
            <div className="mb-3">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <MessageSquare className="w-3 h-3 mr-1" />
                <span>{session.messages?.length || 0} messages</span>
              </div>
            </div>
            {session.summary ? (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Summary:</div>
                <p className="text-sm text-gray-700">{truncateText(session.summary, 120)}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No summary available</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 