import type { Tier, RouterProfile, TierConfig, ResolvedRoute } from '../providers/types';
import { detectTier } from './tier';
import { getProvider } from '../providers/registry';

/**
 * Resolve route from model name using profile configuration
 * @param modelName - Incoming model name (e.g., "claude-opus-4")
 * @param profile - Router profile with tier mappings
 * @returns Resolved route with provider and target model
 */
export async function resolveRoute(
  modelName: string,
  profile: RouterProfile
): Promise<ResolvedRoute> {
  const tier = detectTier(modelName);

  if (!profile?.tiers) {
    throw new Error('Profile missing tiers configuration');
  }

  const tierConfig = profile.tiers[tier];
  if (!tierConfig) {
    throw new Error(`Tier "${tier}" not configured in profile`);
  }

  const provider = await getProvider(tierConfig.provider);
  if (!provider) {
    throw new Error(`Provider not found: ${tierConfig.provider}`);
  }

  return {
    tier,
    provider,
    targetModel: tierConfig.model,
  };
}

/**
 * Get tier configuration from profile
 */
export function getTierConfig(profile: RouterProfile, tier: Tier): TierConfig {
  if (!profile?.tiers) {
    throw new Error('Profile missing tiers configuration');
  }

  const tierConfig = profile.tiers[tier];
  if (!tierConfig) {
    throw new Error(`Tier "${tier}" not configured in profile`);
  }

  return tierConfig;
}

/**
 * Validate all tiers have valid providers
 */
export async function validateProfileRoutes(
  profile: RouterProfile
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const [tier, config] of Object.entries(profile.tiers)) {
    const provider = await getProvider(config.provider);
    if (!provider) {
      errors.push(`Tier ${tier}: provider "${config.provider}" not found`);
    }
  }

  return { valid: errors.length === 0, errors };
}
