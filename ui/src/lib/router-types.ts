/**
 * Router Types - TypeScript types for router profile management
 */

/**
 * Router tier configuration (provider + model + fallbacks)
 */
export interface TierConfig {
  provider: string;
  model: string;
  fallback?: TierConfig[];
}

/**
 * Router profile with tier mappings
 */
export interface RouterProfile {
  name: string;
  description?: string;
  tiers: {
    opus: TierConfig;
    sonnet: TierConfig;
    haiku: TierConfig;
  };
}

/**
 * Router profile list item (summary)
 */
export interface RouterProfileSummary {
  name: string;
  description?: string;
  tiers: string[]; // ['opus', 'sonnet', 'haiku']
  tierConfigs?: {
    opus: TierConfig;
    sonnet: TierConfig;
    haiku: TierConfig;
  };
}

/**
 * Provider with health status
 */
export interface RouterProvider {
  name: string;
  type: 'cliproxy' | 'api' | 'openrouter';
  baseUrl: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * Create profile payload
 */
export interface CreateRouterProfile {
  name: string;
  description?: string;
  tiers: {
    opus: TierConfig;
    sonnet: TierConfig;
    haiku: TierConfig;
  };
}

/**
 * Update profile payload (same as create, name in URL)
 */
export type UpdateRouterProfile = Omit<CreateRouterProfile, 'name'>;

/**
 * Test result for single tier
 */
export interface TierTestResult {
  valid: boolean;
  latency?: number;
  error?: string;
}

/**
 * Profile test response
 */
export interface ProfileTestResult {
  profile: string;
  results: {
    opus: TierTestResult | null;
    sonnet: TierTestResult | null;
    haiku: TierTestResult | null;
  };
}
