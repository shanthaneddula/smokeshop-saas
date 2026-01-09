/**
 * Idempotency Middleware for Next.js API Routes
 * 
 * Usage:
 * ```typescript
 * export const POST = withIdempotency(
 *   IDEMPOTENCY_CONFIGS.TENANT_CREATE,
 *   async (request: NextRequest) => {
 *     // Your logic here - only executed once per idempotency key
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getIdempotencyKey,
  validateIdempotencyKey,
  checkIdempotency,
  cacheResponse,
  rebuildResponse,
  IdempotencyConfig,
  IdempotencyError,
} from './idempotency';

/**
 * Result of idempotency check
 */
export interface IdempotencyResult {
  /** Whether request should be processed */
  shouldProcess: boolean;
  
  /** Cached response (if found) */
  cachedResponse?: NextResponse;
  
  /** Idempotency key from request */
  idempotencyKey?: string;
}

/**
 * Check idempotency and return cached response if available
 */
export async function checkIdempotencyMiddleware(
  request: NextRequest,
  config: IdempotencyConfig
): Promise<IdempotencyResult> {
  try {
    // Extract idempotency key from headers
    const idempotencyKey = getIdempotencyKey(request);
    
    // If no key provided, allow processing
    if (!idempotencyKey) {
      return { shouldProcess: true };
    }
    
    // Validate key format
    if (!validateIdempotencyKey(idempotencyKey)) {
      // Return error for invalid key format
      const errorResponse = NextResponse.json(
        {
          error: 'Invalid idempotency key',
          message: 'Idempotency key must be 16-64 characters, alphanumeric with dashes/underscores',
          code: 'INVALID_IDEMPOTENCY_KEY',
        },
        { status: 400 }
      );
      
      return {
        shouldProcess: false,
        cachedResponse: errorResponse,
      };
    }
    
    // Check if already processed
    const cached = await checkIdempotency(idempotencyKey, config);
    
    if (cached) {
      // Return cached response
      return {
        shouldProcess: false,
        cachedResponse: rebuildResponse(cached),
        idempotencyKey,
      };
    }
    
    // Not cached, proceed with processing
    return {
      shouldProcess: true,
      idempotencyKey,
    };
  } catch (error) {
    if (error instanceof IdempotencyError) {
      // Idempotency service error
      const errorResponse = NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          message: error.message,
          code: error.code,
        },
        { status: 503 }
      );
      
      return {
        shouldProcess: false,
        cachedResponse: errorResponse,
      };
    }
    
    // Unknown error - log and allow processing (fail open for safety)
    console.error('❌ Idempotency Middleware: Unexpected error:', error);
    
    return {
      shouldProcess: true,
    };
  }
}

/**
 * Higher-order function to wrap API routes with idempotency
 * Automatically handles checking cache and storing results
 */
export function withIdempotency(
  config: IdempotencyConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check idempotency
    const idempotencyResult = await checkIdempotencyMiddleware(request, config);
    
    // If cached response available, return it
    if (!idempotencyResult.shouldProcess && idempotencyResult.cachedResponse) {
      return idempotencyResult.cachedResponse;
    }
    
    // Execute handler
    const response = await handler(request);
    
    // Cache response if idempotency key provided and response is successful
    if (idempotencyResult.idempotencyKey && response.status >= 200 && response.status < 300) {
      await cacheResponse(idempotencyResult.idempotencyKey, response, config);
    }
    
    return response;
  };
}

/**
 * Manual idempotency check for more control
 * Use when you need custom logic between check and cache
 */
export async function applyIdempotency(
  request: NextRequest,
  config: IdempotencyConfig
): Promise<IdempotencyResult> {
  return checkIdempotencyMiddleware(request, config);
}

/**
 * Add idempotency headers to response
 * Useful for informing clients about idempotency support
 */
export function addIdempotencyHeaders(
  response: NextResponse,
  config: IdempotencyConfig
): NextResponse {
  response.headers.set('Idempotency-Supported', 'true');
  response.headers.set('Idempotency-TTL', config.ttlSeconds?.toString() || '86400');
  
  return response;
}
