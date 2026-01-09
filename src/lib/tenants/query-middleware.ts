/**
 * Tenant Query Middleware
 * 
 * Automatically excludes soft-deleted tenants from all queries unless explicitly included.
 * This prevents accidentally showing deleted tenants in the UI or API responses.
 */

import { Prisma } from '@prisma/master-client';

/**
 * Prisma middleware to exclude deleted tenants by default
 * 
 * Usage in master-db.ts:
 * 
 * masterDb.$use(excludeDeletedTenantsMiddleware);
 */
export const excludeDeletedTenantsMiddleware: Prisma.Middleware = async (
  params,
  next
) => {
  // Only apply to Tenant model queries
  if (params.model === 'Tenant') {
    // For queries that fetch data (not create/update/delete)
    if (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'count'
    ) {
      // Check if query explicitly includes deletedAt filter
      const hasDeletedAtFilter =
        params.args?.where?.deletedAt !== undefined ||
        params.args?.where?.AND?.some(
          (condition: any) => condition.deletedAt !== undefined
        ) ||
        params.args?.where?.OR?.some(
          (condition: any) => condition.deletedAt !== undefined
        );

      // If no explicit deletedAt filter, exclude soft-deleted tenants
      if (!hasDeletedAtFilter) {
        if (!params.args) {
          params.args = {};
        }
        if (!params.args.where) {
          params.args.where = {};
        }

        // Add deletedAt: null to WHERE clause
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
      }
    }
  }

  return next(params);
};

/**
 * Helper function to explicitly include deleted tenants in a query
 * 
 * Usage:
 * 
 * const allTenants = await masterDb.tenant.findMany({
 *   where: includeDeleted({ status: 'trial' })
 * });
 */
export function includeDeleted<T extends Record<string, any>>(
  where?: T
): T & { deletedAt?: any } {
  return {
    ...where,
    deletedAt: undefined, // Explicitly set to undefined to disable middleware filter
  } as T & { deletedAt?: any };
}

/**
 * Helper function to explicitly query only deleted tenants
 * 
 * Usage:
 * 
 * const deletedTenants = await masterDb.tenant.findMany({
 *   where: onlyDeleted({ status: 'deleted' })
 * });
 */
export function onlyDeleted<T extends Record<string, any>>(
  where?: T
): T & { deletedAt: { not: null } } {
  return {
    ...where,
    deletedAt: { not: null },
  } as T & { deletedAt: { not: null } };
}

/**
 * Helper function to explicitly query only active (non-deleted) tenants
 * 
 * Usage:
 * 
 * const activeTenants = await masterDb.tenant.findMany({
 *   where: onlyActive({ plan: 'enterprise' })
 * });
 */
export function onlyActive<T extends Record<string, any>>(
  where?: T
): T & { deletedAt: null } {
  return {
    ...where,
    deletedAt: null,
  } as T & { deletedAt: null };
}
