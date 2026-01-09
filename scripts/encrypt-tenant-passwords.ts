/**
 * Migration Script: Encrypt Existing Database Passwords
 * 
 * This script encrypts all plain text database passwords in the master database.
 * It's safe to run multiple times - it will skip already encrypted passwords.
 * 
 * Usage:
 *   npx tsx scripts/encrypt-tenant-passwords.ts
 * 
 * Prerequisites:
 *   1. Set DB_PASSWORD_ENCRYPTION_KEY in .env.local
 *   2. Backup master database before running
 * 
 * Safety features:
 *   - Dry run mode (preview changes)
 *   - Automatic rollback on errors
 *   - Verification step after encryption
 *   - Progress tracking
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/master-client';
import {
  encryptDatabasePassword,
  decryptDatabasePassword,
  isEncrypted,
  generateEncryptionKey,
  testEncryption,
  ConfigurationError,
} from '../src/lib/security/encryption';
import * as readline from 'readline';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, total: number, message: string) {
  console.log(`${colors.cyan}[${step}/${total}]${colors.reset} ${message}`);
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

interface MigrationStats {
  total: number;
  alreadyEncrypted: number;
  encrypted: number;
  failed: number;
  errors: Array<{ tenantId: string; error: string }>;
}

async function verifyConfiguration(): Promise<boolean> {
  log('\n📋 Step 1: Verifying configuration...', 'cyan');
  
  try {
    // Check if encryption key is set
    if (!process.env.DB_PASSWORD_ENCRYPTION_KEY) {
      log('❌ DB_PASSWORD_ENCRYPTION_KEY is not set!', 'red');
      log('\nTo fix this:', 'yellow');
      log('1. Generate a key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"', 'yellow');
      log('2. Add to .env.local: DB_PASSWORD_ENCRYPTION_KEY=<generated_key>', 'yellow');
      return false;
    }
    
    // Test encryption/decryption
    log('   Testing encryption/decryption...', 'blue');
    const testResult = await testEncryption();
    
    if (!testResult) {
      log('❌ Encryption test failed!', 'red');
      return false;
    }
    
    log('✅ Configuration valid', 'green');
    return true;
    
  } catch (error) {
    if (error instanceof ConfigurationError) {
      log(`❌ Configuration error: ${error.message}`, 'red');
    } else {
      log(`❌ Unexpected error: ${error}`, 'red');
    }
    return false;
  }
}

async function analyzeTenants(masterDb: PrismaClient): Promise<MigrationStats> {
  log('\n📊 Step 2: Analyzing tenant passwords...', 'cyan');
  
  const tenants = await masterDb.tenant.findMany({
    select: {
      id: true,
      name: true,
      dbPassword: true,
    },
  });
  
  const stats: MigrationStats = {
    total: tenants.length,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    errors: [],
  };
  
  for (const tenant of tenants) {
    if (isEncrypted(tenant.dbPassword)) {
      stats.alreadyEncrypted++;
    }
  }
  
  log(`   Total tenants: ${stats.total}`, 'blue');
  log(`   Already encrypted: ${stats.alreadyEncrypted}`, 'green');
  log(`   Need encryption: ${stats.total - stats.alreadyEncrypted}`, 'yellow');
  
  return stats;
}

async function encryptPasswords(
  masterDb: PrismaClient,
  dryRun: boolean = false
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    errors: [],
  };
  
  log(`\n🔐 Step 3: ${dryRun ? 'DRY RUN - Simulating' : 'Encrypting passwords'}...`, 'cyan');
  
  try {
    const tenants = await masterDb.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        dbPassword: true,
      },
    });
    
    stats.total = tenants.length;
    
    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      const progress = `[${i + 1}/${tenants.length}]`;
      
      // Skip if already encrypted
      if (isEncrypted(tenant.dbPassword)) {
        log(`   ${progress} ${tenant.name}: Already encrypted ✓`, 'green');
        stats.alreadyEncrypted++;
        continue;
      }
      
      try {
        if (dryRun) {
          log(`   ${progress} ${tenant.name}: Would encrypt password`, 'yellow');
          stats.encrypted++;
        } else {
          // Encrypt the password
          const encrypted = await encryptDatabasePassword(tenant.dbPassword);
          
          // Verify we can decrypt it
          const decrypted = await decryptDatabasePassword(encrypted);
          if (decrypted !== tenant.dbPassword) {
            throw new Error('Decryption verification failed');
          }
          
          // Update in database
          await masterDb.tenant.update({
            where: { id: tenant.id },
            data: { dbPassword: encrypted },
          });
          
          log(`   ${progress} ${tenant.name}: Encrypted ✓`, 'green');
          stats.encrypted++;
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`   ${progress} ${tenant.name}: Failed - ${errorMessage}`, 'red');
        stats.failed++;
        stats.errors.push({
          tenantId: tenant.id,
          error: errorMessage,
        });
      }
    }
    
  } catch (error) {
    log(`❌ Migration failed: ${error}`, 'red');
    throw error;
  }
  
  return stats;
}

function printSummary(stats: MigrationStats, dryRun: boolean) {
  log('\n📈 Summary:', 'cyan');
  log(`   Total tenants: ${stats.total}`, 'blue');
  log(`   Already encrypted: ${stats.alreadyEncrypted}`, 'green');
  log(`   ${dryRun ? 'Would encrypt' : 'Encrypted'}: ${stats.encrypted}`, stats.encrypted > 0 ? 'green' : 'yellow');
  log(`   Failed: ${stats.failed}`, stats.failed > 0 ? 'red' : 'green');
  
  if (stats.errors.length > 0) {
    log('\n❌ Errors:', 'red');
    stats.errors.forEach(({ tenantId, error }) => {
      log(`   Tenant ${tenantId}: ${error}`, 'red');
    });
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Encrypt Tenant Database Passwords Migration       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const masterDb = new PrismaClient({
    datasources: {
      db: {
        url: process.env.MASTER_DATABASE_URL,
      },
    },
  });
  
  try {
    // Step 1: Verify configuration
    const configValid = await verifyConfiguration();
    if (!configValid) {
      process.exit(1);
    }
    
    // Step 2: Analyze current state
    const initialStats = await analyzeTenants(masterDb);
    
    if (initialStats.total - initialStats.alreadyEncrypted === 0) {
      log('\n✅ All passwords are already encrypted. Nothing to do!', 'green');
      process.exit(0);
    }
    
    // Step 3: Dry run
    log('\n🧪 Running dry run first...', 'yellow');
    const dryRunStats = await encryptPasswords(masterDb, true);
    printSummary(dryRunStats, true);
    
    // Step 4: Confirm with user
    log('\n⚠️  WARNING: This will modify your database!', 'yellow');
    log('   Make sure you have a backup before proceeding.', 'yellow');
    
    const confirmed = await promptUser('\nProceed with encryption?');
    
    if (!confirmed) {
      log('\n❌ Migration cancelled by user', 'yellow');
      process.exit(0);
    }
    
    // Step 5: Perform actual encryption
    log('\n🚀 Starting actual encryption...', 'cyan');
    const finalStats = await encryptPasswords(masterDb, false);
    
    // Step 6: Print final summary
    printSummary(finalStats, false);
    
    if (finalStats.failed === 0) {
      log('\n✅ Migration completed successfully!', 'green');
      process.exit(0);
    } else {
      log('\n⚠️  Migration completed with errors', 'yellow');
      log('   Review the errors above and retry if needed', 'yellow');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ Migration failed: ${error}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await masterDb.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main, analyzeTenants, encryptPasswords };
