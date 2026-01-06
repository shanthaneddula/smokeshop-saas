import { PrismaClient } from '@prisma/master-client';

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
  customDomain?: string;
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  ownerEmail: string;
  ownerName?: string;
  phone?: string;
}) {
  return masterDb.tenant.create({
    data: {
      ...data,
      status: 'trial',
      plan: 'starter',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });
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
