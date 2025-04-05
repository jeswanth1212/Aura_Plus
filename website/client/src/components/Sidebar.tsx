'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  History, 
  Brain, 
  Mic, 
  LogOut,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
    },
    {
      name: 'Begin Session',
      href: '/dashboard/session',
      icon: MessageSquare,
    },
    {
      name: 'Session History',
      href: '/dashboard/history',
      icon: History,
    },
    {
      name: 'Session Analysis',
      href: '/dashboard/analysis',
      icon: Brain,
    },
    {
      name: 'Voice Clone',
      href: '/dashboard/voice',
      icon: Mic,
    },
  ];

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 hidden md:block">
      <div className="flex flex-col h-full px-2 py-4">
        <div className="px-4 mb-8">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 mr-2"></div>
            <h1 className="text-xl font-bold">Aura Plus</h1>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm rounded-md ${
                  isActive
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <LogOut className="h-5 w-5 text-gray-500 mr-3" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
} 