import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/platform';
import { masterDb } from '@/lib/db/master-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/platform/tenants/check-domain
 * Check if a custom domain is available (not already registered by another tenant)
 * 
 * Unlike subdomain validation, this just checks:
 * 1. Valid domain format
 * 2. Not already registered in our system
 * 
 * Tenants are responsible for owning and configuring their own domains.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify platform admin authentication
    requirePlatformAdmin(request);

    const { domain } = await request.json();

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({
        available: false,
        error: 'Domain is required',
      });
    }

    const normalizedDomain = domain.toLowerCase().trim();

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(normalizedDomain)) {
      return NextResponse.json({
        available: false,
        error: 'Invalid domain format. Please enter a valid domain (e.g., mysmokeshop.com)',
      });
    }

    // Check minimum length
    if (normalizedDomain.length < 4) {
      return NextResponse.json({
        available: false,
        error: 'Domain is too short.',
      });
    }

    // Check maximum length
    if (normalizedDomain.length > 253) {
      return NextResponse.json({
        available: false,
        error: 'Domain is too long.',
      });
    }

    // Check if domain is already registered with another tenant (excluding soft-deleted)
    const existing = await masterDb.tenant.findFirst({
      where: { 
        customDomain: normalizedDomain,
      },
    });
    
    // Filter out soft-deleted tenants (if deletedAt field exists)
    const isDeleted = existing && 'deletedAt' in existing && existing.deletedAt !== null;

    if (existing && !isDeleted) {
      return NextResponse.json({
        available: false,
        error: 'This domain is already registered with another tenant.',
      });
    }

    return NextResponse.json({
      available: true,
      domain: normalizedDomain,
      message: 'This domain is available for registration.',
    });
  } catch (error) {
    console.error('[CheckDomain] Error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        available: false,
        error: 'Failed to check domain availability' 
      },
      { status: 500 }
    );
  }
}
