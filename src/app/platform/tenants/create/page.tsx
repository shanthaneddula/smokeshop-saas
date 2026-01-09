'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SimplifiedTenantWizard from '@/components/platform/tenants/SimplifiedTenantWizard';

export default function CreateTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check if user is authenticated as platform admin
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/platform/dashboard');
        if (response.status === 401) {
          router.push('/platform/login');
          return;
        }
        setAuthorized(true);
      } catch {
        router.push('/platform/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-block px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 font-semibold mb-2">
                PLATFORM ADMIN
              </div>
              <h1 className="text-2xl font-bold">Create New Tenant</h1>
            </div>
            <button
              onClick={() => router.push('/platform/dashboard')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <SimplifiedTenantWizard />
      </main>
    </div>
  );
}
