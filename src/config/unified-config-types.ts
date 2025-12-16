/**
 * Unified Config Types for CCS v2
 *
 * This file defines the new unified YAML configuration format that consolidates:
 * - config.json (API profiles)
 * - profiles.json (account metadata)
 * - *.settings.json (env vars)
 *
 * Into a single config.yaml + secrets.yaml structure.
 */

/**
 * Unified config version.
 * Version 2 = YAML unified format
 */
export const UNIFIED_CONFIG_VERSION = 2;

/**
 * Account configuration (formerly in profiles.json).
 * Represents an isolated Claude instance via CLAUDE_CONFIG_DIR.
 */
export interface AccountConfig {
  /** ISO timestamp when account was created */
  created: string;
  /** ISO timestamp of last usage, null if never used */
  last_used: string | null;
}

/**
 * API-based profile configuration.
 * Injects environment variables for alternative providers (GLM, Kimi, etc.).
 *
 * Settings are stored in separate *.settings.json files (matching Claude's pattern)
 * to allow users to edit them directly without touching config.yaml.
 */
export interface ProfileConfig {
  /** Profile type - currently only 'api' */
  type: 'api';
  /** Path to settings file (e.g., "~/.ccs/glm.settings.json") */
  settings: string;
}

/**
 * CLIProxy OAuth account nickname mapping.
 * Maps user-friendly nicknames to email addresses.
 */
export type OAuthAccounts = Record<string, string>;

/**
 * CLIProxy variant configuration.
 * User-defined variants of built-in OAuth providers.
 *
 * Settings are stored in separate *.settings.json files (matching Claude's pattern)
 * to allow users to edit them directly without touching config.yaml.
 */
export interface CLIProxyVariantConfig {
  /** Base provider to use */
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  /** Account nickname (references oauth_accounts) */
  account?: string;
  /** Path to settings file (e.g., "~/.ccs/gemini-custom.settings.json") */
  settings?: string;
}

/**
 * CLIProxy logging configuration.
 * Controls whether CLIProxyAPI writes logs to disk.
 * Logs can grow to several GB if left enabled.
 */
export interface CLIProxyLoggingConfig {
  /** Enable logging to file (default: false to prevent disk bloat) */
  enabled?: boolean;
  /** Enable request logging for debugging (default: false) */
  request_log?: boolean;
}

/**
 * CLIProxy configuration section.
 */
export interface CLIProxyConfig {
  /** Nickname to email mapping for OAuth accounts */
  oauth_accounts: OAuthAccounts;
  /** Built-in providers (read-only, for reference) */
  providers: readonly string[];
  /** User-defined provider variants */
  variants: Record<string, CLIProxyVariantConfig>;
  /** Logging configuration (disabled by default) */
  logging?: CLIProxyLoggingConfig;
}

/**
 * User preferences.
 */
export interface PreferencesConfig {
  /** UI theme preference */
  theme?: 'light' | 'dark' | 'system';
  /** Enable anonymous telemetry */
  telemetry?: boolean;
  /** Enable automatic update checks */
  auto_update?: boolean;
}

/**
 * WebSearch configuration.
 * Controls MCP web-search auto-configuration for third-party profiles.
 */
export interface WebSearchConfig {
  /** Enable auto-configuration of MCP web-search (default: true) */
  enabled?: boolean;
  /** Preferred provider: auto uses fallback chain, or specify one */
  provider?: 'auto' | 'web-search-prime' | 'brave' | 'tavily';
  /** Enable fallback chain when preferred provider fails (default: true) */
  fallback?: boolean;
  /** Custom URL for web-search-prime provider (optional, overrides default) */
  webSearchPrimeUrl?: string;
}

/**
 * Main unified configuration structure.
 * Stored in ~/.ccs/config.yaml
 */
export interface UnifiedConfig {
  /** Config version (2 for unified format) */
  version: number;
  /** Default profile name to use when none specified */
  default?: string;
  /** Account-based profiles (isolated Claude instances) */
  accounts: Record<string, AccountConfig>;
  /** API-based profiles (env var injection) */
  profiles: Record<string, ProfileConfig>;
  /** CLIProxy configuration */
  cliproxy: CLIProxyConfig;
  /** User preferences */
  preferences: PreferencesConfig;
  /** WebSearch configuration */
  websearch?: WebSearchConfig;
}

/**
 * Secrets configuration structure.
 * Stored in ~/.ccs/secrets.yaml with chmod 600.
 * Contains sensitive values like API keys.
 */
export interface SecretsConfig {
  /** Secrets version */
  version: number;
  /** Profile secrets mapping: profile_name -> { key: value } */
  profiles: Record<string, Record<string, string>>;
}

/**
 * Create an empty unified config with defaults.
 */
export function createEmptyUnifiedConfig(): UnifiedConfig {
  return {
    version: UNIFIED_CONFIG_VERSION,
    default: undefined,
    accounts: {},
    profiles: {},
    cliproxy: {
      oauth_accounts: {},
      providers: ['gemini', 'codex', 'agy', 'qwen', 'iflow'],
      variants: {},
      logging: {
        enabled: false,
        request_log: false,
      },
    },
    preferences: {
      theme: 'system',
      telemetry: false,
      auto_update: true,
    },
    websearch: {
      enabled: true,
      provider: 'auto',
      fallback: true,
    },
  };
}

/**
 * Create an empty secrets config.
 */
export function createEmptySecretsConfig(): SecretsConfig {
  return {
    version: 1,
    profiles: {},
  };
}

/**
 * Type guard for UnifiedConfig.
 * Relaxed validation: accepts configs with version >= 1 and any subset of sections.
 * Missing sections will be filled with defaults during merge.
 */
export function isUnifiedConfig(obj: unknown): obj is UnifiedConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  // Only require version to be a number >= 1 (allow future versions)
  // Sections are optional - will be merged with defaults in loadOrCreateUnifiedConfig
  return typeof config.version === 'number' && config.version >= 1;
}

/**
 * Type guard for SecretsConfig.
 */
export function isSecretsConfig(obj: unknown): obj is SecretsConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  return typeof config.version === 'number' && typeof config.profiles === 'object';
}
