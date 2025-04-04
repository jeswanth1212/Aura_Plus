'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { User, MessageSquare, History, LogOut } from 'lucide-react';
import { useAuth, useAuthProtection } from '@/hooks/useAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  // Use auth protection hook for redirection
  useAuthProtection();
  
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // If still loading auth, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center py-3 px-4">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Aura Plus</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <NavLink href="/dashboard" icon={<MessageSquare className="w-5 h-5" />} text="New Session" isActive={pathname === '/dashboard'} />
            <NavLink href="/dashboard/history" icon={<History className="w-5 h-5" />} text="History" isActive={pathname.includes('/history')} />
            <button 
              onClick={logout}
              className="flex items-center text-gray-600 hover:text-blue-600"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span>Log Out</span>
            </button>
          </nav>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={toggleMobileMenu}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 py-2 px-4">
            <nav className="flex flex-col space-y-3">
              <MobileNavLink href="/dashboard" icon={<MessageSquare className="w-5 h-5" />} text="New Session" isActive={pathname === '/dashboard'} onClick={() => setIsMobileMenuOpen(false)} />
              <MobileNavLink href="/dashboard/history" icon={<History className="w-5 h-5" />} text="History" isActive={pathname.includes('/history')} onClick={() => setIsMobileMenuOpen(false)} />
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center text-gray-600 hover:text-blue-600 py-2"
              >
                <LogOut className="w-5 h-5 mr-3" />
                <span>Log Out</span>
              </button>
            </nav>
          </div>
        )}
      </header>
      
      {/* Main Content */}
      <main className="flex-1 container mx-auto py-6 px-4">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="container mx-auto text-center text-gray-500 text-sm px-4">
          <p>© {new Date().getFullYear()} Aura Plus. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Desktop Navigation Link Component
function NavLink({ href, icon, text, isActive }: { href: string; icon: React.ReactNode; text: string; isActive: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center ${isActive ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
    >
      {icon}
      <span className="ml-2">{text}</span>
    </Link>
  );
}

// Mobile Navigation Link Component
function MobileNavLink({ href, icon, text, isActive, onClick }: { href: string; icon: React.ReactNode; text: string; isActive: boolean; onClick: () => void }) {
  return (
    <Link 
      href={href}
      className={`flex items-center py-2 ${isActive ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
      onClick={onClick}
    >
      <span className="mr-3">{icon}</span>
      <span>{text}</span>
    </Link>
  );
} 