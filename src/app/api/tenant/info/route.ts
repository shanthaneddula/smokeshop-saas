import { NextRequest, NextResponse } from 'next/server';
import { getTenantInfo, requireTenantDb } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to verify middleware and tenant context
 * GET /api/tenant/info
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant info from headers
    const tenantInfo = await getTenantInfo(request);
    
    if (!tenantInfo) {
      return NextResponse.json(
        { error: 'Tenant context not available' },
        { status: 400 }
      );
    }

    // Get tenant database connection
    const db = await requireTenantDb(tenantInfo);

    // Query tenant data (products stored in MongoDB, not PostgreSQL)
    const [userCount, storeCount] = await Promise.all([
      db.user.count(),
      db.store.count(),
    ]);

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenantInfo.id,
        name: tenantInfo.name,
        slug: tenantInfo.slug,
        customDomain: tenantInfo.customDomain,
      },
      database: {
        users: userCount,
        stores: storeCount,
      },
      message: 'Tenant context working! 🎉',
    });

  } catch (error) {
    console.error('[API] Tenant info error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get tenant info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
