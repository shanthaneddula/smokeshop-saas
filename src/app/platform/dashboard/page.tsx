'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  status: string;
  plan: string;
  ownerEmail: string;
  createdAt: string;
}

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
}

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/platform/dashboard');
      
      if (response.status === 401) {
        router.push('/platform/login');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to load dashboard');
      }
      
      const data = await response.json();
      setStats(data.stats);
      setTenants(data.tenants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/platform/auth/logout', { method: 'POST' });
    router.push('/platform/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading platform dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10 border-green-400/30',
    trial: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    suspended: 'text-red-400 bg-red-400/10 border-red-400/30',
  };

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
              <h1 className="text-2xl font-bold">SmokeShop SaaS</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/platform/tenants/create')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
              >
                + New Tenant
              </button>
              <button
                onClick={() => router.push('/platform/products')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold"
              >
                📦 Products
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">Total Tenants</div>
            <div className="text-3xl font-bold">{stats?.totalTenants || 0}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">Active</div>
            <div className="text-3xl font-bold text-green-400">{stats?.activeTenants || 0}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">Trial</div>
            <div className="text-3xl font-bold text-blue-400">{stats?.trialTenants || 0}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">Suspended</div>
            <div className="text-3xl font-bold text-red-400">{stats?.suspendedTenants || 0}</div>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">All Tenants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-sm text-gray-400">{tenant.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {tenant.customDomain || (
                        <span className="text-gray-500 italic">No domain</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded border ${
                          statusColors[tenant.status] || 'text-gray-400 bg-gray-400/10 border-gray-400/30'
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                      {tenant.plan}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {tenant.ownerEmail}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
