/**
 * Soft Delete Service for Tenants
 * 
 * Implements soft delete functionality with 30-day recovery window.
 * Deleted tenants are marked with deletedAt timestamp instead of being removed.
 * After 30 days, a cleanup job permanently deletes the tenant and all associated data.
 */

import { masterDb } from '@/lib/db/master-db';
import { Tenant } from '@prisma/master-client';

export interface SoftDeleteResult {
  success: boolean;
  tenant?: Tenant;
  error?: string;
  recoveryWindowEnds?: Date;
}

export interface RestoreResult {
  success: boolean;
  tenant?: Tenant;
  error?: string;
}

export interface PermanentDeleteResult {
  success: boolean;
  tenantId: string;
  error?: string;
  deletedData: {
    tenant: boolean;
    activityLogs: number;
    migrations: number;
  };
}

/**
 * Soft delete a tenant (mark as deleted, 30-day recovery window)
 */
export async function softDeleteTenant(
  tenantId: string,
  reason?: string
): Promise<SoftDeleteResult> {
  try {
    // Check if tenant exists and is not already deleted
    const existingTenant = await masterDb.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) {
      return {
        success: false,
        error: 'Tenant not found',
      };
    }

    if (existingTenant.deletedAt) {
      return {
        success: false,
        error: 'Tenant is already deleted',
        tenant: existingTenant,
        recoveryWindowEnds: new Date(
          existingTenant.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000
        ),
      };
    }

    // Calculate recovery window end date (30 days from now)
    const recoveryWindowEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Soft delete: Set deletedAt timestamp and update status
    const deletedTenant = await masterDb.tenant.update({
      where: { id: tenantId },
      data: {
        deletedAt: new Date(),
        status: 'deleted',
        // Store deletion reason in a custom field or notes
        ...(reason && { deletionReason: reason }),
      },
    });

    // Log the soft delete activity
    await masterDb.tenantActivityLog.create({
      data: {
        tenantId,
        eventType: 'tenant_soft_deleted',
        details: {
          deletedAt: deletedTenant.deletedAt,
          recoveryWindowEnds,
          reason: reason || 'No reason provided',
          previousStatus: existingTenant.status,
        },
      },
    });

    return {
      success: true,
      tenant: deletedTenant,
      recoveryWindowEnds,
    };
  } catch (error) {
    console.error('Soft delete tenant error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore a soft-deleted tenant (within 30-day recovery window)
 */
export async function restoreTenant(tenantId: string): Promise<RestoreResult> {
  try {
    // Check if tenant exists and is deleted
    const existingTenant = await masterDb.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) {
      return {
        success: false,
        error: 'Tenant not found',
      };
    }

    if (!existingTenant.deletedAt) {
      return {
        success: false,
        error: 'Tenant is not deleted',
        tenant: existingTenant,
      };
    }

    // Check if recovery window has expired (30 days)
    const recoveryWindowEnds = new Date(
      existingTenant.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    if (new Date() > recoveryWindowEnds) {
      return {
        success: false,
        error: 'Recovery window has expired (30 days). Tenant cannot be restored.',
      };
    }

    // Restore: Remove deletedAt timestamp and restore previous status
    const restoredTenant = await masterDb.tenant.update({
      where: { id: tenantId },
      data: {
        deletedAt: null,
        status: 'suspended', // Restore as suspended for safety (admin must reactivate)
        deletionReason: null,
      },
    });

    // Log the restore activity
    await masterDb.tenantActivityLog.create({
      data: {
        tenantId,
        eventType: 'tenant_restored',
        details: {
          restoredAt: new Date(),
          wasDeletedAt: existingTenant.deletedAt,
          restoredStatus: 'suspended',
        },
      },
    });

    return {
      success: true,
      tenant: restoredTenant,
    };
  } catch (error) {
    console.error('Restore tenant error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Permanently delete a tenant and all associated data
 * This is irreversible and should only be used for tenants past 30-day recovery window
 */
export async function permanentlyDeleteTenant(
  tenantId: string,
  forceDelete: boolean = false
): Promise<PermanentDeleteResult> {
  try {
    // Check if tenant exists
    const existingTenant = await masterDb.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) {
      return {
        success: false,
        tenantId,
        error: 'Tenant not found',
        deletedData: {
          tenant: false,
          activityLogs: 0,
          migrations: 0,
        },
      };
    }

    // Check if tenant is soft-deleted and recovery window has expired
    if (!forceDelete) {
      if (!existingTenant.deletedAt) {
        return {
          success: false,
          tenantId,
          error: 'Tenant must be soft-deleted first. Use softDeleteTenant() first.',
          deletedData: {
            tenant: false,
            activityLogs: 0,
            migrations: 0,
          },
        };
      }

      const recoveryWindowEnds = new Date(
        existingTenant.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      if (new Date() < recoveryWindowEnds) {
        return {
          success: false,
          tenantId,
          error: `Recovery window has not expired yet (ends ${recoveryWindowEnds.toISOString()}). Use forceDelete=true to override.`,
          deletedData: {
            tenant: false,
            activityLogs: 0,
            migrations: 0,
          },
        };
      }
    }

    // Log permanent deletion activity BEFORE deleting (for audit)
    await masterDb.tenantActivityLog.create({
      data: {
        tenantId,
        eventType: 'tenant_permanently_deleted',
        details: {
          deletedAt: new Date(),
          forceDelete,
          tenantData: {
            name: existingTenant.name,
            slug: existingTenant.slug,
            customDomain: existingTenant.customDomain,
            createdAt: existingTenant.createdAt,
            softDeletedAt: existingTenant.deletedAt,
          },
        },
      },
    });

    // Count related records before deletion
    const activityLogsCount = await masterDb.tenantActivityLog.count({
      where: { tenantId },
    });

    const migrationsCount = await masterDb.tenantMigration.count({
      where: { tenantId },
    });

    // Permanently delete tenant (cascades to related records via Prisma schema)
    await masterDb.tenant.delete({
      where: { id: tenantId },
    });

    console.log(`Permanently deleted tenant ${tenantId}`, {
      tenant: existingTenant.name,
      activityLogs: activityLogsCount,
      migrations: migrationsCount,
    });

    return {
      success: true,
      tenantId,
      deletedData: {
        tenant: true,
        activityLogs: activityLogsCount,
        migrations: migrationsCount,
      },
    };
  } catch (error) {
    console.error('Permanent delete tenant error:', error);
    return {
      success: false,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deletedData: {
        tenant: false,
        activityLogs: 0,
        migrations: 0,
      },
    };
  }
}

/**
 * Get all soft-deleted tenants
 */
export async function getDeletedTenants() {
  try {
    const deletedTenants = await masterDb.tenant.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });

    // Calculate recovery window status for each tenant
    const tenantsWithStatus = deletedTenants.map((tenant) => {
      const recoveryWindowEnds = new Date(
        tenant.deletedAt!.getTime() + 30 * 24 * 60 * 60 * 1000
      );
      const canRestore = new Date() < recoveryWindowEnds;
      const daysUntilPermanentDelete = Math.ceil(
        (recoveryWindowEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...tenant,
        recoveryWindowEnds,
        canRestore,
        daysUntilPermanentDelete: canRestore ? daysUntilPermanentDelete : 0,
      };
    });

    return {
      success: true,
      tenants: tenantsWithStatus,
    };
  } catch (error) {
    console.error('Get deleted tenants error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenants: [],
    };
  }
}

/**
 * Get tenants eligible for permanent deletion (past 30-day window)
 */
export async function getTenantsEligibleForPermanentDeletion() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const eligibleTenants = await masterDb.tenant.findMany({
      where: {
        deletedAt: {
          not: null,
          lt: thirtyDaysAgo,
        },
      },
      orderBy: {
        deletedAt: 'asc',
      },
    });

    return {
      success: true,
      tenants: eligibleTenants,
      count: eligibleTenants.length,
    };
  } catch (error) {
    console.error('Get eligible tenants error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenants: [],
      count: 0,
    };
  }
}

/**
 * Cleanup job: Permanently delete all tenants past 30-day recovery window
 * This should be run as a scheduled job (e.g., daily via cron)
 */
export async function cleanupExpiredTenants() {
  try {
    const { tenants } = await getTenantsEligibleForPermanentDeletion();

    const results = {
      totalProcessed: tenants.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const tenant of tenants) {
      const result = await permanentlyDeleteTenant(tenant.id);
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push(`${tenant.name} (${tenant.id}): ${result.error}`);
      }
    }

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('Cleanup expired tenants error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results: {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        errors: [],
      },
    };
  }
}
