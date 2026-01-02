import type { ResolvedProvider, ProviderHealthResult } from './types';

// Health check cache (TTL-based)
const healthCache = new Map<string, ProviderHealthResult>();
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Check provider health
 * Uses cached result if fresh, otherwise performs live check
 */
export async function checkProviderHealth(
  provider: ResolvedProvider
): Promise<ProviderHealthResult> {
  // Check cache
  const cached = healthCache.get(provider.name);
  if (cached && Date.now() - cached.checkedAt.getTime() < CACHE_TTL) {
    return cached;
  }

  // Perform live check
  const result = await performHealthCheck(provider);
  healthCache.set(provider.name, result);

  return result;
}

/**
 * Perform actual health check against provider
 */
async function performHealthCheck(provider: ResolvedProvider): Promise<ProviderHealthResult> {
  const startTime = Date.now();

  try {
    // Different endpoints based on provider type
    const endpoint = getHealthEndpoint(provider);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: provider.authToken ? `Bearer ${provider.authToken}` : '',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        provider: provider.name,
        healthy: true,
        latency,
        checkedAt: new Date(),
      };
    }

    return {
      provider: provider.name,
      healthy: false,
      latency,
      error: `HTTP ${response.status}: ${response.statusText}`,
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      provider: provider.name,
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date(),
    };
  }
}

/**
 * Get appropriate health check endpoint
 */
function getHealthEndpoint(provider: ResolvedProvider): string {
  // CLIProxy providers use /v1/models
  if (provider.type === 'cliproxy') {
    return `${provider.baseUrl.replace(/\/v1$/, '')}/v1/models`;
  }

  // API providers: try /models or /health
  return `${provider.baseUrl}/models`;
}

/**
 * Check health of all configured providers
 */
export async function checkAllProvidersHealth(
  providers: ResolvedProvider[]
): Promise<ProviderHealthResult[]> {
  return Promise.all(providers.map(checkProviderHealth));
}

/**
 * Force refresh health cache for provider
 */
export function invalidateHealthCache(providerName?: string): void {
  if (providerName) {
    healthCache.delete(providerName);
  } else {
    healthCache.clear();
  }
}

/**
 * Get health check cache stats
 */
export function getHealthCacheStats(): {
  size: number;
  entries: { provider: string; healthy: boolean; age: number }[];
} {
  const now = Date.now();
  return {
    size: healthCache.size,
    entries: Array.from(healthCache.entries()).map(([name, result]) => ({
      provider: name,
      healthy: result.healthy,
      age: now - result.checkedAt.getTime(),
    })),
  };
}
