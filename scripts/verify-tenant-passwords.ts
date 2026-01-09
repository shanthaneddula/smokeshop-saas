#!/usr/bin/env tsx
/**
 * Verify Encrypted Tenant Passwords
 * 
 * Tests that encrypted tenant passwords can be:
 * 1. Successfully decrypted
 * 2. Used to connect to tenant databases
 * 
 * Usage: npx tsx scripts/verify-tenant-passwords.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { PrismaClient as MasterClient } from '@prisma/master-client';
import { PrismaClient as TenantClient } from '@prisma/client';
import { decryptDatabasePassword, isEncrypted } from '../src/lib/security/encryption';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verifyTenantPassword(tenant: any, index: number, total: number) {
  const progress = `[${index + 1}/${total}]`;
  
  try {
    // Check if password is encrypted
    if (!isEncrypted(tenant.dbPassword)) {
      log(`   ${progress} ${tenant.name}: ⚠️  Password not encrypted!`, 'yellow');
      return { success: false, error: 'not_encrypted' };
    }
    
    // Try to decrypt
    const decrypted = await decryptDatabasePassword(tenant.dbPassword);
    if (!decrypted) {
      log(`   ${progress} ${tenant.name}: ❌ Decryption failed`, 'red');
      return { success: false, error: 'decryption_failed' };
    }
    
    // Build connection string
    const connectionString = `postgresql://${encodeURIComponent(tenant.dbUser)}:${encodeURIComponent(decrypted)}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}`;
    
    // Try to connect
    const tenantDb = new TenantClient({
      datasources: {
        db: { url: connectionString },
      },
    });
    
    // Test connection
    await tenantDb.$connect();
    
    // Test a simple query
    await tenantDb.$queryRaw`SELECT 1 as test`;
    
    await tenantDb.$disconnect();
    
    log(`   ${progress} ${tenant.name}: ✅ Connection successful`, 'green');
    return { success: true };
    
  } catch (error) {
    log(`   ${progress} ${tenant.name}: ❌ ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    return { success: false, error: error instanceof Error ? error.message : 'unknown' };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║      Verify Encrypted Tenant Passwords & Connections  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const masterDb = new MasterClient({
    datasources: {
      db: {
        url: process.env.MASTER_DATABASE_URL,
      },
    },
  });
  
  try {
    log('📋 Fetching all tenants...', 'cyan');
    
    const tenants = await masterDb.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        dbHost: true,
        dbPort: true,
        dbName: true,
        dbUser: true,
        dbPassword: true,
        status: true,
      },
    });
    
    log(`   Found ${tenants.length} tenant(s)\n`, 'cyan');
    
    log('🔐 Verifying passwords and connections...', 'cyan');
    
    const results = {
      total: tenants.length,
      success: 0,
      failed: 0,
      notEncrypted: 0,
      errors: [] as Array<{ tenant: string; error: string }>,
    };
    
    for (let i = 0; i < tenants.length; i++) {
      const result = await verifyTenantPassword(tenants[i], i, tenants.length);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (result.error === 'not_encrypted') {
          results.notEncrypted++;
        }
        results.errors.push({
          tenant: tenants[i].name,
          error: result.error || 'unknown',
        });
      }
    }
    
    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                       SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    log(`Total tenants: ${results.total}`, 'cyan');
    log(`✅ Successful connections: ${results.success}`, results.success === results.total ? 'green' : 'yellow');
    log(`❌ Failed connections: ${results.failed}`, results.failed === 0 ? 'green' : 'red');
    
    if (results.notEncrypted > 0) {
      log(`⚠️  Not encrypted: ${results.notEncrypted}`, 'yellow');
      log('\nRun encryption migration: npx tsx scripts/encrypt-tenant-passwords.ts', 'yellow');
    }
    
    if (results.errors.length > 0) {
      log('\n❌ Errors:', 'red');
      results.errors.forEach(({ tenant, error }) => {
        log(`   ${tenant}: ${error}`, 'red');
      });
    }
    
    if (results.failed === 0) {
      log('\n✅ All tenant passwords verified successfully!', 'green');
      log('   All tenant databases are accessible.', 'green');
      process.exit(0);
    } else {
      log('\n⚠️  Some tenant passwords could not be verified', 'yellow');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ Verification failed: ${error}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await masterDb.$disconnect();
  }
}

// Run verification
main();
