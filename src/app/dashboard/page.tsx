'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute requireOrg={false}>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                Welcome, {user?.name}
              </span>
              <Button variant="outline" onClick={logout}>
                Log Out
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Account Info</CardTitle>
                <CardDescription>Your user details</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-slate-900">Name</dt>
                    <dd className="text-slate-600">{user?.name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Email</dt>
                    <dd className="text-slate-600">{user?.email}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Role</dt>
                    <dd className="text-slate-600">{user?.role || 'Not assigned'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
                <CardDescription>Your business details</CardDescription>
              </CardHeader>
              <CardContent>
                {user?.organizationId ? (
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="font-medium text-slate-900">Organization ID</dt>
                      <dd className="text-slate-600 truncate">{user.organizationId}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">Slug</dt>
                      <dd className="text-slate-600">{user.organizationSlug}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="text-sm text-slate-600">
                    <p className="mb-4">You haven't set up an organization yet.</p>
                    <Button>Set Up Organization</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>What would you like to do?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/dashboard/products')}
                >
                  📦 View Products
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  📋 Manage Orders
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  💰 Open POS
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>🎉 Multi-Tenant Product Management Ready!</CardTitle>
              <CardDescription>Tenant isolation & product catalog integration complete</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Your smoke shop platform is ready with:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 list-disc list-inside">
                <li>✅ Complete database isolation per tenant</li>
                <li>✅ Master product catalog (MongoDB)</li>
                <li>✅ Tenant inventory management</li>
                <li>✅ Search catalog & add products</li>
                <li>✅ Image uploads (Vercel Blob)</li>
                <li>✅ Connection pooling</li>
                <li>✅ Platform admin system</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => router.push('/dashboard/products')}>
                  Get Started with Products
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
