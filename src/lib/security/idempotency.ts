/**
 * Idempotency Key Manager
 * 
 * Prevents duplicate operations by caching request results.
 * Critical for:
 * - Tenant creation (prevent duplicate signups on network retry)
 * - Payment processing (prevent double charges)
 * - Order creation (prevent duplicate orders)
 * 
 * How it works:
 * 1. Client sends Idempotency-Key header with unique ID (UUID)
 * 2. First request: Process normally, cache result for 24 hours
 * 3. Retry requests: Return cached result instead of reprocessing
 * 
 * Standard: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis/client';

/**
 * Idempotency configuration
 */
export interface IdempotencyConfig {
  /** Cache duration in seconds (default: 24 hours) */
  ttlSeconds?: number;
  
  /** Key prefix for Redis (e.g., 'idempotency:tenant:create') */
  keyPrefix: string;
  
  /** Whether to fail-open (allow without idempotency) if Redis unavailable */
  failOpen?: boolean;
}

/**
 * Cached response data
 */
interface CachedResponse {
  /** HTTP status code */
  status: number;
  
  /** Response headers */
  headers: Record<string, string>;
  
  /** Response body (JSON) */
  body: any;
  
  /** Timestamp when cached (Unix seconds) */
  cachedAt: number;
}

/**
 * Custom errors
 */
export class IdempotencyError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

/**
 * Predefined idempotency configurations
 */
export const IDEMPOTENCY_CONFIGS = {
  // Tenant creation - 24 hour cache
  TENANT_CREATE: {
    ttlSeconds: 86400, // 24 hours
    keyPrefix: 'idempotency:tenant:create',
    failOpen: false, // Strict - prevent duplicate tenants
  } as IdempotencyConfig,
  
  // Order creation - 24 hour cache
  ORDER_CREATE: {
    ttlSeconds: 86400,
    keyPrefix: 'idempotency:order:create',
    failOpen: true, // Allow orders even if Redis down
  } as IdempotencyConfig,
  
  // Payment processing - 72 hour cache (longer for financial operations)
  PAYMENT_PROCESS: {
    ttlSeconds: 259200, // 72 hours
    keyPrefix: 'idempotency:payment:process',
    failOpen: false, // Strict - prevent double charges
  } as IdempotencyConfig,
  
  // Product creation - 1 hour cache (shorter, less critical)
  PRODUCT_CREATE: {
    ttlSeconds: 3600,
    keyPrefix: 'idempotency:product:create',
    failOpen: true,
  } as IdempotencyConfig,
};

/**
 * Extract idempotency key from request headers
 * Supports both standard header and custom variations
 */
export function getIdempotencyKey(request: NextRequest): string | null {
  // Standard header (preferred)
  const standardKey = request.headers.get('idempotency-key');
  if (standardKey) return standardKey;
  
  // Common variations
  const variations = [
    'x-idempotency-key',
    'idempotency_key',
    'x-request-id',
  ];
  
  for (const variation of variations) {
    const key = request.headers.get(variation);
    if (key) return key;
  }
  
  return null;
}

/**
 * Validate idempotency key format
 * Must be 16-64 characters, alphanumeric with dashes/underscores
 */
export function validateIdempotencyKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Length check
  if (key.length < 16 || key.length > 64) {
    return false;
  }
  
  // Format check: alphanumeric, dashes, underscores only
  const validFormat = /^[a-zA-Z0-9_-]+$/.test(key);
  return validFormat;
}

/**
 * Build Redis key for idempotency
 */
function buildRedisKey(idempotencyKey: string, keyPrefix: string): string {
  return `${keyPrefix}:${idempotencyKey}`;
}

/**
 * Check if request has been processed before
 * Returns cached response if found, null otherwise
 */
export async function checkIdempotency(
  idempotencyKey: string,
  config: IdempotencyConfig
): Promise<CachedResponse | null> {
  const redis = getRedisClient();
  
  // If Redis unavailable, apply fail-open or fail-closed strategy
  if (!redis) {
    if (config.failOpen) {
      console.warn(`⚠️ Idempotency: Redis unavailable, allowing request (fail-open)`);
      return null; // Allow processing
    } else {
      throw new IdempotencyError(
        'Idempotency service temporarily unavailable',
        'SERVICE_UNAVAILABLE'
      );
    }
  }
  
  try {
    const redisKey = buildRedisKey(idempotencyKey, config.keyPrefix);
    const cached = await redis.get(redisKey);
    
    if (!cached) {
      return null; // Not found, proceed with processing
    }
    
    // Parse cached response
    const cachedResponse = JSON.parse(cached) as CachedResponse;
    console.log(`✅ Idempotency: Returning cached response for key ${idempotencyKey}`);
    
    return cachedResponse;
  } catch (error) {
    console.error('❌ Idempotency: Error checking cache:', error);
    
    // On error, apply fail-open or fail-closed strategy
    if (config.failOpen) {
      return null; // Allow processing
    } else {
      throw new IdempotencyError(
        'Failed to check idempotency',
        'CHECK_FAILED'
      );
    }
  }
}

/**
 * Cache response for idempotency
 */
export async function cacheResponse(
  idempotencyKey: string,
  response: NextResponse,
  config: IdempotencyConfig
): Promise<void> {
  const redis = getRedisClient();
  
  if (!redis) {
    console.warn(`⚠️ Idempotency: Redis unavailable, cannot cache response`);
    return;
  }
  
  try {
    const redisKey = buildRedisKey(idempotencyKey, config.keyPrefix);
    
    // Extract response data
    const responseClone = response.clone();
    const body = await responseClone.json().catch(() => ({}));
    
    const cachedResponse: CachedResponse = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      cachedAt: Math.floor(Date.now() / 1000),
    };
    
    // Cache with TTL
    const ttl = config.ttlSeconds || 86400;
    await redis.setex(redisKey, ttl, JSON.stringify(cachedResponse));
    
    console.log(`✅ Idempotency: Cached response for key ${idempotencyKey} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error('❌ Idempotency: Error caching response:', error);
    // Don't throw - caching failure shouldn't break the response
  }
}

/**
 * Rebuild NextResponse from cached data
 */
export function rebuildResponse(cached: CachedResponse): NextResponse {
  const response = NextResponse.json(cached.body, { status: cached.status });
  
  // Restore headers (except content-type which is set by NextResponse.json)
  for (const [key, value] of Object.entries(cached.headers)) {
    if (key.toLowerCase() !== 'content-type') {
      response.headers.set(key, value);
    }
  }
  
  // Add idempotency metadata
  response.headers.set('X-Idempotent-Replay', 'true');
  response.headers.set('X-Cached-At', new Date(cached.cachedAt * 1000).toISOString());
  
  return response;
}

/**
 * Delete cached response (for testing or manual override)
 */
export async function deleteIdempotencyCache(
  idempotencyKey: string,
  keyPrefix: string
): Promise<void> {
  const redis = getRedisClient();
  
  if (!redis) {
    console.warn('⚠️ Idempotency: Redis unavailable, cannot delete cache');
    return;
  }
  
  try {
    const redisKey = buildRedisKey(idempotencyKey, keyPrefix);
    await redis.del(redisKey);
    console.log(`✅ Idempotency: Deleted cache for key ${idempotencyKey}`);
  } catch (error) {
    console.error('❌ Idempotency: Error deleting cache:', error);
    throw new IdempotencyError('Failed to delete cache', 'DELETE_FAILED');
  }
}

/**
 * Generate a secure idempotency key (for client-side use)
 * Uses crypto.randomUUID() for uniqueness
 */
export function generateIdempotencyKey(): string {
  // Use crypto.randomUUID() for better entropy
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
