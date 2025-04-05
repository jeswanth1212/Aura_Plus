'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, Mic, BarChart2, History, Menu, X, Settings, LogOut } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <span className="text-lg font-bold text-purple-700">Aura Plus</span>
          <button 
            className="p-2 rounded-md lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto h-full">
          <nav className="px-4 pt-4">
            <div className="space-y-1">
              <Link
                href="/dashboard"
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/dashboard') 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home className="mr-3 h-5 w-5" />
                Therapy Session
              </Link>
              <Link
                href="/dashboard/voice-clone"
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/dashboard/voice-clone') 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Mic className="mr-3 h-5 w-5" />
                Voice Clone
              </Link>
              <Link
                href="/dashboard/analysis"
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/dashboard/analysis') 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BarChart2 className="mr-3 h-5 w-5" />
                Voice Analysis
              </Link>
              <Link
                href="/dashboard/history"
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/dashboard/history') 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <History className="mr-3 h-5 w-5" />
                Session History
              </Link>
            </div>
            
            <div className="mt-10 pt-6 border-t">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Account
              </div>
              <button
                className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100"
                onClick={() => router.push('/settings')}
              >
                <Settings className="mr-3 h-5 w-5" />
                Settings
              </button>
              <button 
                className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100"
                onClick={() => router.push('/')}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </button>
            </div>
            </nav>
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="bg-white shadow-sm lg:hidden">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <button
              className="p-2 rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-lg font-bold text-purple-700">Aura Plus</span>
            <div className="w-8">
              {/* Spacer for centering */}
            </div>
          </div>
      </header>
      
        <main className="flex-1 overflow-auto">
        {children}
      </main>
        </div>
    </div>
  );
} 