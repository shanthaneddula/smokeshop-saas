import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/platform';
import { masterDb } from '@/lib/db/master-db';
import { z } from 'zod';
import { withIdempotency } from '@/lib/security/idempotency-middleware';
import { IDEMPOTENCY_CONFIGS } from '@/lib/security/idempotency';
import { applyRateLimit, addRateLimitHeaders } from '@/lib/security/rate-limit-middleware';
import { RATE_LIMITS } from '@/lib/security/rate-limiter';
import { provisionTenantWithSaga } from '@/lib/transactions/tenant-provisioning-saga';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createTenantSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  customDomain: z.string().optional(),
  ownerEmail: z.string().email('Invalid email address'),
  ownerName: z.string().min(1, 'Owner name is required'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  
  // Supabase Database Configuration
  dbHost: z.string().min(1, 'Database host is required'),
  dbName: z.string().default('postgres'),
  dbUser: z.string().default('postgres'),
  dbPassword: z.string().min(1, 'Database password is required'),
  dbPort: z.number().int().default(5432),
  supabaseProjectId: z.string().optional(),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().optional(),
  supabaseServiceKey: z.string().optional(),
});

/**
 * POST /api/platform/tenants
 * Create a new tenant with atomic transaction rollback
 * 
 * Features:
 * - Idempotency: Use Idempotency-Key header to prevent duplicate tenant creation
 * - Rate Limiting: 10 requests per hour per IP
 * - Transaction Rollback: Automatic rollback on any failure (Saga pattern)
 * 
 * Saga Steps:
 * 1. Create tenant in master database
 * 2. Verify tenant database connection
 * 3. Create MongoDB tenant database
 * 4. Activate tenant (set status to 'trial')
 * 5. Log tenant creation activity
 * 
 * If any step fails, all previous steps are automatically rolled back.
 */
export const POST = withIdempotency(
  IDEMPOTENCY_CONFIGS.TENANT_CREATE,
  async (request: NextRequest) => {
    try {
      // Apply rate limiting (10 requests per hour)
      const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.TENANT_CREATE);
      if (!rateLimitResult.allowed && rateLimitResult.response) {
        return rateLimitResult.response;
      }
      
      // Verify platform admin
      const admin = requirePlatformAdmin(request);
    
      // Parse and validate request
      const body = await request.json();
      const validation = createTenantSchema.safeParse(body);
      
      if (!validation.success) {
        return NextResponse.json(
          { 
            error: 'Invalid tenant data', 
            details: validation.error.issues 
          },
          { status: 400 }
        );
      }
      
      const data = validation.data;
      
      // Execute tenant provisioning saga (with automatic rollback)
      const result = await provisionTenantWithSaga({
        ...data,
        createdByAdminEmail: admin.email,
      });
      
      if (!result.success) {
        console.error(`[TenantProvisioning] Saga failed:`, result.error);
        
        return NextResponse.json(
          {
            error: 'Failed to create tenant',
            message: result.error,
            sagaId: result.sagaId,
            note: 'All changes have been automatically rolled back'
          },
          { status: 500 }
        );
      }
      
      console.log(`[TenantProvisioning] Tenant created successfully: ${result.tenant?.slug}`);
      
      // Return success response
      return NextResponse.json({
        success: true,
        tenant: result.tenant,
        message: 'Tenant created successfully',
        sagaId: result.sagaId,
        nextSteps: [
          'Run Prisma migrations on tenant database',
          'Create owner user in tenant database',
          'Configure custom domain DNS (if provided)',
          'Send welcome email to owner',
        ],
      }, { status: 201 });
      
    } catch (error) {
      console.error('[TenantProvisioning] Error:', error);
      
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create tenant',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /api/platform/tenants
 * List all tenants (for platform admin)
 */
export async function GET(request: NextRequest) {
  try {
    requirePlatformAdmin(request);
    
    const tenants = await masterDb.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        ownerEmail: true,
        ownerName: true,
        status: true,
        plan: true,
        trialEndsAt: true,
        createdAt: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      tenants,
      count: tenants.length,
    });
    
  } catch (error) {
    console.error('[TenantProvisioning] Error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to load tenants' },
      { status: 500 }
    );
  }
}
