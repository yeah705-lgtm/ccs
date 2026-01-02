import type { ResolvedProvider } from './types';
import { getProvider } from './registry';

interface PooledConnection {
  provider: ResolvedProvider;
  lastUsed: Date;
  requestCount: number;
}

// Connection pool (provider name -> connection)
const pool = new Map<string, PooledConnection>();

/** Maximum pool size to prevent memory leaks */
const MAX_POOL_SIZE = 100;

// Pool configuration
const POOL_CONFIG = {
  maxIdleTime: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
};

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get or create pooled connection for provider
 */
export async function getPooledProvider(name: string): Promise<ResolvedProvider | null> {
  // Check existing connection
  const existing = pool.get(name);
  if (existing) {
    existing.lastUsed = new Date();
    existing.requestCount++;
    return existing.provider;
  }

  // Resolve and pool new connection
  const provider = await getProvider(name);
  if (!provider) {
    return null;
  }

  // Before adding to pool, check size limit
  if (pool.size >= MAX_POOL_SIZE) {
    // Find and remove oldest connection
    let oldest: { key: string; time: number } | null = null;
    for (const [key, conn] of pool.entries()) {
      if (!oldest || conn.lastUsed.getTime() < oldest.time) {
        oldest = { key, time: conn.lastUsed.getTime() };
      }
    }
    if (oldest) {
      pool.delete(oldest.key);
      console.log(`[Router] Pool full, evicted: ${oldest.key}`);
    }
  }

  pool.set(name, {
    provider,
    lastUsed: new Date(),
    requestCount: 1,
  });

  // Start cleanup timer if not running
  if (!cleanupTimer) {
    startCleanupTimer();
  }

  return provider;
}

/**
 * Get pool statistics
 */
export function getPoolStats(): {
  size: number;
  providers: { name: string; requestCount: number; lastUsed: Date }[];
} {
  return {
    size: pool.size,
    providers: Array.from(pool.entries()).map(([name, conn]) => ({
      name,
      requestCount: conn.requestCount,
      lastUsed: conn.lastUsed,
    })),
  };
}

/**
 * Clear all pooled connections
 */
export function clearPool(): void {
  pool.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Remove specific provider from pool
 */
export function removeFromPool(name: string): boolean {
  return pool.delete(name);
}

/**
 * Start periodic cleanup of idle connections
 */
function startCleanupTimer(): void {
  cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [name, conn] of pool.entries()) {
      if (now - conn.lastUsed.getTime() > POOL_CONFIG.maxIdleTime) {
        pool.delete(name);
      }
    }

    // Stop timer if pool is empty
    if (pool.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, POOL_CONFIG.cleanupInterval);
}
