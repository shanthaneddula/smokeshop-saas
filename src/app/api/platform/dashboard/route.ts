import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { masterDb } from '@/lib/db/master-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Platform Dashboard API
 * Returns stats and tenant list for platform admins
 */
export async function GET(request: NextRequest) {
  try {
    // Verify platform admin authentication
    const token = request.cookies.get('platform-auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      if (decoded.type !== 'platform_admin') {
        return NextResponse.json(
          { error: 'Not a platform admin' },
          { status: 403 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Get all tenants
    const tenants = await masterDb.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        status: true,
        plan: true,
        ownerEmail: true,
        ownerName: true,
        createdAt: true,
      },
    });
    
    // Calculate stats
    const stats = {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.status === 'active').length,
      trialTenants: tenants.filter(t => t.status === 'trial').length,
      suspendedTenants: tenants.filter(t => t.status === 'suspended').length,
    };
    
    return NextResponse.json({
      stats,
      tenants,
    });
  } catch (error) {
    console.error('[PlatformDashboard] Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
