/**
 * Test Rate Limiting Setup
 * 
 * Quick validation script to verify rate limiting configuration
 * Run with: npx tsx scripts/test-rate-limiting.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getRedisClient, isRedisHealthy, closeRedis, getRedisStatus } from '@/lib/redis/client';
import { checkRateLimit, RATE_LIMITS, resetRateLimit } from '@/lib/security/rate-limiter';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testsRun = 0;
let testsPassed = 0;

async function testRedisConnection() {
  console.log(`\n${BLUE}[Test 1/7]${RESET} Redis Connection...`);
  
  try {
    const redis = getRedisClient();
    
    if (!redis) {
      console.log(`${YELLOW}⚠️  Redis client not available${RESET}`);
      console.log(`${YELLOW}    Checking if Redis is disabled...${RESET}`);
      
      if (process.env.REDIS_DISABLED === 'true') {
        console.log(`${YELLOW}    ✓ Redis is disabled (REDIS_DISABLED=true)${RESET}`);
        console.log(`${YELLOW}    Rate limiting will fail-open (allow all requests)${RESET}`);
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
      console.log(`   Connection attempts: ${status.attempts}`);
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

async function testBasicRateLimiting(redisHealthy: boolean) {
  console.log(`\n${BLUE}[Test 2/7]${RESET} Basic Rate Limiting...`);
  testsRun++;
  
  try {
    const identifier = `test-user-${Date.now()}`;
    const config = RATE_LIMITS.TENANT_LOGIN;
    
    // Reset first
    await resetRateLimit(identifier, config.keyPrefix);
    
    // Make first request
    const result = await checkRateLimit(identifier, config);
    
    if (result.allowed && result.remaining === config.limit - 1) {
      console.log(`${GREEN}✅ Rate limiting working correctly${RESET}`);
      console.log(`   Limit: ${result.limit}`);
      console.log(`   Remaining: ${result.remaining}`);
      console.log(`   Reset at: ${new Date(result.resetAt * 1000).toLocaleTimeString()}`);
      testsPassed++;
      
      // Cleanup
      await resetRateLimit(identifier, config.keyPrefix);
    } else if (!redisHealthy && result.allowed) {
      console.log(`${YELLOW}⚠️  Rate limiting in fail-open mode (Redis unavailable)${RESET}`);
      console.log(`   All requests will be allowed until Redis is available`);
      testsPassed++;
    } else {
      console.log(`${RED}❌ Rate limiting not working as expected${RESET}`);
      console.log(`   Result:`, result);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing rate limiting:${RESET}`, error);
  }
}

async function testRateLimitExceeded(redisHealthy: boolean) {
  console.log(`\n${BLUE}[Test 3/7]${RESET} Rate Limit Exceeded...`);
  testsRun++;
  
  if (!redisHealthy) {
    console.log(`${YELLOW}⚠️  Skipping (Redis unavailable)${RESET}`);
    return;
  }
  
  try {
    const identifier = `test-user-${Date.now()}`;
    const config = { ...RATE_LIMITS.TENANT_LOGIN, limit: 2 }; // Use small limit for quick test
    
    await resetRateLimit(identifier, config.keyPrefix);
    
    // Make requests up to limit
    await checkRateLimit(identifier, config);
    await checkRateLimit(identifier, config);
    
    // This should be blocked
    const result = await checkRateLimit(identifier, config);
    
    if (!result.allowed && result.remaining === 0) {
      console.log(`${GREEN}✅ Rate limit enforcement working${RESET}`);
      console.log(`   Blocked after ${config.limit} requests`);
      console.log(`   Retry after: ${result.retryAfter} seconds`);
      testsPassed++;
      
      // Cleanup
      await resetRateLimit(identifier, config.keyPrefix);
    } else {
      console.log(`${RED}❌ Rate limit not enforcing properly${RESET}`);
      console.log(`   Result:`, result);
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing rate limit exceeded:${RESET}`, error);
  }
}

async function testTenantLoginConfig() {
  console.log(`\n${BLUE}[Test 4/7]${RESET} Tenant Login Configuration...`);
  testsRun++;
  
  const config = RATE_LIMITS.TENANT_LOGIN;
  
  if (
    config.limit === 5 &&
    config.windowSeconds === 60 &&
    config.keyPrefix === 'ratelimit:tenant:login' &&
    config.failOpen === true
  ) {
    console.log(`${GREEN}✅ Tenant login rate limit configured correctly${RESET}`);
    console.log(`   Limit: ${config.limit} requests per ${config.windowSeconds}s`);
    console.log(`   Fail-open: ${config.failOpen}`);
    testsPassed++;
  } else {
    console.log(`${RED}❌ Tenant login config incorrect${RESET}`);
    console.log(`   Config:`, config);
  }
}

async function testPlatformLoginConfig() {
  console.log(`\n${BLUE}[Test 5/7]${RESET} Platform Login Configuration...`);
  testsRun++;
  
  const config = RATE_LIMITS.PLATFORM_LOGIN;
  
  if (
    config.limit === 3 &&
    config.windowSeconds === 60 &&
    config.keyPrefix === 'ratelimit:platform:login' &&
    config.failOpen === false
  ) {
    console.log(`${GREEN}✅ Platform login rate limit configured correctly${RESET}`);
    console.log(`   Limit: ${config.limit} requests per ${config.windowSeconds}s`);
    console.log(`   Fail-open: ${config.failOpen} (more secure)`);
    testsPassed++;
  } else {
    console.log(`${RED}❌ Platform login config incorrect${RESET}`);
    console.log(`   Config:`, config);
  }
}

async function testRegisterConfig() {
  console.log(`\n${BLUE}[Test 6/7]${RESET} Register Configuration...`);
  testsRun++;
  
  const config = RATE_LIMITS.TENANT_REGISTER;
  
  if (
    config.limit === 3 &&
    config.windowSeconds === 3600 &&
    config.keyPrefix === 'ratelimit:tenant:register'
  ) {
    console.log(`${GREEN}✅ Register rate limit configured correctly${RESET}`);
    console.log(`   Limit: ${config.limit} requests per ${config.windowSeconds}s (1 hour)`);
    testsPassed++;
  } else {
    console.log(`${RED}❌ Register config incorrect${RESET}`);
    console.log(`   Config:`, config);
  }
}

async function testEnvironmentVariables() {
  console.log(`\n${BLUE}[Test 7/7]${RESET} Environment Variables...`);
  testsRun++;
  
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  const redisDisabled = process.env.REDIS_DISABLED;
  
  if (redisDisabled === 'true') {
    console.log(`${YELLOW}⚠️  Redis is disabled${RESET}`);
    console.log(`   REDIS_DISABLED=true`);
    console.log(`   Rate limiting will fail-open (allow all requests)`);
    testsPassed++;
  } else if (redisHost && redisPort) {
    console.log(`${GREEN}✅ Redis environment variables configured${RESET}`);
    console.log(`   REDIS_HOST: ${redisHost}`);
    console.log(`   REDIS_PORT: ${redisPort}`);
    console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'}`);
    testsPassed++;
  } else {
    console.log(`${RED}❌ Redis environment variables missing${RESET}`);
    console.log(`   REDIS_HOST: ${redisHost || '[NOT SET]'}`);
    console.log(`   REDIS_PORT: ${redisPort || '[NOT SET]'}`);
    console.log(`\n${YELLOW}To enable rate limiting:${RESET}`);
    console.log(`   1. Add to .env.local:`);
    console.log(`      REDIS_HOST=localhost`);
    console.log(`      REDIS_PORT=6379`);
    console.log(`      REDIS_PASSWORD=your-password  # Optional`);
    console.log(`\n   2. Or disable rate limiting:`);
    console.log(`      REDIS_DISABLED=true`);
  }
}

async function main() {
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}🧪 Rate Limiting Setup Test${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  
  const redisHealthy = await testRedisConnection();
  await testBasicRateLimiting(redisHealthy);
  await testRateLimitExceeded(redisHealthy);
  await testTenantLoginConfig();
  await testPlatformLoginConfig();
  await testRegisterConfig();
  await testEnvironmentVariables();
  
  // Print summary
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}📊 Test Summary${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  const passRate = testsRun > 0 ? ((testsPassed / testsRun) * 100).toFixed(1) : '0.0';
  
  console.log(`Tests Passed: ${GREEN}${testsPassed}/${testsRun}${RESET} (${passRate}%)`);
  
  if (testsPassed === testsRun) {
    console.log(`\n${GREEN}✅ All tests passed!${RESET}`);
    console.log(`   Rate limiting is ready for production\n`);
  } else {
    console.log(`\n${YELLOW}⚠️  Some tests failed or were skipped${RESET}`);
    
    if (!redisHealthy) {
      console.log(`\n${YELLOW}📝 Next Steps:${RESET}`);
      console.log(`   1. Install Redis locally: brew install redis (macOS)`);
      console.log(`   2. Start Redis: redis-server`);
      console.log(`   3. Or use Redis Cloud/Upstash for production`);
      console.log(`   4. Add Redis config to .env.local (see above)`);
      console.log(`   5. Re-run this test: npx tsx scripts/test-rate-limiting.ts\n`);
    }
  }
  
  // Cleanup
  await closeRedis();
}

main().catch((error) => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});
