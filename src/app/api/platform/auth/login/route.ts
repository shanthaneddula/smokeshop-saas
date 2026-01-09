import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { masterDb } from '@/lib/db/master-db';
import { generatePlatformAdminToken } from '@/lib/auth/platform';
import { applyRateLimit, addRateLimitHeaders } from '@/lib/security/rate-limit-middleware';
import { RATE_LIMITS } from '@/lib/security/rate-limiter';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Platform Admin Login
 * Authenticates against admin_users table in MASTER database
 * This is separate from tenant user login
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (3 attempts per minute per IP - more strict for platform admin)
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.PLATFORM_LOGIN);
    if (!rateLimitResult.allowed && rateLimitResult.response) {
      return rateLimitResult.response;
    }
    
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
    
    console.log('[PlatformAuth] Admin login attempt:', email);
    
    // Find admin user in MASTER database
    const adminUser = await masterDb.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (!adminUser) {
      console.warn('[PlatformAuth] Admin user not found:', email);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Check if admin is active
    if (!adminUser.isActive) {
      console.warn('[PlatformAuth] Admin user inactive:', email);
      return NextResponse.json(
        { error: 'Account is inactive. Contact support.' },
        { status: 403 }
      );
    }
    
    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);
    if (!isValidPassword) {
      console.warn('[PlatformAuth] Invalid password for admin:', email);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    console.log('[PlatformAuth] Admin login successful:', email);
    
    // Generate JWT token for platform admin using centralized utility
    const token = generatePlatformAdminToken({
      adminId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
    });
    
    // Create response with admin info
    const response = NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
    });
    
    // Set httpOnly cookie for platform admin
    response.cookies.set('platform-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    // Add rate limit headers to successful response
    return addRateLimitHeaders(response, rateLimitResult.info);
  } catch (error) {
    console.error('[PlatformAuth] Login error:', error);
    
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
