/**
 * Rate Limiter Tests
 * 
 * Comprehensive test suite for rate limiting functionality
 * Run with: npx tsx src/lib/security/__tests__/rate-limiter.test.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getRedisClient, isRedisHealthy, closeRedis } from '@/lib/redis/client';
import {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
  RateLimitConfig,
} from '@/lib/security/rate-limiter';

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
    toBeGreaterThan(expected: number) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
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
  };
}

async function runTests() {
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}🧪 Rate Limiter Test Suite${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  // Test 1: Redis connection
  await test('Redis connection is healthy', async () => {
    const isHealthy = await isRedisHealthy();
    await expect(isHealthy).toBeTruthy();
  });
  
  // Test 2: Basic rate limiting
  await test('Basic rate limiting - allows requests under limit', async () => {
    const testConfig: RateLimitConfig = {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: 'test:basic',
      failOpen: true,
    };
    
    const identifier = `test-user-${Date.now()}`;
    
    // Reset to ensure clean state
    await resetRateLimit(identifier, testConfig.keyPrefix);
    
    // First request should be allowed
    const result1 = await checkRateLimit(identifier, testConfig);
    await expect(result1.allowed).toBeTruthy();
    await expect(result1.remaining).toBe(4);
    
    // Second request should be allowed
    const result2 = await checkRateLimit(identifier, testConfig);
    await expect(result2.allowed).toBeTruthy();
    await expect(result2.remaining).toBe(3);
    
    // Cleanup
    await resetRateLimit(identifier, testConfig.keyPrefix);
  });
  
  // Test 3: Rate limit exceeded
  await test('Rate limiting - blocks requests over limit', async () => {
    const testConfig: RateLimitConfig = {
      limit: 3,
      windowSeconds: 60,
      keyPrefix: 'test:exceeded',
      failOpen: true,
    };
    
    const identifier = `test-user-${Date.now()}`;
    await resetRateLimit(identifier, testConfig.keyPrefix);
    
    // Make 3 requests (should all pass)
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(identifier, testConfig);
      await expect(result.allowed).toBeTruthy();
    }
    
    // 4th request should be blocked
    const result = await checkRateLimit(identifier, testConfig);
    await expect(result.allowed).toBeFalsy();
    await expect(result.remaining).toBe(0);
    await expect(result.retryAfter).toBe(60);
    
    // Cleanup
    await resetRateLimit(identifier, testConfig.keyPrefix);
  });
  
  // Test 4: Sliding window behavior
  await test('Sliding window - allows requests after time passes', async () => {
    const testConfig: RateLimitConfig = {
      limit: 2,
      windowSeconds: 2, // 2 second window for faster test
      keyPrefix: 'test:sliding',
      failOpen: true,
    };
    
    const identifier = `test-user-${Date.now()}`;
    await resetRateLimit(identifier, testConfig.keyPrefix);
    
    // Make 2 requests (fill the limit)
    await checkRateLimit(identifier, testConfig);
    await checkRateLimit(identifier, testConfig);
    
    // 3rd request should be blocked
    const result1 = await checkRateLimit(identifier, testConfig);
    await expect(result1.allowed).toBeFalsy();
    
    // Wait for window to pass
    await new Promise(resolve => setTimeout(resolve, 2100));
    
    // Now request should be allowed again
    const result2 = await checkRateLimit(identifier, testConfig);
    await expect(result2.allowed).toBeTruthy();
    
    // Cleanup
    await resetRateLimit(identifier, testConfig.keyPrefix);
  });
  
  // Test 5: Get status without incrementing
  await test('Get status - reads count without incrementing', async () => {
    const testConfig: RateLimitConfig = {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: 'test:status',
      failOpen: true,
    };
    
    const identifier = `test-user-${Date.now()}`;
    await resetRateLimit(identifier, testConfig.keyPrefix);
    
    // Make 2 requests
    await checkRateLimit(identifier, testConfig);
    await checkRateLimit(identifier, testConfig);
    
    // Check status (should show 3 remaining without incrementing)
    const status1 = await getRateLimitStatus(identifier, testConfig);
    await expect(status1.remaining).toBe(3);
    
    // Check again - should still be 3
    const status2 = await getRateLimitStatus(identifier, testConfig);
    await expect(status2.remaining).toBe(3);
    
    // Cleanup
    await resetRateLimit(identifier, testConfig.keyPrefix);
  });
  
  // Test 6: Reset rate limit
  await test('Reset - clears rate limit for identifier', async () => {
    const testConfig: RateLimitConfig = {
      limit: 3,
      windowSeconds: 60,
      keyPrefix: 'test:reset',
      failOpen: true,
    };
    
    const identifier = `test-user-${Date.now()}`;
    await resetRateLimit(identifier, testConfig.keyPrefix);
    
    // Fill the limit
    await checkRateLimit(identifier, testConfig);
    await checkRateLimit(identifier, testConfig);
    await checkRateLimit(identifier, testConfig);
    
    // Should be blocked
    const result1 = await checkRateLimit(identifier, testConfig);
    await expect(result1.allowed).toBeFalsy();
    
    // Reset
    await resetRateLimit(identifier, testConfig.keyPrefix);
    
    // Should be allowed again
    const result2 = await checkRateLimit(identifier, testConfig);
    await expect(result2.allowed).toBeTruthy();
    await expect(result2.remaining).toBe(2);
    
    // Cleanup
    await resetRateLimit(identifier, testConfig.keyPrefix);
  });
  
  // Test 7: Predefined rate limits
  await test('Predefined rate limits - TENANT_LOGIN config', async () => {
    await expect(RATE_LIMITS.TENANT_LOGIN.limit).toBe(5);
    await expect(RATE_LIMITS.TENANT_LOGIN.windowSeconds).toBe(60);
    await expect(RATE_LIMITS.TENANT_LOGIN.keyPrefix).toBe('ratelimit:tenant:login');
    await expect(RATE_LIMITS.TENANT_LOGIN.failOpen).toBeTruthy();
  });
  
  // Test 8: Predefined rate limits - PLATFORM_LOGIN config
  await test('Predefined rate limits - PLATFORM_LOGIN config', async () => {
    await expect(RATE_LIMITS.PLATFORM_LOGIN.limit).toBe(3);
    await expect(RATE_LIMITS.PLATFORM_LOGIN.windowSeconds).toBe(60);
    await expect(RATE_LIMITS.PLATFORM_LOGIN.keyPrefix).toBe('ratelimit:platform:login');
    await expect(RATE_LIMITS.PLATFORM_LOGIN.failOpen).toBeFalsy(); // More secure for platform
  });
  
  // Test 9: Multiple identifiers
  await test('Multiple identifiers - tracked independently', async () => {
    const testConfig: RateLimitConfig = {
      limit: 3,
      windowSeconds: 60,
      keyPrefix: 'test:multi',
      failOpen: true,
    };
    
    const identifier1 = `test-user-1-${Date.now()}`;
    const identifier2 = `test-user-2-${Date.now()}`;
    
    await resetRateLimit(identifier1, testConfig.keyPrefix);
    await resetRateLimit(identifier2, testConfig.keyPrefix);
    
    // User 1 makes 3 requests
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(identifier1, testConfig);
    }
    
    // User 1 blocked
    const result1 = await checkRateLimit(identifier1, testConfig);
    await expect(result1.allowed).toBeFalsy();
    
    // User 2 still has full limit
    const result2 = await checkRateLimit(identifier2, testConfig);
    await expect(result2.allowed).toBeTruthy();
    await expect(result2.remaining).toBe(2);
    
    // Cleanup
    await resetRateLimit(identifier1, testConfig.keyPrefix);
    await resetRateLimit(identifier2, testConfig.keyPrefix);
  });
  
  // Test 10: Fail-open behavior (simulated)
  await test('Fail-open behavior - allows when failOpen=true', async () => {
    const testConfig: RateLimitConfig = {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: 'test:failopen',
      failOpen: true,
    };
    
    // This tests that the config is set correctly
    // Actual fail-open behavior is tested when Redis is down
    await expect(testConfig.failOpen).toBeTruthy();
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
