/**
 * Tenant Context Utilities
 * 
 * Middleware passes x-tenant-domain header (NO DB calls in Edge runtime).
 * API routes use this module to lookup tenant from master DB in Node.js runtime.
 */

import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { getTenantDb as getPooledTenantDb, buildConnectionStringWithDecryption } from './db/tenant-connector';
import { getTenantByDomain, buildTenantConnectionString } from './db/master-db';
import { DecryptionError } from './security/encryption';

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  customDomain: string | null;
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: number;
  supabaseProjectId: string | null;
  status: string;
}

/**
 * Get tenant info from request (reads x-tenant-domain header, queries master DB)
 * Use this in API routes - runs in Node.js runtime where Prisma works
 */
export async function getTenantInfo(request: NextRequest): Promise<TenantInfo | null> {
  try {
    const domain = request.headers.get('x-tenant-domain');
    
    if (!domain) {
      console.warn('[TenantContext] Missing x-tenant-domain header from middleware');
      return null;
    }

    console.log(`[TenantContext] Looking up tenant for domain: ${domain}`);
    
    // Query master database for tenant (Node.js runtime - Prisma OK!)
    const tenant = await getTenantByDomain(domain);
    
    if (!tenant) {
      console.error(`[TenantContext] Tenant not found for domain: ${domain}`);
      return null;
    }
    
    console.log(`[TenantContext] Found tenant: ${tenant.name} (${tenant.slug})`);
    
    return tenant;
  } catch (error) {
    console.error('[TenantContext] Error looking up tenant:', error);
    return null;
  }
}

/**
 * Get tenant database connection from tenant info
 * Automatically decrypts password, builds connection string, and uses connection pool
 */
export async function getTenantDb(tenant: TenantInfo): Promise<PrismaClient> {
  try {
    console.log(`[TenantPool] Getting connection for tenant ${tenant.id}`);
    
    // Build connection string with automatic password decryption
    const connectionString = await buildTenantConnectionString(tenant);
    
    // Get cached or new connection from pool
    const db = getPooledTenantDb(tenant.id, connectionString);
    
    return db;
  } catch (error) {
    console.error('[TenantContext] Error getting tenant database:', error);
    
    if (error instanceof DecryptionError) {
      throw new Error('Failed to decrypt database credentials. Please contact support.');
    }
    
    throw new Error(`Failed to connect to tenant database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Require tenant context - throws error if not found
 * Use this when tenant context is mandatory for the request
 */
export async function requireTenant(request: NextRequest): Promise<TenantInfo> {
  const tenant = await getTenantInfo(request);
  
  if (!tenant) {
    throw new Error('Tenant not found for this domain');
  }
  
  if (tenant.status !== 'active') {
    throw new Error(`Tenant is ${tenant.status}`);
  }
  
  return tenant;
}

/**
 * Require tenant database - throws error if not available
 * Combines tenant lookup + database connection in one call
 */
export async function requireTenantDb(tenant: TenantInfo): Promise<PrismaClient> {
  const db = await getTenantDb(tenant);
  
  if (!db) {
    throw new Error('Failed to connect to tenant database');
  }
  
  return db;
}
