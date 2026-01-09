import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireTenant, requireTenantDb } from '@/lib/tenant-context';
import { applyRateLimit, addRateLimitHeaders } from '@/lib/security/rate-limit-middleware';
import { RATE_LIMITS } from '@/lib/security/rate-limiter';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (5 attempts per minute per IP)
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.TENANT_LOGIN);
    if (!rateLimitResult.allowed && rateLimitResult.response) {
      return rateLimitResult.response;
    }
    
    // Get tenant context from domain
    const tenant = await requireTenant(request);
    const tenantDb = await requireTenantDb(tenant);
    
    const body = await request.json();
    
    // Validate input
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }
    
    const { email, password } = result.data;
    
    // Find user in TENANT database (complete isolation)
    const user = await tenantDb.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Generate JWT token with tenant context
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: '7d',
        issuer: 'smokeshop-saas',
        audience: 'smokeshop-saas-users',
      }
    );
    
    // Create response with user and tenant info
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    });
    
    // Set httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    // Add rate limit headers to successful response
    return addRateLimitHeaders(response, rateLimitResult.info);
  } catch (error) {
    console.error('[Login] Error:', error);
    
    // Handle tenant not found errors
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found for this domain' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
