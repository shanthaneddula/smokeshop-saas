/**
 * Test Idempotency Setup
 * 
 * Quick validation script to verify idempotency configuration
 * Run with: npx tsx scripts/test-idempotency.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getRedisClient, isRedisHealthy, closeRedis, getRedisStatus } from '@/lib/redis/client';
import {
  generateIdempotencyKey,
  validateIdempotencyKey,
  checkIdempotency,
  cacheResponse,
  deleteIdempotencyCache,
  IDEMPOTENCY_CONFIGS,
} from '@/lib/security/idempotency';
import { NextResponse } from 'next/server';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testsRun = 0;
let testsPassed = 0;

async function testRedisConnection() {
  console.log(`\n${BLUE}[Test 1/8]${RESET} Redis Connection...`);
  
  try {
    const redis = getRedisClient();
    
    if (!redis) {
      console.log(`${YELLOW}⚠️  Redis client not available${RESET}`);
      console.log(`${YELLOW}    Checking if Redis is disabled...${RESET}`);
      
      if (process.env.REDIS_DISABLED === 'true') {
        console.log(`${YELLOW}    ✓ Redis is disabled (REDIS_DISABLED=true)${RESET}`);
        console.log(`${YELLOW}    Idempotency will fail-open (no caching)${RESET}`);
        return false;
      } else {
        console.log(`${RED}    ✗ Redis not configured properly${RESET}`);
        console.log(`${RED}    Set REDIS_HOST, REDIS_PORT, and optionally REDIS_PASSWORD${RESET}`);
        return false;
      }
    }
    
    const isHealthy = await isRedisHealthy();
    
    if (isHealthy) {
      console.log(`${GREEN}✅ Redis is connected and healthy${RESET}`);
      const status = getRedisStatus();
      console.log(`   Status: ${status.status}`);
      testsRun++;
      testsPassed++;
      return true;
    } else {
      console.log(`${RED}❌ Redis connection failed${RESET}`);
      console.log(`${YELLOW}   Check Redis configuration in .env.local${RESET}`);
      testsRun++;
      return false;
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing Redis connection:${RESET}`, error);
    testsRun++;
    return false;
  }
}

async function testKeyGeneration() {
  console.log(`\n${BLUE}[Test 2/8]${RESET} Idempotency Key Generation...`);
  testsRun++;
  
  try {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    
    if (key1 !== key2 && validateIdempotencyKey(key1) && validateIdempotencyKey(key2)) {
      console.log(`${GREEN}✅ Key generation working correctly${RESET}`);
      console.log(`   Sample key: ${key1}`);
      console.log(`   Length: ${key1.length} characters`);
      testsPassed++;
    } else {
      console.log(`${RED}❌ Key generation not working properly${RESET}`);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing key generation:${RESET}`, error);
  }
}

async function testKeyValidation() {
  console.log(`\n${BLUE}[Test 3/8]${RESET} Key Validation...`);
  testsRun++;
  
  try {
    const validKeys = [
      'abcdef1234567890',
      '12345678-1234-1234-1234-123456789012',
      'valid-key-with-dashes-1234567890',
    ];
    
    const invalidKeys = [
      'short',
      'invalid key with spaces',
      'a'.repeat(65),
    ];
    
    let allValid = true;
    
    for (const key of validKeys) {
      if (!validateIdempotencyKey(key)) {
        console.log(`${RED}   ✗ Valid key rejected: ${key}${RESET}`);
        allValid = false;
      }
    }
    
    for (const key of invalidKeys) {
      if (validateIdempotencyKey(key)) {
        console.log(`${RED}   ✗ Invalid key accepted: ${key}${RESET}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log(`${GREEN}✅ Key validation working correctly${RESET}`);
      console.log(`   Valid formats: UUID, alphanumeric with dashes/underscores`);
      console.log(`   Length: 16-64 characters`);
      testsPassed++;
    } else {
      console.log(`${RED}❌ Key validation has issues${RESET}`);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing key validation:${RESET}`, error);
  }
}

async function testCachingAndRetrieval(redisHealthy: boolean) {
  console.log(`\n${BLUE}[Test 4/8]${RESET} Caching and Retrieval...`);
  testsRun++;
  
  if (!redisHealthy) {
    console.log(`${YELLOW}⚠️  Skipping (Redis unavailable)${RESET}`);
    return;
  }
  
  try {
    const testKey = generateIdempotencyKey();
    const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
    
    // Create mock response
    const mockResponse = NextResponse.json(
      { success: true, data: { id: '123', name: 'Test Tenant' } },
      { status: 201 }
    );
    
    // Cache response
    await cacheResponse(testKey, mockResponse, config);
    
    // Retrieve cached response
    const cached = await checkIdempotency(testKey, config);
    
    if (cached && cached.status === 201 && cached.body.success) {
      console.log(`${GREEN}✅ Caching and retrieval working${RESET}`);
      console.log(`   Status: ${cached.status}`);
      console.log(`   Body: ${JSON.stringify(cached.body).slice(0, 50)}...`);
      console.log(`   Cached at: ${new Date(cached.cachedAt * 1000).toLocaleString()}`);
      testsPassed++;
      
      // Cleanup
      await deleteIdempotencyCache(testKey, config.keyPrefix);
    } else {
      console.log(`${RED}❌ Caching or retrieval failed${RESET}`);
      console.log(`   Cached:`, cached);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing caching:${RESET}`, error);
  }
}

async function testTTL(redisHealthy: boolean) {
  console.log(`\n${BLUE}[Test 5/8]${RESET} TTL (Time To Live)...`);
  testsRun++;
  
  if (!redisHealthy) {
    console.log(`${YELLOW}⚠️  Skipping (Redis unavailable)${RESET}`);
    return;
  }
  
  try {
    const testKey = generateIdempotencyKey();
    const config = {
      ...IDEMPOTENCY_CONFIGS.TENANT_CREATE,
      ttlSeconds: 2, // 2 second TTL for quick test
    };
    
    // Cache response
    const mockResponse = NextResponse.json({ success: true });
    await cacheResponse(testKey, mockResponse, config);
    
    // Should be cached immediately
    const cached1 = await checkIdempotency(testKey, config);
    
    if (!cached1) {
      console.log(`${RED}❌ Response not cached${RESET}`);
      return;
    }
    
    console.log(`${YELLOW}⏳ Waiting 2 seconds for TTL expiration...${RESET}`);
    await new Promise(resolve => setTimeout(resolve, 2100));
    
    // Should be expired
    const cached2 = await checkIdempotency(testKey, config);
    
    if (!cached2) {
      console.log(`${GREEN}✅ TTL expiration working correctly${RESET}`);
      console.log(`   Cache expired after 2 seconds as expected`);
      testsPassed++;
    } else {
      console.log(`${RED}❌ Cache did not expire${RESET}`);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing TTL:${RESET}`, error);
  }
}

async function testTenantCreateConfig() {
  console.log(`\n${BLUE}[Test 6/8]${RESET} Tenant Create Configuration...`);
  testsRun++;
  
  const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
  
  if (
    config.ttlSeconds === 86400 &&
    config.keyPrefix === 'idempotency:tenant:create' &&
    config.failOpen === false
  ) {
    console.log(`${GREEN}✅ Tenant create config correct${RESET}`);
    console.log(`   TTL: ${config.ttlSeconds}s (24 hours)`);
    console.log(`   Fail-open: ${config.failOpen} (strict - prevents duplicates)`);
    testsPassed++;
  } else {
    console.log(`${RED}❌ Tenant create config incorrect${RESET}`);
    console.log(`   Config:`, config);
  }
}

async function testPaymentConfig() {
  console.log(`\n${BLUE}[Test 7/8]${RESET} Payment Processing Configuration...`);
  testsRun++;
  
  const config = IDEMPOTENCY_CONFIGS.PAYMENT_PROCESS;
  
  if (
    config.ttlSeconds === 259200 &&
    config.keyPrefix === 'idempotency:payment:process' &&
    config.failOpen === false
  ) {
    console.log(`${GREEN}✅ Payment processing config correct${RESET}`);
    console.log(`   TTL: ${config.ttlSeconds}s (72 hours - longer for financial ops)`);
    console.log(`   Fail-open: ${config.failOpen} (strict - prevents double charges)`);
    testsPassed++;
  } else {
    console.log(`${RED}❌ Payment processing config incorrect${RESET}`);
    console.log(`   Config:`, config);
  }
}

async function testMultipleRequests(redisHealthy: boolean) {
  console.log(`\n${BLUE}[Test 8/8]${RESET} Idempotency Enforcement (Same Key)...`);
  testsRun++;
  
  if (!redisHealthy) {
    console.log(`${YELLOW}⚠️  Skipping (Redis unavailable)${RESET}`);
    return;
  }
  
  try {
    const testKey = generateIdempotencyKey();
    const config = IDEMPOTENCY_CONFIGS.TENANT_CREATE;
    
    // First request - should cache
    const response1 = NextResponse.json(
      { success: true, tenant: { id: '123', name: 'First Request' } },
      { status: 201 }
    );
    await cacheResponse(testKey, response1, config);
    
    // Second request with same key - should return cached
    const cached = await checkIdempotency(testKey, config);
    
    if (cached && cached.body.tenant.name === 'First Request') {
      console.log(`${GREEN}✅ Idempotency enforcement working${RESET}`);
      console.log(`   Same key returns cached response (prevents duplicate)`);
      console.log(`   Original data: ${cached.body.tenant.name}`);
      testsPassed++;
      
      // Cleanup
      await deleteIdempotencyCache(testKey, config.keyPrefix);
    } else {
      console.log(`${RED}❌ Idempotency not enforcing properly${RESET}`);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing idempotency enforcement:${RESET}`, error);
  }
}

async function main() {
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}🧪 Idempotency Setup Test${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  
  const redisHealthy = await testRedisConnection();
  await testKeyGeneration();
  await testKeyValidation();
  await testCachingAndRetrieval(redisHealthy);
  await testTTL(redisHealthy);
  await testTenantCreateConfig();
  await testPaymentConfig();
  await testMultipleRequests(redisHealthy);
  
  // Print summary
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}📊 Test Summary${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  const passRate = testsRun > 0 ? ((testsPassed / testsRun) * 100).toFixed(1) : '0.0';
  
  console.log(`Tests Passed: ${GREEN}${testsPassed}/${testsRun}${RESET} (${passRate}%)`);
  
  if (testsPassed === testsRun) {
    console.log(`\n${GREEN}✅ All tests passed!${RESET}`);
    console.log(`   Idempotency is ready for production\n`);
  } else {
    console.log(`\n${YELLOW}⚠️  Some tests failed or were skipped${RESET}`);
    
    if (!redisHealthy) {
      console.log(`\n${YELLOW}📝 Next Steps:${RESET}`);
      console.log(`   1. Idempotency works without Redis (no caching)`);
      console.log(`   2. For full protection, enable Redis:`);
      console.log(`      - Install: brew install redis (macOS)`);
      console.log(`      - Start: redis-server`);
      console.log(`      - Or use Redis Cloud/Upstash`);
      console.log(`   3. Update .env.local with Redis config`);
      console.log(`   4. Re-run: npx tsx scripts/test-idempotency.ts\n`);
    }
  }
  
  // Cleanup
  await closeRedis();
}

main().catch((error) => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});
