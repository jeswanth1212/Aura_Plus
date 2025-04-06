'use client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Simply render children without any authentication checks
  return <>{children}</>;
} 