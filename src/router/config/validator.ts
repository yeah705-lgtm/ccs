import type { RouterProfile, TierConfig } from './schema';
import { getProvider } from '../providers/registry';
import { loadRouterConfig } from './loader';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Detect circular references in fallback chain
 * Returns array of provider names in cycle, or empty if no cycle
 */
function _detectFallbackCycle(config: TierConfig, visited: Set<string> = new Set()): string[] {
  const provider = config.provider;

  if (visited.has(provider)) {
    return [provider]; // Found cycle
  }

  visited.add(provider);

  if (config.fallback) {
    for (const fallbackConfig of config.fallback) {
      const cycle = _detectFallbackCycle(fallbackConfig, new Set(visited));
      if (cycle.length > 0) {
        return [provider, ...cycle];
      }
    }
  }

  return []; // No cycle
}

/**
 * Validate a router profile
 */
export async function validateProfile(
  profileName: string,
  profile: RouterProfile
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate each tier
  for (const [tierName, tierConfig] of Object.entries(profile.tiers)) {
    // Check provider exists
    const provider = await getProvider(tierConfig.provider);

    if (!provider) {
      errors.push(
        `[${profileName}] Tier "${tierName}": provider "${tierConfig.provider}" not found`
      );
      continue;
    }

    // Check API key for non-CLIProxy providers
    if (provider.type === 'api' && !provider.authToken) {
      errors.push(`[${profileName}] Tier "${tierName}": API key not set (${tierConfig.provider})`);
    }

    // Check for circular fallback
    const cycle = _detectFallbackCycle(tierConfig);
    if (cycle.length > 0) {
      errors.push(
        `[${profileName}] Tier "${tierName}": circular fallback detected: ${cycle.join(' → ')}`
      );
    }

    // Validate fallback chain if present
    if (tierConfig.fallback) {
      for (let i = 0; i < tierConfig.fallback.length; i++) {
        const fb = tierConfig.fallback[i];
        const fbProvider = await getProvider(fb.provider);

        if (!fbProvider) {
          warnings.push(
            `[${profileName}] Tier "${tierName}" fallback[${i}]: provider "${fb.provider}" not found`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire router configuration
 */
export async function validateRouterConfig(): Promise<{
  valid: boolean;
  profiles: Record<string, ValidationResult>;
}> {
  const config = loadRouterConfig();

  if (!config) {
    return { valid: false, profiles: {} };
  }

  const profiles: Record<string, ValidationResult> = {};
  let allValid = true;

  for (const [name, profile] of Object.entries(config.profiles)) {
    const result = await validateProfile(name, profile);
    profiles[name] = result;

    if (!result.valid) {
      allValid = false;
    }
  }

  return { valid: allValid, profiles };
}

/**
 * Quick check if profile is runnable (all providers available)
 */
export async function isProfileRunnable(profileName: string): Promise<{
  runnable: boolean;
  missing: string[];
}> {
  const config = loadRouterConfig();
  const profile = config?.profiles?.[profileName];

  if (!profile) {
    return { runnable: false, missing: [`Profile "${profileName}" not found`] };
  }

  const missing: string[] = [];

  for (const [tier, tierConfig] of Object.entries(profile.tiers)) {
    const provider = await getProvider(tierConfig.provider);

    if (!provider) {
      missing.push(`${tier}: ${tierConfig.provider}`);
    } else if (provider.type === 'api' && !provider.authToken) {
      missing.push(`${tier}: ${tierConfig.provider} (no API key)`);
    }
  }

  return { runnable: missing.length === 0, missing };
}
