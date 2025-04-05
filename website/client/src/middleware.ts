import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // Define public paths that don't require auth
  const isPublicPath = 
    path === '/login' || 
    path === '/register' || 
    path === '/' || 
    path.startsWith('/verify-email') || 
    path.startsWith('/verification-required');
  
  // Get the token from cookies if it exists
  const token = request.cookies.get('token')?.value || '';
  
  // Always allow access to public paths regardless of auth status
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // If user is trying to access a protected path without being logged in, redirect to login
  if (!token) {
    // Store the original URL to redirect back after login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

// Define which paths this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     * - api routes (api endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
}; 