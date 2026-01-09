# Rate Limiting Setup Guide

## Overview

Production-grade rate limiting implementation using Redis with sliding window algorithm. Protects authentication endpoints from brute force attacks and API abuse.

## Architecture

**Components**:
- **Redis Client** (`src/lib/redis/client.ts`) - Singleton client with connection pooling, health checking, and retry logic
- **Rate Limiter** (`src/lib/security/rate-limiter.ts`) - Sliding window algorithm, configurable limits, graceful degradation
- **Middleware** (`src/lib/security/rate-limit-middleware.ts`) - Express-style middleware for Next.js API routes

**Algorithm**: Sliding Window
- Uses Redis sorted sets (ZSET) for time-based request tracking
- Atomic operations via Redis pipelines
- Automatic cleanup of expired entries
- More accurate than fixed window (no burst at window boundaries)

## Quick Start

### 1. Install Redis

**macOS (Homebrew)**:
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Docker**:
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

**Production (Recommended)**:
- [Upstash](https://upstash.com/) - Serverless Redis (free tier available)
- [Redis Cloud](https://redis.com/try-free/) - Managed Redis
- [AWS ElastiCache](https://aws.amazon.com/elasticache/) - AWS managed Redis

### 2. Configure Environment

Add to `.env.local`:
```bash
# Redis Configuration (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Optional, leave empty for local dev
REDIS_DB=0              # Optional, defaults to 0

# Or disable rate limiting (development only)
# REDIS_DISABLED=true
```

**Production (Upstash example)**:
```bash
REDIS_HOST=your-endpoint.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### 3. Test Setup

```bash
npx tsx scripts/test-rate-limiting.ts
```

Expected output:
```
✅ Redis is connected and healthy
✅ Rate limiting working correctly
✅ Rate limit enforcement working
✅ All tests passed!
```

### 4. Deploy

Add environment variables to Vercel:
```bash
vercel env add REDIS_HOST
vercel env add REDIS_PORT
vercel env add REDIS_PASSWORD
```

## Rate Limit Configuration

### Current Limits

| Endpoint | Limit | Window | Fail Mode |
|----------|-------|--------|-----------|
| `/api/auth/login` | 5 req | 1 min | Fail-open |
| `/api/auth/register` | 3 req | 1 hour | Fail-open |
| `/api/platform/auth/login` | 3 req | 1 min | Fail-closed |
| `/api/products` | 60 req | 1 min | Fail-open |
| `/api/pos/*` | 120 req | 1 min | Fail-open |

**Fail Modes**:
- **Fail-open**: Allow requests if Redis unavailable (user-facing endpoints)
- **Fail-closed**: Block requests if Redis unavailable (admin endpoints, more secure)

### Customizing Limits

Edit `src/lib/security/rate-limiter.ts`:

```typescript
export const RATE_LIMITS = {
  TENANT_LOGIN: {
    limit: 10,              // Change from 5 to 10
    windowSeconds: 60,
    keyPrefix: 'ratelimit:tenant:login',
    failOpen: true,
  },
  // ... other configs
};
```

### Adding New Rate Limits

1. Add configuration:
```typescript
// src/lib/security/rate-limiter.ts
export const RATE_LIMITS = {
  // ... existing configs
  MY_NEW_ENDPOINT: {
    limit: 100,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:my:endpoint',
    failOpen: true,
  },
};
```

2. Apply to API route:
```typescript
// src/app/api/my-endpoint/route.ts
import { applyRateLimit, addRateLimitHeaders } from '@/lib/security/rate-limit-middleware';
import { RATE_LIMITS } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.MY_NEW_ENDPOINT);
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  // Your logic here...
  const response = NextResponse.json({ success: true });
  
  // Add headers
  return addRateLimitHeaders(response, rateLimitResult.info);
}
```

## API Reference

### Check Rate Limit

```typescript
import { checkRequestRateLimit, RATE_LIMITS } from '@/lib/security/rate-limiter';

const result = await checkRequestRateLimit(request, RATE_LIMITS.TENANT_LOGIN);

if (!result.allowed) {
  console.log(`Rate limit exceeded. Retry after ${result.retryAfter}s`);
}
```

**Result**:
```typescript
{
  allowed: boolean;       // Whether request is allowed
  remaining: number;      // Requests remaining in window
  limit: number;          // Total limit
  resetAt: number;        // Unix timestamp when limit resets
  retryAfter?: number;    // Seconds to wait (if blocked)
}
```

### Reset Rate Limit

```typescript
import { resetRateLimit } from '@/lib/security/rate-limiter';

// Reset for specific user
await resetRateLimit('user-ip-address', 'ratelimit:tenant:login');
```

### Get Status (Without Incrementing)

```typescript
import { getRateLimitStatus } from '@/lib/security/rate-limiter';

const status = await getRateLimitStatus('user-ip', RATE_LIMITS.TENANT_LOGIN);
console.log(`User has ${status.remaining} requests remaining`);
```

## Response Headers

All rate-limited endpoints return standard headers:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1704672000
```

When rate limit exceeded (HTTP 429):
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704672000
Retry-After: 60

{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 60 seconds.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

## Monitoring

### Redis Health Check

```typescript
import { isRedisHealthy, getRedisStatus } from '@/lib/redis/client';

const healthy = await isRedisHealthy();
const status = getRedisStatus();

console.log(`Redis: ${status.status}, Attempts: ${status.attempts}`);
```

### Log Rate Limit Events

Rate limiter logs important events:

```
✅ Redis: Connected successfully
✅ Redis: Ready to accept commands
⚠️ Redis: Connection closed
❌ Redis: Connection error: ECONNREFUSED
⚠️ Rate Limiter: Redis unavailable for key ratelimit:tenant:login:192.168.1.1
```

### Metrics to Track

- **Rate limit hits** - How often users hit limits
- **Fail-open triggers** - How often Redis is unavailable
- **Reset requests** - Manual overrides
- **Connection errors** - Redis connectivity issues

## Troubleshooting

### Redis Connection Failed

**Error**:
```
❌ Redis: Connection error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions**:
1. Check Redis is running: `redis-cli ping` (should return "PONG")
2. Check port: `lsof -i :6379`
3. Check password: Verify `REDIS_PASSWORD` matches Redis config
4. Check firewall rules if using remote Redis

### Rate Limiting Not Working

**Symptoms**: All requests allowed despite hitting limit

**Solutions**:
1. Run test: `npx tsx scripts/test-rate-limiting.ts`
2. Check Redis health: `npx tsx -e "import { isRedisHealthy } from './src/lib/redis/client'; isRedisHealthy().then(console.log)"`
3. Check fail-open mode: If Redis down, fail-open endpoints allow all requests
4. Check identifier: Ensure IP forwarding headers set correctly in production

### Redis Memory Issues

**Error**: Redis running out of memory

**Solutions**:
1. Set expiration policy in Redis config:
   ```
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```
2. Rate limit keys auto-expire (window + 10 seconds)
3. Use Redis `SCAN` to check key count: `redis-cli --scan --pattern "ratelimit:*" | wc -l`

### Test Environment Issues

**Problem**: Don't want rate limiting in tests

**Solution**: Set `REDIS_DISABLED=true` in test environment:
```typescript
// jest.setup.ts or similar
process.env.REDIS_DISABLED = 'true';
```

## Security Considerations

### IP Spoofing

Rate limiting uses `X-Forwarded-For` header for IP detection. Ensure your reverse proxy (Vercel, Cloudflare) is trusted and sets these headers correctly.

**Mitigations**:
- Use authenticated rate limiting (per user ID) in addition to IP-based
- Implement CAPTCHA after multiple failed attempts
- Log suspicious patterns (same IP, different user agents)

### DDoS Protection

Rate limiting alone is not sufficient for DDoS protection. Use:
- CDN with DDoS protection (Cloudflare, Fastly)
- WAF (Web Application Firewall)
- Network-level rate limiting (cloud provider)

### Brute Force Attacks

For login endpoints, combine rate limiting with:
- Account lockout after N failed attempts
- CAPTCHA after failed attempts
- Email alerts for suspicious activity
- Password strength requirements

## Performance

### Benchmarks

Tested on MacBook Pro M1, Redis localhost:
- Rate limit check: ~2-5ms
- With connection pooling: ~1-2ms (cached)
- Redis commands: 4 (ZREMRANGEBYSCORE, ZCARD, ZADD, EXPIRE)

### Optimization Tips

1. **Connection Pooling**: Reuse Redis connections (already implemented)
2. **Pipeline Commands**: Batch Redis operations (already implemented)
3. **Adjust Window Size**: Shorter windows = more Redis operations
4. **Use Upstash**: Serverless Redis with edge caching (reduces latency)

### Scaling

- **Horizontal**: Redis Cluster or Redis Sentinel for high availability
- **Vertical**: Increase Redis memory for more rate limit keys
- **Geographic**: Use Redis replicas in multiple regions (Upstash Global)

## Production Checklist

- [ ] Redis instance provisioned (Upstash, Redis Cloud, ElastiCache)
- [ ] Environment variables added to Vercel/hosting platform
- [ ] Test rate limiting in staging: `npx tsx scripts/test-rate-limiting.ts`
- [ ] Monitor Redis health and connection errors
- [ ] Set up alerts for Redis downtime
- [ ] Document rate limits in API documentation
- [ ] Test fail-open behavior (disconnect Redis, verify endpoints still work)
- [ ] Configure maxmemory policy on Redis instance
- [ ] Set up Redis backups (if needed)
- [ ] Review rate limits with team (are they too strict/lenient?)

## Alternative Solutions

If Redis is not an option, consider:

1. **In-Memory Rate Limiting** (single server only):
   ```typescript
   // Not suitable for multi-instance deployments
   const rateLimits = new Map();
   ```

2. **Database-Based** (slower):
   ```sql
   CREATE TABLE rate_limits (
     identifier VARCHAR(255),
     timestamp BIGINT,
     count INT
   );
   ```

3. **Edge Middleware** (Vercel):
   ```typescript
   // middleware.ts
   import { next } from '@vercel/edge';
   import { Ratelimit } from '@upstash/ratelimit';
   ```

4. **Third-Party Services**:
   - [Unkey](https://unkey.dev/) - API key management with built-in rate limiting
   - [Arcjet](https://arcjet.com/) - Security layer with rate limiting

## Further Reading

- [Redis Rate Limiting Pattern](https://redis.io/docs/manual/patterns/rate-limiter/)
- [Sliding Window Algorithm](https://konghq.com/blog/how-to-design-a-scalable-rate-limiting-algorithm)
- [OWASP Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [Upstash Rate Limiting Guide](https://upstash.com/docs/redis/features/ratelimiting)

---

**Questions?** Check troubleshooting section or run: `npx tsx scripts/test-rate-limiting.ts`
