'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function HeaderFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if user is in the dashboard area
  const isInDashboard = pathname?.startsWith('/dashboard');
  // Check if user is in auth pages
  const isInAuthPages = pathname === '/login' || 
                         pathname === '/register' || 
                         pathname === '/verification-required' || 
                         pathname?.startsWith('/reset-password') ||
                         pathname?.startsWith('/verify-email');
  
  // Only show the header on the main landing pages
  const showHeader = !isInDashboard && !isInAuthPages;

  return (
    <>
      {showHeader && (
        <header className="border-b border-gray-200">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
              <span className="font-bold text-xl">Aura Plus</span>
            </div>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm font-medium hover:text-blue-600">
                Home
              </Link>
              <Link href="/about" className="text-sm font-medium hover:text-blue-600">
                About
              </Link>
              <Link href="/login" className="text-sm font-medium hover:text-blue-600">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Sign Up
              </Link>
            </nav>
          </div>
        </header>
      )}
      
      {children}
      
      {!isInDashboard && !isInAuthPages && (
        <footer className="border-t border-gray-200 py-6 md:py-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-2 mb-4 md:mb-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
                <span className="font-bold">Aura Plus</span>
              </div>
              <div className="text-center md:text-right text-sm text-gray-500">
                <p>© 2024 Aura Plus. All rights reserved.</p>
                <p className="mt-1">Your AI therapy companion for better mental health.</p>
              </div>
            </div>
          </div>
        </footer>
      )}
    </>
  );
} 