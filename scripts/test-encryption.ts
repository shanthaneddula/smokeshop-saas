#!/usr/bin/env tsx
/**
 * Test Encryption Setup
 * 
 * Verifies that database password encryption is properly configured
 * 
 * Usage: npx tsx scripts/test-encryption.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import {
  testEncryption,
  generateEncryptionKey,
  encryptDatabasePassword,
  decryptDatabasePassword,
  isEncrypted,
  maskPassword,
} from '../src/lib/security/encryption';

// ANSI colors
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

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        Database Password Encryption Test Suite        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Check if encryption key is set
  log('Test 1: Checking encryption key configuration...', 'cyan');
  if (process.env.DB_PASSWORD_ENCRYPTION_KEY) {
    const key = process.env.DB_PASSWORD_ENCRYPTION_KEY;
    if (key.length === 64 && /^[0-9a-fA-F]{64}$/.test(key)) {
      log('✅ Encryption key is properly configured (64-char hex)', 'green');
      passed++;
    } else {
      log('❌ Encryption key format is invalid', 'red');
      log(`   Expected: 64-character hex string`, 'yellow');
      log(`   Got: ${key.length} characters`, 'yellow');
      failed++;
    }
  } else {
    log('❌ DB_PASSWORD_ENCRYPTION_KEY environment variable not set', 'red');
    log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"', 'yellow');
    failed++;
  }
  
  // Test 2: Basic encryption/decryption
  log('\nTest 2: Testing basic encryption/decryption...', 'cyan');
  try {
    const result = await testEncryption();
    if (result) {
      log('✅ Encryption/decryption roundtrip successful', 'green');
      passed++;
    } else {
      log('❌ Encryption/decryption roundtrip failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`❌ Encryption test threw error: ${error}`, 'red');
    failed++;
  }
  
  // Test 3: Encrypt sample password
  log('\nTest 3: Testing sample password encryption...', 'cyan');
  try {
    const samplePassword = 'myTestPassword123!@#';
    const encrypted = await encryptDatabasePassword(samplePassword);
    
    log(`   Plain text: ${maskPassword(samplePassword)}`, 'yellow');
    log(`   Encrypted (first 50 chars): ${encrypted.substring(0, 50)}...`, 'yellow');
    
    if (encrypted !== samplePassword && encrypted.includes(':')) {
      log('✅ Password encryption successful', 'green');
      passed++;
    } else {
      log('❌ Encrypted password looks suspicious', 'red');
      failed++;
    }
  } catch (error) {
    log(`❌ Sample encryption failed: ${error}`, 'red');
    failed++;
  }
  
  // Test 4: Test isEncrypted detection
  log('\nTest 4: Testing encrypted password detection...', 'cyan');
  try {
    const plainPassword = 'notEncrypted';
    const encryptedPassword = await encryptDatabasePassword(plainPassword);
    
    const plainDetection = isEncrypted(plainPassword);
    const encryptedDetection = isEncrypted(encryptedPassword);
    
    if (!plainDetection && encryptedDetection) {
      log('✅ Encrypted password detection works correctly', 'green');
      passed++;
    } else {
      log(`❌ Detection failed: plain=${plainDetection}, encrypted=${encryptedDetection}`, 'red');
      failed++;
    }
  } catch (error) {
    log(`❌ Detection test failed: ${error}`, 'red');
    failed++;
  }
  
  // Test 5: Test special characters
  log('\nTest 5: Testing special characters handling...', 'cyan');
  try {
    const specialPassword = 'p@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
    const encrypted = await encryptDatabasePassword(specialPassword);
    const decrypted = await decryptDatabasePassword(encrypted);
    
    if (decrypted === specialPassword) {
      log('✅ Special characters handled correctly', 'green');
      passed++;
    } else {
      log('❌ Special characters not preserved', 'red');
      log(`   Expected: ${maskPassword(specialPassword)}`, 'yellow');
      log(`   Got: ${maskPassword(decrypted)}`, 'yellow');
      failed++;
    }
  } catch (error) {
    log(`❌ Special characters test failed: ${error}`, 'red');
    failed++;
  }
  
  // Test 6: Test unicode characters
  log('\nTest 6: Testing unicode characters...', 'cyan');
  try {
    const unicodePassword = 'пароль密码🔒';
    const encrypted = await encryptDatabasePassword(unicodePassword);
    const decrypted = await decryptDatabasePassword(encrypted);
    
    if (decrypted === unicodePassword) {
      log('✅ Unicode characters handled correctly', 'green');
      passed++;
    } else {
      log('❌ Unicode characters not preserved', 'red');
      failed++;
    }
  } catch (error) {
    log(`❌ Unicode test failed: ${error}`, 'red');
    failed++;
  }
  
  // Test 7: Test unique encryption (same password, different output)
  log('\nTest 7: Testing encryption uniqueness...', 'cyan');
  try {
    const password = 'samePassword';
    const encrypted1 = await encryptDatabasePassword(password);
    const encrypted2 = await encryptDatabasePassword(password);
    
    if (encrypted1 !== encrypted2) {
      log('✅ Each encryption produces unique output (different IVs)', 'green');
      passed++;
    } else {
      log('❌ Encryption is not unique (security risk!)', 'red');
      failed++;
    }
  } catch (error) {
    log(`❌ Uniqueness test failed: ${error}`, 'red');
    failed++;
  }
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                       SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const total = passed + failed;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  
  log(`Tests Passed: ${passed}/${total} (${percentage}%)`, passed === total ? 'green' : 'yellow');
  log(`Tests Failed: ${failed}/${total}`, failed === 0 ? 'green' : 'red');
  
  if (failed === 0) {
    log('\n✅ All tests passed! Encryption is properly configured.', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Run: npx tsx scripts/encrypt-tenant-passwords.ts', 'yellow');
    log('2. Deploy encryption key to production (Vercel env vars)', 'yellow');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed. Please fix configuration before proceeding.', 'red');
    log('\nTroubleshooting:', 'cyan');
    log('1. Ensure DB_PASSWORD_ENCRYPTION_KEY is set in .env.local', 'yellow');
    log('2. Key must be 64-character hex string', 'yellow');
    log('3. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"', 'yellow');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Test suite crashed: ${error}`, 'red');
  console.error(error);
  process.exit(1);
});
