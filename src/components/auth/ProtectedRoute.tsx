'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrg?: boolean; // Require user to have an organization
}

export default function ProtectedRoute({ children, requireOrg = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not authenticated - redirect to login
        router.push('/login');
      } else if (requireOrg && !user.organizationId) {
        // Authenticated but no organization - redirect to org registration
        router.push('/register-org');
      }
    }
  }, [user, loading, requireOrg, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!user || (requireOrg && !user.organizationId)) {
    return null;
  }

  return <>{children}</>;
}
