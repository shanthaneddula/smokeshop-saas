/**
 * Rate Limit Middleware for Next.js API Routes
 * 
 * Usage in API routes:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.TENANT_LOGIN);
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 *   // Continue with normal logic...
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkRequestRateLimit,
  RateLimitConfig,
  RateLimitResult,
  RateLimitError,
} from './rate-limiter';

/**
 * Result of applying rate limit middleware
 */
export interface RateLimitMiddlewareResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Rate limit info */
  info: RateLimitResult;
  
  /** Response to return (if denied) */
  response?: NextResponse;
}

/**
 * Apply rate limiting to a request
 * Returns middleware result with response if denied
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitMiddlewareResult> {
  try {
    const info = await checkRequestRateLimit(request, config);
    
    if (!info.allowed) {
      // Rate limit exceeded
      const response = NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${info.retryAfter} seconds.`,
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', info.limit.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', info.resetAt.toString());
      response.headers.set('Retry-After', (info.retryAfter || 60).toString());
      
      return {
        allowed: false,
        info,
        response,
      };
    }
    
    // Request allowed
    return {
      allowed: true,
      info,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Rate limiting service error
      const response = NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          message: error.message,
          code: error.code,
        },
        { status: 503 }
      );
      
      return {
        allowed: false,
        info: {
          allowed: false,
          remaining: 0,
          limit: config.limit,
          resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
        },
        response,
      };
    }
    
    // Unknown error - log and allow (fail open for safety)
    console.error('❌ Rate Limit Middleware: Unexpected error:', error);
    
    return {
      allowed: true,
      info: {
        allowed: true,
        remaining: config.limit,
        limit: config.limit,
        resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
      },
    };
  }
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  info: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', info.limit.toString());
  response.headers.set('X-RateLimit-Remaining', info.remaining.toString());
  response.headers.set('X-RateLimit-Reset', info.resetAt.toString());
  
  return response;
}

/**
 * Convenience wrapper for API routes with rate limiting
 * Automatically handles rate limit checking and header setting
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResult = await applyRateLimit(request, config);
    
    // If rate limit exceeded, return error response
    if (!rateLimitResult.allowed && rateLimitResult.response) {
      return rateLimitResult.response;
    }
    
    // Execute handler
    const response = await handler(request);
    
    // Add rate limit headers to successful response
    return addRateLimitHeaders(response, rateLimitResult.info);
  };
}
