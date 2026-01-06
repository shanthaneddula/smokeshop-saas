'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
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
                <Button variant="outline" className="w-full justify-start">
                  View Products
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Manage Orders
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Open POS
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>🎉 Authentication System Complete!</CardTitle>
              <CardDescription>Phase 1 is done</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                You've successfully logged in! The authentication system is working with:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 list-disc list-inside">
                <li>JWT token-based authentication</li>
                <li>Secure httpOnly cookies</li>
                <li>Password hashing with bcrypt</li>
                <li>Protected routes</li>
                <li>Session management</li>
                <li>Login/Register pages</li>
                <li>Auth context provider</li>
              </ul>
              <p className="mt-4 text-sm font-medium text-slate-900">
                Next up: Tenant isolation middleware and organization registration!
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
