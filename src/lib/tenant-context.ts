/**
 * Tenant Context Utilities
 * 
 * Helpers to extract tenant information from request headers
 * (injected by middleware) and get tenant database connection.
 */

import { headers } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { getTenantDb } from './db/tenant-connector';

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  domain: string;
  dbConfig: {
    host: string;
    user: string;
    password: string;
    port: string;
    database: string;
    projectId: string;
  };
}

/**
 * Extract tenant information from request headers (set by middleware)
 * Use this in API routes and server components
 */
export async function getTenantInfo(): Promise<TenantInfo | null> {
  try {
    const headersList = await headers();
    
    const tenantId = headersList.get('x-tenant-id');
    const tenantSlug = headersList.get('x-tenant-slug');
    const tenantName = headersList.get('x-tenant-name');
    const tenantDomain = headersList.get('x-tenant-domain');
    const dbConfigEncoded = headersList.get('x-tenant-db-config');

    if (!tenantId || !tenantSlug || !dbConfigEncoded) {
      console.warn('[TenantContext] Missing tenant headers');
      return null;
    }

    // Decode database config
    const dbConfig = JSON.parse(
      Buffer.from(dbConfigEncoded, 'base64').toString('utf-8')
    );

    return {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName || '',
      domain: tenantDomain || '',
      dbConfig,
    };
  } catch (error) {
    console.error('[TenantContext] Error extracting tenant info:', error);
    return null;
  }
}

/**
 * Get tenant database connection
 * Automatically builds connection string and uses connection pool
 */
export async function getTenantDatabase(): Promise<PrismaClient | null> {
  try {
    const tenantInfo = await getTenantInfo();
    
    if (!tenantInfo) {
      console.error('[TenantContext] No tenant info available');
      return null;
    }

    // Build connection string
    const connectionString = `postgresql://${tenantInfo.dbConfig.user}:${tenantInfo.dbConfig.password}@${tenantInfo.dbConfig.host}:${tenantInfo.dbConfig.port}/${tenantInfo.dbConfig.database}`;

    // Get cached or new connection from pool
    const db = await getTenantDb(tenantInfo.id, connectionString);
    
    return db;
  } catch (error) {
    console.error('[TenantContext] Error getting tenant database:', error);
    return null;
  }
}

/**
 * Require tenant context - throws error if not available
 * Use this when tenant context is mandatory
 */
export async function requireTenant(): Promise<TenantInfo> {
  const tenantInfo = await getTenantInfo();
  
  if (!tenantInfo) {
    throw new Error('Tenant context not available. Request must go through domain middleware.');
  }
  
  return tenantInfo;
}

/**
 * Require tenant database - throws error if not available
 */
export async function requireTenantDb(): Promise<PrismaClient> {
  const db = await getTenantDatabase();
  
  if (!db) {
    throw new Error('Tenant database not available. Request must go through domain middleware.');
  }
  
  return db;
}

/**
 * Extract tenant info from NextRequest (for use in route handlers)
 * This version works with NextRequest objects directly
 */
export function extractTenantFromRequest(request: Request): TenantInfo | null {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const tenantSlug = request.headers.get('x-tenant-slug');
    const tenantName = request.headers.get('x-tenant-name');
    const tenantDomain = request.headers.get('x-tenant-domain');
    const dbConfigEncoded = request.headers.get('x-tenant-db-config');

    if (!tenantId || !tenantSlug || !dbConfigEncoded) {
      return null;
    }

    const dbConfig = JSON.parse(
      Buffer.from(dbConfigEncoded, 'base64').toString('utf-8')
    );

    return {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName || '',
      domain: tenantDomain || '',
      dbConfig,
    };
  } catch (error) {
    console.error('[TenantContext] Error extracting from request:', error);
    return null;
  }
}
