/**
 * Production-Grade Rate Limiter
 * 
 * Features:
 * - Sliding window algorithm (more accurate than fixed window)
 * - Redis-backed for distributed rate limiting
 * - Graceful degradation (fails open if Redis unavailable)
 * - Configurable limits per endpoint
 * - Rate limit headers (X-RateLimit-*)
 * - IP-based and user-based limiting
 * - Automatic cleanup of expired keys
 */

import { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis/client';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  
  /** Time window in seconds */
  windowSeconds: number;
  
  /** Unique identifier for this rate limit (e.g., 'auth:login') */
  keyPrefix: string;
  
  /** Whether to fail open (allow) or closed (deny) if Redis unavailable */
  failOpen?: boolean;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Number of requests remaining in window */
  remaining: number;
  
  /** Total limit for this window */
  limit: number;
  
  /** Timestamp when the rate limit resets (Unix timestamp in seconds) */
  resetAt: number;
  
  /** Number of seconds until reset */
  retryAfter?: number;
}

/**
 * Custom errors
 */
export class RateLimitError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Tenant login: 5 attempts per minute per IP
  TENANT_LOGIN: {
    limit: 5,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:tenant:login',
    failOpen: true, // Allow login if Redis down
  } as RateLimitConfig,
  
  // Tenant register: 3 attempts per hour per IP
  TENANT_REGISTER: {
    limit: 3,
    windowSeconds: 3600,
    keyPrefix: 'ratelimit:tenant:register',
    failOpen: true,
  } as RateLimitConfig,
  
  // Platform admin login: 3 attempts per minute per IP (more strict)
  PLATFORM_LOGIN: {
    limit: 3,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:platform:login',
    failOpen: false, // Deny if Redis down (more secure)
  } as RateLimitConfig,
  
  // Tenant creation: 10 attempts per hour per IP
  TENANT_CREATE: {
    limit: 10,
    windowSeconds: 3600,
    keyPrefix: 'ratelimit:tenant:create',
    failOpen: false,
  } as RateLimitConfig,
  
  // Product API: 60 requests per minute per tenant
  PRODUCT_API: {
    limit: 60,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:product:api',
    failOpen: true,
  } as RateLimitConfig,
  
  // POS API: 120 requests per minute per tenant (higher for real-time operations)
  POS_API: {
    limit: 120,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:pos:api',
    failOpen: true,
  } as RateLimitConfig,
};

/**
 * Extract client identifier from request
 * Uses IP address, falling back to user agent if IP unavailable
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (Vercel sets these)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  // Use first IP from X-Forwarded-For (client IP)
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback to user agent hash (less ideal but better than nothing)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `ua:${Buffer.from(userAgent).toString('base64').slice(0, 32)}`;
}

/**
 * Check rate limit using sliding window algorithm
 * 
 * Algorithm:
 * 1. Get current timestamp
 * 2. Remove requests older than window
 * 3. Count remaining requests in window
 * 4. If under limit, add new request and allow
 * 5. If over limit, deny and return retry time
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = `${config.keyPrefix}:${identifier}`;
  
  // If Redis unavailable, apply fail-open or fail-closed strategy
  if (!redis) {
    console.warn(`⚠️ Rate Limiter: Redis unavailable for key ${key}`);
    
    if (config.failOpen) {
      // Fail open: Allow request
      return {
        allowed: true,
        remaining: config.limit,
        limit: config.limit,
        resetAt: Math.floor((now + windowMs) / 1000),
      };
    } else {
      // Fail closed: Deny request
      throw new RateLimitError(
        'Rate limiting service temporarily unavailable',
        'SERVICE_UNAVAILABLE'
      );
    }
  }
  
  try {
    // Use Redis transaction for atomic operations
    const pipeline = redis.pipeline();
    
    // 1. Remove requests older than window
    const windowStart = now - windowMs;
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // 2. Count requests in current window
    pipeline.zcard(key);
    
    // 3. Add current request with score = timestamp
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // 4. Set key expiration (cleanup old keys)
    pipeline.expire(key, config.windowSeconds + 10);
    
    // Execute transaction
    const results = await pipeline.exec();
    
    if (!results) {
      throw new RateLimitError('Redis pipeline failed', 'PIPELINE_ERROR');
    }
    
    // Get count from ZCARD result (index 1, second operation)
    const [, countResult] = results;
    if (countResult[0]) {
      throw new RateLimitError(
        `Redis command error: ${countResult[0]}`,
        'REDIS_ERROR'
      );
    }
    
    const currentCount = countResult[1] as number;
    const remaining = Math.max(0, config.limit - currentCount);
    const resetAt = Math.floor((now + windowMs) / 1000);
    
    // Check if limit exceeded
    if (currentCount > config.limit) {
      // Remove the request we just added (since it's denied)
      await redis.zremrangebyscore(key, now, now);
      
      return {
        allowed: false,
        remaining: 0,
        limit: config.limit,
        resetAt,
        retryAfter: config.windowSeconds,
      };
    }
    
    // Request allowed
    return {
      allowed: true,
      remaining,
      limit: config.limit,
      resetAt,
    };
  } catch (error) {
    console.error('❌ Rate Limiter: Error checking rate limit:', error);
    
    // On error, apply fail-open or fail-closed strategy
    if (config.failOpen) {
      return {
        allowed: true,
        remaining: config.limit,
        limit: config.limit,
        resetAt: Math.floor((now + windowMs) / 1000),
      };
    } else {
      throw new RateLimitError(
        'Rate limiting check failed',
        'CHECK_FAILED'
      );
    }
  }
}

/**
 * Convenience function to check rate limit for a request
 */
export async function checkRequestRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);
  return checkRateLimit(identifier, config);
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or manual override
 */
export async function resetRateLimit(
  identifier: string,
  keyPrefix: string
): Promise<void> {
  const redis = getRedisClient();
  
  if (!redis) {
    console.warn('⚠️ Rate Limiter: Redis unavailable, cannot reset rate limit');
    return;
  }
  
  const key = `${keyPrefix}:${identifier}`;
  
  try {
    await redis.del(key);
    console.log(`✅ Rate Limiter: Reset rate limit for ${key}`);
  } catch (error) {
    console.error('❌ Rate Limiter: Error resetting rate limit:', error);
    throw new RateLimitError('Failed to reset rate limit', 'RESET_FAILED');
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = `${config.keyPrefix}:${identifier}`;
  
  if (!redis) {
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: Math.floor((now + windowMs) / 1000),
    };
  }
  
  try {
    const windowStart = now - windowMs;
    const count = await redis.zcount(key, windowStart, now);
    const remaining = Math.max(0, config.limit - count);
    const resetAt = Math.floor((now + windowMs) / 1000);
    
    return {
      allowed: count < config.limit,
      remaining,
      limit: config.limit,
      resetAt,
      retryAfter: count >= config.limit ? config.windowSeconds : undefined,
    };
  } catch (error) {
    console.error('❌ Rate Limiter: Error getting status:', error);
    
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: Math.floor((now + windowMs) / 1000),
    };
  }
}
