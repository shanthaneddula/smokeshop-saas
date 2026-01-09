import { PrismaClient } from '@prisma/master-client';
import {
  encryptDatabasePassword,
  decryptDatabasePassword,
  EncryptionError,
} from '../security/encryption';

// Master database client (YOUR central registry)
// Connects to your Supabase project that tracks all tenants

const globalForMasterPrisma = globalThis as unknown as {
  masterPrisma: PrismaClient | undefined;
};

export const masterDb =
  globalForMasterPrisma.masterPrisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.MASTER_DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForMasterPrisma.masterPrisma = masterDb;
}

// Helper functions for tenant management

export async function getTenantByDomain(domain: string) {
  return masterDb.tenant.findUnique({
    where: { customDomain: domain },
  });
}

export async function getTenantBySlug(slug: string) {
  return masterDb.tenant.findUnique({
    where: { slug },
  });
}

export async function getAllActiveTenants() {
  return masterDb.tenant.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTenant(data: {
  name: string;
  slug: string;
  customDomain?: string | null;
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort?: number;
  ownerEmail: string;
  ownerName?: string | null;
  phone?: string | null;
  // Optional Supabase metadata
  supabaseProjectId?: string | null;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  supabaseServiceKey?: string | null;
  // Optional status/plan overrides
  status?: string;
  plan?: string;
}) {
  try {
    // Encrypt password before storing
    const encryptedPassword = await encryptDatabasePassword(data.dbPassword);
    
    // Build the create data object, excluding undefined values
    const createData: Record<string, unknown> = {
      name: data.name,
      slug: data.slug,
      customDomain: data.customDomain ?? null,
      dbHost: data.dbHost,
      dbName: data.dbName,
      dbUser: data.dbUser,
      dbPassword: encryptedPassword,
      dbPort: data.dbPort ?? 5432,
      ownerEmail: data.ownerEmail,
      ownerName: data.ownerName ?? null,
      phone: data.phone ?? null,
      status: data.status ?? 'trial',
      plan: data.plan ?? 'starter',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    };
    
    // Add optional Supabase fields if provided
    if (data.supabaseProjectId) createData.supabaseProjectId = data.supabaseProjectId;
    if (data.supabaseUrl) createData.supabaseUrl = data.supabaseUrl;
    if (data.supabaseAnonKey) createData.supabaseAnonKey = data.supabaseAnonKey;
    if (data.supabaseServiceKey) createData.supabaseServiceKey = data.supabaseServiceKey;
    
    return await masterDb.tenant.create({
      data: createData as any, // Type assertion needed due to dynamic fields
    });
  } catch (error) {
    console.error('[Master DB] Failed to create tenant:', error);
    
    if (error instanceof EncryptionError) {
      throw new Error(`Failed to encrypt tenant password: ${error.message}`);
    }
    
    throw error;
  }
}

export async function logTenantActivity(
  tenantId: string,
  eventType: string,
  details?: any
) {
  return masterDb.tenantActivityLog.create({
    data: {
      tenantId,
      eventType,
      details: details || {},
    },
  });
}

export async function recordMigration(
  tenantId: string,
  migrationName: string,
  status: 'completed' | 'failed',
  errorMessage?: string
) {
  return masterDb.tenantMigration.create({
    data: {
      tenantId,
      migrationName,
      status,
      errorMessage,
      executedAt: status === 'completed' ? new Date() : null,
    },
  });
}

/**
 * Gets decrypted database password for a tenant
 * 
 * @param tenant - Tenant object with encrypted dbPassword
 * @returns Decrypted password
 * @throws Error if decryption fails
 */
export async function getDecryptedPassword(tenant: { dbPassword: string }): Promise<string> {
  try {
    return await decryptDatabasePassword(tenant.dbPassword);
  } catch (error) {
    console.error('[Master DB] Failed to decrypt tenant password:', error);
    
    if (error instanceof EncryptionError) {
      throw new Error('Failed to decrypt tenant password. The password may be corrupted.');
    }
    
    throw new Error('Database password decryption failed');
  }
}

/**
 * Builds a safe PostgreSQL connection string with decrypted password
 * 
 * @param tenant - Tenant with database credentials
 * @returns PostgreSQL connection string
 */
export async function buildTenantConnectionString(tenant: {
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
}): Promise<string> {
  try {
    const decryptedPassword = await getDecryptedPassword(tenant);
    
    // URL-encode credentials to handle special characters
    const encodedUser = encodeURIComponent(tenant.dbUser);
    const encodedPassword = encodeURIComponent(decryptedPassword);
    const encodedDbName = encodeURIComponent(tenant.dbName);
    
    return `postgresql://${encodedUser}:${encodedPassword}@${tenant.dbHost}:${tenant.dbPort}/${encodedDbName}`;
  } catch (error) {
    console.error('[Master DB] Failed to build connection string:', error);
    throw error;
  }
}

/**
 * Updates tenant database password (encrypts automatically)
 * 
 * @param tenantId - Tenant ID
 * @param newPassword - New plain text password
 */
export async function updateTenantPassword(
  tenantId: string,
  newPassword: string
): Promise<void> {
  try {
    const encryptedPassword = await encryptDatabasePassword(newPassword);
    
    await masterDb.tenant.update({
      where: { id: tenantId },
      data: { dbPassword: encryptedPassword },
    });
    
    // Log password change
    await logTenantActivity(tenantId, 'password_changed', {
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Master DB] Password updated for tenant ${tenantId}`);
  } catch (error) {
    console.error('[Master DB] Failed to update tenant password:', error);
    throw error;
  }
}

export function getMasterDb() {
  return masterDb;
}

