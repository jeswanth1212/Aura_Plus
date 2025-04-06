import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // Allow all requests without any authentication check
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