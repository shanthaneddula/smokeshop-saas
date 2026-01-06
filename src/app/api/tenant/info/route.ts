import { NextResponse } from 'next/server';
import { getTenantInfo, requireTenantDb } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to verify middleware and tenant context
 * GET /api/tenant/info
 */
export async function GET() {
  try {
    // Get tenant info from headers
    const tenantInfo = await getTenantInfo();
    
    if (!tenantInfo) {
      return NextResponse.json(
        { error: 'Tenant context not available' },
        { status: 400 }
      );
    }

    // Get tenant database connection
    const db = await requireTenantDb();

    // Query tenant data
    const [userCount, storeCount, productCount] = await Promise.all([
      db.user.count(),
      db.store.count(),
      db.product.count(),
    ]);

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenantInfo.id,
        name: tenantInfo.name,
        slug: tenantInfo.slug,
        domain: tenantInfo.domain,
      },
      database: {
        users: userCount,
        stores: storeCount,
        products: productCount,
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
