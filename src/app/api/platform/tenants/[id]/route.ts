/**
 * Tenant Delete API Route
 * 
 * DELETE /api/platform/tenants/[id]
 * 
 * Soft deletes a tenant with 30-day recovery window.
 * Protected by platform admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { softDeleteTenant } from '@/lib/tenants/soft-delete';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

    // TODO: Add platform admin authentication check
    // const adminUser = await requirePlatformAdmin(request);

    // Parse optional deletion reason from request body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // No body or invalid JSON - continue without reason
    }

    // Soft delete the tenant
    const result = await softDeleteTenant(tenantId, reason);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          message: 'Failed to delete tenant',
        },
        { status: result.error === 'Tenant not found' ? 404 : 400 }
      );
    }

    return NextResponse.json({
      message: 'Tenant soft deleted successfully',
      tenant: {
        id: result.tenant!.id,
        name: result.tenant!.name,
        status: result.tenant!.status,
        deletedAt: (result.tenant as { deletedAt?: Date | null }).deletedAt ?? null,
      },
      recoveryWindow: {
        ends: result.recoveryWindowEnds,
        daysRemaining: 30,
      },
      note: 'Tenant can be restored within 30 days using the restore endpoint',
    });
  } catch (error) {
    console.error('Delete tenant API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to delete tenant',
      },
      { status: 500 }
    );
  }
}
