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
 */
export interface ProfileConfig {
  /** Profile type - currently only 'api' */
  type: 'api';
  /** Environment variables (non-secret values only) */
  env: Record<string, string>;
}

/**
 * CLIProxy OAuth account nickname mapping.
 * Maps user-friendly nicknames to email addresses.
 */
export type OAuthAccounts = Record<string, string>;

/**
 * CLIProxy variant configuration.
 * User-defined variants of built-in OAuth providers.
 */
export interface CLIProxyVariantConfig {
  /** Base provider to use */
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  /** Account nickname (references oauth_accounts) */
  account?: string;
  /** Model override (inline, no separate settings file) */
  model?: string;
  /** Additional env var overrides (ANTHROPIC_MAX_TOKENS, MAX_THINKING_TOKENS, etc.) */
  env?: Record<string, string>;
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
    },
    preferences: {
      theme: 'system',
      telemetry: false,
      auto_update: true,
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
 */
export function isUnifiedConfig(obj: unknown): obj is UnifiedConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  return (
    typeof config.version === 'number' &&
    config.version === UNIFIED_CONFIG_VERSION &&
    typeof config.accounts === 'object' &&
    typeof config.profiles === 'object' &&
    typeof config.cliproxy === 'object'
  );
}

/**
 * Type guard for SecretsConfig.
 */
export function isSecretsConfig(obj: unknown): obj is SecretsConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  return typeof config.version === 'number' && typeof config.profiles === 'object';
}
