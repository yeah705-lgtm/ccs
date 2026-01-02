import type { TierConfig, ResolvedRoute, Tier } from '../providers/types';
import { getProvider } from '../providers/registry';
import { checkProviderHealth } from '../providers/health';

export interface FallbackResult {
  route: ResolvedRoute | null;
  attempts: FallbackAttempt[];
}

export interface FallbackAttempt {
  provider: string;
  model: string;
  success: boolean;
  error?: string;
}

/**
 * Try to resolve route with fallback chain
 * @param tier - Target tier
 * @param config - Tier configuration with optional fallback array
 * @returns First healthy route or null if all fail
 */
export async function resolveFallbackChain(
  tier: Tier,
  config: TierConfig
): Promise<FallbackResult> {
  const attempts: FallbackAttempt[] = [];
  const candidates = [config, ...(config.fallback || [])];

  for (const candidate of candidates) {
    const provider = await getProvider(candidate.provider);

    if (!provider) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        success: false,
        error: 'Provider not found',
      });
      continue;
    }

    // Check health
    const health = await checkProviderHealth(provider);

    if (health.healthy) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        success: true,
      });

      return {
        route: { tier, provider, targetModel: candidate.model },
        attempts,
      };
    }

    attempts.push({
      provider: candidate.provider,
      model: candidate.model,
      success: false,
      error: health.error || 'Health check failed',
    });
  }

  return { route: null, attempts };
}
