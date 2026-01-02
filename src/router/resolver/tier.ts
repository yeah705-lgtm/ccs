import type { Tier } from '../providers/types';

// Tier detection patterns
const TIER_PATTERNS: Record<Tier, RegExp[]> = {
  opus: [/claude-opus/i, /opus-4/i, /claude-4.*opus/i, /claude-opus-4/i],
  sonnet: [
    /claude-.*sonnet/i,
    /sonnet-4/i,
    /claude-3-5-sonnet/i,
    /claude-3-sonnet/i,
    /claude-sonnet/i,
  ],
  haiku: [/claude-.*haiku/i, /haiku-/i, /claude-3-5-haiku/i, /claude-3-haiku/i],
};

/**
 * Detect tier from Claude model name
 * @param modelName - Model name from request (e.g., "claude-opus-4")
 * @returns Detected tier, defaults to 'sonnet' if unknown
 */
export function detectTier(modelName: string): Tier {
  for (const [tier, patterns] of Object.entries(TIER_PATTERNS)) {
    if (patterns.some((p) => p.test(modelName))) {
      return tier as Tier;
    }
  }
  // Default to sonnet for unknown models
  console.warn(`[Router] Unknown model "${modelName}", defaulting to sonnet tier`);
  return 'sonnet';
}

/**
 * Check if model name matches a specific tier
 */
export function isTier(modelName: string, tier: Tier): boolean {
  return detectTier(modelName) === tier;
}
