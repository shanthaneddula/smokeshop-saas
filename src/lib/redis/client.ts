/**
 * Redis Client Configuration
 * 
 * Production-grade Redis client with:
 * - Connection pooling and retry logic
 * - Graceful degradation (fails open if Redis unavailable)
 * - Health checking and monitoring
 * - Lazy connection (connects on first use)
 */

import Redis, { RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Redis connection configuration
 */
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Connection settings
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false, // Fail fast if not connected
  
  // Timeouts
  connectTimeout: 5000,
  commandTimeout: 2000,
  
  // Retry strategy
  retryStrategy(times: number) {
    if (times > MAX_RETRY_ATTEMPTS) {
      console.error('❌ Redis: Max retry attempts reached, giving up');
      return null; // Stop retrying
    }
    
    const delay = Math.min(times * RETRY_DELAY_MS, 5000);
    console.log(`⚠️ Redis: Retry attempt ${times} in ${delay}ms`);
    return delay;
  },
  
  // Reconnect on error
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Reconnect
    }
    return false;
  },
};

/**
 * Get Redis client instance (singleton)
 * Creates connection on first use (lazy initialization)
 */
export function getRedisClient(): Redis | null {
  // Return existing client if connected
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  
  // Check if Redis is disabled
  if (process.env.REDIS_DISABLED === 'true') {
    console.warn('⚠️ Redis: Disabled via environment variable');
    return null;
  }
  
  // Prevent excessive connection attempts
  if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
    console.error('❌ Redis: Max connection attempts reached');
    return null;
  }
  
  try {
    connectionAttempts++;
    
    // Create new client
    redisClient = new Redis(redisConfig);
    
    // Event handlers
    redisClient.on('connect', () => {
      console.log('✅ Redis: Connected successfully');
      connectionAttempts = 0; // Reset counter on success
    });
    
    redisClient.on('ready', () => {
      console.log('✅ Redis: Ready to accept commands');
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ Redis: Connection error:', err.message);
    });
    
    redisClient.on('close', () => {
      console.warn('⚠️ Redis: Connection closed');
    });
    
    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Reconnecting...');
    });
    
    return redisClient;
  } catch (error) {
    console.error('❌ Redis: Failed to create client:', error);
    redisClient = null;
    return null;
  }
}

/**
 * Check if Redis is available and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  const client = getRedisClient();
  
  if (!client) {
    return false;
  }
  
  try {
    await client.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis: Health check failed:', error);
    return false;
  }
}

/**
 * Gracefully close Redis connection
 * Call this on application shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis: Connection closed gracefully');
    } catch (error) {
      console.error('❌ Redis: Error closing connection:', error);
      redisClient.disconnect();
    } finally {
      redisClient = null;
      connectionAttempts = 0;
    }
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
  connected: boolean;
  status: string | null;
  attempts: number;
} {
  return {
    connected: redisClient?.status === 'ready',
    status: redisClient?.status || null,
    attempts: connectionAttempts,
  };
}
