/**
 * Platform Admin Authentication Utilities
 * 
 * Centralized authentication for platform admin endpoints.
 * Platform admins manage the entire SaaS platform, tenants, and master catalog.
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface PlatformAdminPayload {
  adminId: string;
  email: string;
  name: string;
  type: 'platform_admin';
}

/**
 * Verify platform admin token from cookies
 * Returns decoded payload if valid, throws error if invalid
 */
export function verifyPlatformAdmin(request: NextRequest): PlatformAdminPayload {
  const token = request.cookies.get('platform-auth-token')?.value;
  
  if (!token) {
    throw new Error('Not authenticated - platform admin token required');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'smokeshop-saas',
      audience: 'smokeshop-saas-admin',
    }) as PlatformAdminPayload;
    
    // Verify it's actually a platform admin token
    if (decoded.type !== 'platform_admin') {
      throw new Error('Not a platform admin token');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Platform admin token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid platform admin token');
    }
    throw error;
  }
}

/**
 * Require platform admin authentication
 * Throws error with proper status if not authenticated
 * Use this in API route handlers for cleaner error handling
 */
export function requirePlatformAdmin(request: NextRequest): PlatformAdminPayload {
  try {
    return verifyPlatformAdmin(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    throw new Error(`Unauthorized: ${message}`);
  }
}

/**
 * Generate platform admin JWT token
 */
export function generatePlatformAdminToken(payload: Omit<PlatformAdminPayload, 'type'>): string {
  return jwt.sign(
    {
      ...payload,
      type: 'platform_admin',
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'smokeshop-saas',
      audience: 'smokeshop-saas-admin',
    }
  );
}

/**
 * Check if a request has valid platform admin credentials
 * Returns true/false without throwing
 */
export function isPlatformAdmin(request: NextRequest): boolean {
  try {
    verifyPlatformAdmin(request);
    return true;
  } catch {
    return false;
  }
}
