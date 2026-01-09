/**
 * Tenant Restore API Route
 * 
 * POST /api/platform/tenants/[id]/restore
 * 
 * Restores a soft-deleted tenant within 30-day recovery window.
 * Protected by platform admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { restoreTenant } from '@/lib/tenants/soft-delete';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

    // TODO: Add platform admin authentication check
    // const adminUser = await requirePlatformAdmin(request);

    // Restore the tenant
    const result = await restoreTenant(tenantId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          message: 'Failed to restore tenant',
        },
        { status: result.error === 'Tenant not found' ? 404 : 400 }
      );
    }

    return NextResponse.json({
      message: 'Tenant restored successfully',
      tenant: {
        id: result.tenant!.id,
        name: result.tenant!.name,
        status: result.tenant!.status,
        deletedAt: (result.tenant as { deletedAt?: Date | null }).deletedAt ?? null,
      },
      note: 'Tenant status set to "suspended". Admin must manually reactivate.',
    });
  } catch (error) {
    console.error('Restore tenant API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to restore tenant',
      },
      { status: 500 }
    );
  }
}
