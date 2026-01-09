/**
 * Idempotency Tests
 * 
 * Comprehensive test suite for idempotency functionality
 * Run with: npx tsx src/lib/security/__tests__/idempotency.test.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, closeRedis } from '@/lib/redis/client';
import {
  getIdempotencyKey,
  validateIdempotencyKey,
  checkIdempotency,
  cacheResponse,
  deleteIdempotencyCache,
  generateIdempotencyKey,
  IDEMPOTENCY_CONFIGS,
} from '@/lib/security/idempotency';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => Promise<void>) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`${GREEN}✓${RESET} ${name}`);
  } catch (error) {
    testsFailed++;
    console.log(`${RED}✗${RESET} ${name}`);
    console.log(`  ${RED}${error}${RESET}`);
  }
}

async function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
  };
}

// Helper to create mock NextRequest
function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: new Headers(headers),
  });
}

async function runTests() {
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}🧪 Idempotency Test Suite${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  // Test 1: Extract idempotency key from standard header
  await test('Extract idempotency key - standard header', async () => {
    const request = createMockRequest({
      'idempotency-key': 'test-key-12345678',
    });
    
    const key = getIdempotencyKey(request);
    await expect(key).toBe('test-key-12345678');
  });
  
  // Test 2: Extract from alternative headers
  await test('Extract idempotency key - alternative header', async () => {
    const request = createMockRequest({
      'x-idempotency-key': 'test-key-alternative',
    });
    
    const key = getIdempotencyKey(request);
    await expect(key).toBe('test-key-alternative');
  });
  
  // Test 3: No idempotency key provided
  await test('Extract idempotency key - missing', async () => {
    const request = createMockRequest({});
    
    const key = getIdempotencyKey(request);
    await expect(key).toBeNull();
  });
  
  // Test 4: Validate valid key format
  await test('Validate idempotency key - valid format', async () => {
    const validKeys = [
      'abcdef1234567890', // 16 chars minimum
      'valid-key-with-dashes-1234567890',
      'valid_key_with_underscores_1234567890',
      'MixedCaseKey1234567890',
      '12345678-1234-1234-1234-123456789012', // UUID format
    ];
    
    for (const key of validKeys) {
      const isValid = validateIdempotencyKey(key);
      if (!isValid) {
        throw new Error(`Key "${key}" should be valid but was rejected`);
      }
    }
  });
  
  // Test 5: Validate invalid key formats
  await test('Validate idempotency key - invalid formats', async () => {
    const invalidKeys = [
      'short', // Too short (< 16 chars)
      'a'.repeat(65), // Too long (> 64 chars)
      'invalid key with spaces',
      'invalid@key#with$special%chars',
      '', // Empty
    ];
    
    for (const key of invalidKeys) {
      const isValid = validateIdempotencyKey(key);
      if (isValid) {
        throw new Error(`Key "${key}" should be invalid but was accepted`);
      }
    }
  });
  
  // Test 6: Generate idempotency key
  await test('Generate idempotency key', async () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    
    // Keys should be different
    if (key1 === key2) {
      throw new Error('Generated keys should be unique');
    }
    
    // Keys should be valid format
    await expect(validateIdempotencyKey(key1)).toBeTruthy();
    await expect(validateIdempotencyKey(key2)).toBeTruthy();
  });
  
  // Test 7: Check idempotency - not found
  await test('Check idempotency - key not found', async () => {
    const redis = getRedisClient();
    
    if (!redis) {
      console.log(`  ${YELLOW}⚠️  Skipped (Redis unavailable)${RESET}`);
      return;
    }
    
    const testKey = `test-key-${Date.now()}`;
    const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
    
    // Ensure key doesn't exist
    await deleteIdempotencyCache(testKey, config.keyPrefix);
    
    const cached = await checkIdempotency(testKey, config);
    await expect(cached).toBeNull();
  });
  
  // Test 8: Cache and retrieve response
  await test('Cache and retrieve response', async () => {
    const redis = getRedisClient();
    
    if (!redis) {
      console.log(`  ${YELLOW}⚠️  Skipped (Redis unavailable)${RESET}`);
      return;
    }
    
    const testKey = `test-key-${Date.now()}`;
    const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
    
    // Create mock response
    const mockResponse = NextResponse.json(
      { success: true, data: { id: '123' } },
      { status: 201 }
    );
    
    // Cache response
    await cacheResponse(testKey, mockResponse, config);
    
    // Retrieve cached response
    const cached = await checkIdempotency(testKey, config);
    
    await expect(cached).toBeTruthy();
    await expect(cached?.status).toBe(201);
    await expect(cached?.body.success).toBeTruthy();
    await expect(cached?.body.data.id).toBe('123');
    
    // Cleanup
    await deleteIdempotencyCache(testKey, config.keyPrefix);
  });
  
  // Test 9: TTL expiration
  await test('Cache TTL configuration', async () => {
    const redis = getRedisClient();
    
    if (!redis) {
      console.log(`  ${YELLOW}⚠️  Skipped (Redis unavailable)${RESET}`);
      return;
    }
    
    const testKey = `test-key-ttl-${Date.now()}`;
    const config = {
      ...IDEMPOTENCY_CONFIGS.TENANT_CREATE,
      ttlSeconds: 2, // 2 second TTL for testing
    };
    
    // Cache response
    const mockResponse = NextResponse.json({ success: true });
    await cacheResponse(testKey, mockResponse, config);
    
    // Should be cached immediately
    const cached1 = await checkIdempotency(testKey, config);
    await expect(cached1).toBeTruthy();
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 2100));
    
    // Should be expired
    const cached2 = await checkIdempotency(testKey, config);
    await expect(cached2).toBeNull();
  });
  
  // Test 10: Predefined config - TENANT_CREATE
  await test('Predefined config - TENANT_CREATE', async () => {
    const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
    
    await expect(config.ttlSeconds).toBe(86400); // 24 hours
    await expect(config.keyPrefix).toBe('idempotency:tenant:create');
    await expect(config.failOpen).toBeFalsy(); // Strict for tenant creation
  });
  
  // Test 11: Predefined config - PAYMENT_PROCESS
  await test('Predefined config - PAYMENT_PROCESS', async () => {
    const config = IDEMPOTENCY_CONFIGS.PAYMENT_PROCESS;
    
    await expect(config.ttlSeconds).toBe(259200); // 72 hours
    await expect(config.keyPrefix).toBe('idempotency:payment:process');
    await expect(config.failOpen).toBeFalsy(); // Strict for payments
  });
  
  // Test 12: Delete cache
  await test('Delete cached response', async () => {
    const redis = getRedisClient();
    
    if (!redis) {
      console.log(`  ${YELLOW}⚠️  Skipped (Redis unavailable)${RESET}`);
      return;
    }
    
    const testKey = `test-key-delete-${Date.now()}`;
    const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
    
    // Cache response
    const mockResponse = NextResponse.json({ success: true });
    await cacheResponse(testKey, mockResponse, config);
    
    // Verify cached
    const cached1 = await checkIdempotency(testKey, config);
    await expect(cached1).toBeTruthy();
    
    // Delete
    await deleteIdempotencyCache(testKey, config.keyPrefix);
    
    // Verify deleted
    const cached2 = await checkIdempotency(testKey, config);
    await expect(cached2).toBeNull();
  });
  
  // Print results
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}📊 Test Results${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  console.log(`Total Tests: ${testsRun}`);
  console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
  console.log(`${RED}Failed: ${testsFailed}${RESET}`);
  
  const passRate = testsRun > 0 ? ((testsPassed / testsRun) * 100).toFixed(1) : '0.0';
  console.log(`Pass Rate: ${testsFailed === 0 ? GREEN : RED}${passRate}%${RESET}\n`);
  
  if (testsFailed === 0) {
    console.log(`${GREEN}✅ All tests passed!${RESET}\n`);
  } else {
    console.log(`${RED}❌ Some tests failed. Review errors above.${RESET}\n`);
  }
  
  // Cleanup
  await closeRedis();
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${RED}Fatal error running tests:${RESET}`, error);
  process.exit(1);
});
