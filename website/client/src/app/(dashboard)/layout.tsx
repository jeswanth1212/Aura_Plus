'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, Mic, BarChart2, History, Settings, LogOut } from 'lucide-react';

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
    <div className="flex h-screen bg-white">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-30 w-48 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col justify-between h-full py-6">
          <nav className="px-4 space-y-2">
            <Link
              href="/dashboard"
              className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
            >
              <Home className="h-5 w-5" />
              home
            </Link>
            <Link
              href="/dashboard/voice-clone"
              className={`nav-link ${isActive('/dashboard/voice-clone') ? 'active' : ''}`}
            >
              <Mic className="h-5 w-5" />
              voice clone
            </Link>
            <Link
              href="/dashboard/analysis"
              className={`nav-link ${isActive('/dashboard/analysis') ? 'active' : ''}`}
            >
              <BarChart2 className="h-5 w-5" />
              analysis
            </Link>
            <Link
              href="/dashboard/history"
              className={`nav-link ${isActive('/dashboard/history') ? 'active' : ''}`}
            >
              <History className="h-5 w-5" />
              session history
            </Link>
          </nav>
          
          <div className="px-4 space-y-2">
            <Link
              href="/settings"
              className="nav-link"
            >
              <Settings className="h-5 w-5" />
              settings
            </Link>
            <button 
              className="nav-link w-full text-left"
              onClick={() => router.push('/')}
            >
              <LogOut className="h-5 w-5" />
              log out
            </button>
          </div>
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
} 