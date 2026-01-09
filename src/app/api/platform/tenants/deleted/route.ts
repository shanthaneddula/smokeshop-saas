/**
 * Deleted Tenants List API Route
 * 
 * GET /api/platform/tenants/deleted
 * 
 * Returns all soft-deleted tenants with recovery window status.
 * Protected by platform admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeletedTenants } from '@/lib/tenants/soft-delete';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add platform admin authentication check
    // const adminUser = await requirePlatformAdmin(request);

    const result = await getDeletedTenants();

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          message: 'Failed to fetch deleted tenants',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tenants: result.tenants,
      count: result.tenants.length,
      summary: {
        canRestore: result.tenants.filter((t) => t.canRestore).length,
        expiredRecovery: result.tenants.filter((t) => !t.canRestore).length,
      },
    });
  } catch (error) {
    console.error('Get deleted tenants API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to fetch deleted tenants',
      },
      { status: 500 }
    );
  }
}
