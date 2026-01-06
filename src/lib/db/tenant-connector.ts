import { PrismaClient } from '@prisma/client';

// Connection pool for tenant databases
// Caches Prisma clients to avoid creating new connections on every request

interface TenantConnection {
  client: PrismaClient;
  lastUsed: number;
}

class TenantConnectionPool {
  private connections: Map<string, TenantConnection> = new Map();
  private maxConnections = 100;
  private maxIdleTime = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Cleanup idle connections every minute
    if (typeof window === 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000);
    }
  }
  
  /**
   * Get or create a Prisma client for a tenant database
   */
  getClient(tenantId: string, connectionString: string): PrismaClient {
    // Check if we have a cached connection
    const cached = this.connections.get(tenantId);
    
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.client;
    }
    
    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      this.evictLeastRecentlyUsed();
    }
    
    // Create new Prisma client
    const client = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    
    // Cache it
    this.connections.set(tenantId, {
      client,
      lastUsed: Date.now(),
    });
    
    console.log(`[TenantPool] Created new connection for tenant ${tenantId} (${this.connections.size} total)`);
    
    return client;
  }
  
  /**
   * Remove idle connections
   */
  private cleanup() {
    const now = Date.now();
    const toRemove: string[] = [];
    
    this.connections.forEach((conn, tenantId) => {
      if (now - conn.lastUsed > this.maxIdleTime) {
        toRemove.push(tenantId);
      }
    });
    
    toRemove.forEach((tenantId) => {
      const conn = this.connections.get(tenantId);
      if (conn) {
        conn.client.$disconnect();
        this.connections.delete(tenantId);
        console.log(`[TenantPool] Disconnected idle tenant ${tenantId}`);
      }
    });
  }
  
  /**
   * Evict least recently used connection
   */
  private evictLeastRecentlyUsed() {
    let oldestTenantId: string | null = null;
    let oldestTime = Date.now();
    
    this.connections.forEach((conn, tenantId) => {
      if (conn.lastUsed < oldestTime) {
        oldestTime = conn.lastUsed;
        oldestTenantId = tenantId;
      }
    });
    
    if (oldestTenantId) {
      const conn = this.connections.get(oldestTenantId);
      if (conn) {
        conn.client.$disconnect();
        this.connections.delete(oldestTenantId);
        console.log(`[TenantPool] Evicted tenant ${oldestTenantId} (LRU)`);
      }
    }
  }
  
  /**
   * Disconnect a specific tenant
   */
  async disconnect(tenantId: string) {
    const conn = this.connections.get(tenantId);
    if (conn) {
      await conn.client.$disconnect();
      this.connections.delete(tenantId);
      console.log(`[TenantPool] Manually disconnected tenant ${tenantId}`);
    }
  }
  
  /**
   * Disconnect all tenants (for graceful shutdown)
   */
  async disconnectAll() {
    const promises = Array.from(this.connections.values()).map((conn) =>
      conn.client.$disconnect()
    );
    
    await Promise.all(promises);
    this.connections.clear();
    console.log(`[TenantPool] Disconnected all tenants`);
  }
  
  /**
   * Get pool stats
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.maxConnections,
      tenants: Array.from(this.connections.keys()),
    };
  }
}

// Global connection pool instance
const globalForTenantPool = globalThis as unknown as {
  tenantPool: TenantConnectionPool | undefined;
};

export const tenantPool =
  globalForTenantPool.tenantPool ?? new TenantConnectionPool();

if (process.env.NODE_ENV !== 'production') {
  globalForTenantPool.tenantPool = tenantPool;
}

/**
 * Get a Prisma client for a tenant database
 * Uses connection pooling for performance
 */
export function getTenantDb(tenantId: string, connectionString: string): PrismaClient {
  return tenantPool.getClient(tenantId, connectionString);
}

/**
 * Build connection string from tenant database info
 */
export function buildConnectionString(tenant: {
  dbUser: string;
  dbPassword: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
}): string {
  return `postgresql://${tenant.dbUser}:${tenant.dbPassword}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}?schema=public&connection_limit=10`;
}

/**
 * Test connection to a tenant database
 */
export async function testTenantConnection(connectionString: string): Promise<boolean> {
  try {
    const testClient = new PrismaClient({
      datasources: {
        db: { url: connectionString },
      },
    });
    
    await testClient.$connect();
    await testClient.$disconnect();
    
    return true;
  } catch (error) {
    console.error('[TenantConnector] Connection test failed:', error);
    return false;
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await tenantPool.disconnectAll();
  });
}
