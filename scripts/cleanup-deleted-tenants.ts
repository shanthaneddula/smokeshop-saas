/**
 * Tenant Cleanup Job
 * 
 * Scheduled job to permanently delete tenants past 30-day recovery window.
 * Should be run daily via cron or similar scheduler.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-deleted-tenants.ts
 * 
 * Or as API route:
 *   POST /api/platform/cleanup/tenants
 *   Authorization: Bearer <admin-token>
 */

import { cleanupExpiredTenants } from '@/lib/tenants/soft-delete';

async function main() {
  console.log('Starting tenant cleanup job...');
  console.log(`Date: ${new Date().toISOString()}\n`);

  const result = await cleanupExpiredTenants();

  if (!result.success) {
    console.error('❌ Cleanup job failed:', result.error);
    process.exit(1);
  }

  console.log('✅ Cleanup job completed successfully\n');
  console.log('Summary:');
  console.log(`  Total processed: ${result.results!.totalProcessed}`);
  console.log(`  Successful deletions: ${result.results!.successful}`);
  console.log(`  Failed deletions: ${result.results!.failed}`);

  if (result.results!.errors.length > 0) {
    console.log('\nErrors:');
    result.results!.errors.forEach((error) => {
      console.log(`  - ${error}`);
    });
  }

  if (result.results!.successful === 0 && result.results!.totalProcessed === 0) {
    console.log('\nNo tenants eligible for permanent deletion.');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
