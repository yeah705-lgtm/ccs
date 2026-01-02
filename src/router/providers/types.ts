// Provider type definitions for CCS Router

// Provider identification
export type ProviderType = 'cliproxy' | 'api';
export type AdapterType = 'anthropic' | 'openai-compat' | 'openrouter' | 'custom';
export type Tier = 'opus' | 'sonnet' | 'haiku';

// CLIProxy providers (hardcoded, auto-discovered)
export const CLIPROXY_PROVIDERS = [
  'agy',
  'gemini',
  'codex',
  'qwen',
  'iflow',
  'kiro',
  'ghcp',
] as const;
export type CLIProxyProvider = (typeof CLIPROXY_PROVIDERS)[number];

// API provider configuration (user-defined)
export interface ApiProviderConfig {
  adapter: AdapterType;
  base_url: string;
  auth_env: string;
  models: string[];
  headers?: Record<string, string>;
}

// Resolved provider (runtime)
export interface ResolvedProvider {
  name: string;
  type: ProviderType;
  adapter: AdapterType;
  baseUrl: string;
  authToken?: string;
  headers?: Record<string, string>;
}

// Tier routing configuration
export interface TierConfig {
  provider: string;
  model: string;
  fallback?: TierConfig[];
}

// Router profile
export interface RouterProfile {
  description?: string;
  tiers: {
    opus: TierConfig;
    sonnet: TierConfig;
    haiku: TierConfig;
  };
}

// Health check result
export interface ProviderHealthResult {
  provider: string;
  healthy: boolean;
  latency?: number;
  error?: string;
  checkedAt: Date;
}

// Route resolution result
export interface ResolvedRoute {
  tier: Tier;
  provider: ResolvedProvider;
  targetModel: string;
}
