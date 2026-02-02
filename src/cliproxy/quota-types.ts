/**
 * Shared Quota Type Definitions
 *
 * Unified types for multi-provider quota system.
 * Supports Antigravity, Codex, and Gemini CLI providers.
 */

/** Supported quota providers */
export type QuotaProvider = 'agy' | 'codex' | 'gemini';

// Re-export Antigravity types for unified access
export type { QuotaResult as AntigravityQuotaResult } from './quota-fetcher';

/**
 * Codex quota window (primary, secondary, code review)
 */
export interface CodexQuotaWindow {
  /** Window label: "Primary", "Secondary", "Code Review (Primary)", "Code Review (Secondary)" */
  label: string;
  /** Percentage used (0-100) */
  usedPercent: number;
  /** Percentage remaining (100 - usedPercent) */
  remainingPercent: number;
  /** Seconds until quota resets, null if unknown */
  resetAfterSeconds: number | null;
  /** ISO timestamp when quota resets, null if unknown */
  resetAt: string | null;
}

/**
 * Codex quota fetch result
 */
export interface CodexQuotaResult {
  /** Whether fetch succeeded */
  success: boolean;
  /** Quota windows (primary, secondary, code review) */
  windows: CodexQuotaWindow[];
  /** Plan type: free, plus, team, or null if unknown */
  planType: 'free' | 'plus' | 'team' | null;
  /** Timestamp of fetch */
  lastUpdated: number;
  /** Error message if fetch failed */
  error?: string;
  /** Account ID (email) this quota belongs to */
  accountId?: string;
  /** True if token is expired and needs re-authentication */
  needsReauth?: boolean;
  /** True if account lacks quota access (403) - displayed as 0% instead of error */
  isForbidden?: boolean;
}

/**
 * Gemini CLI quota bucket (grouped by model series and token type)
 */
export interface GeminiCliBucket {
  /** Unique bucket identifier (e.g., "gemini-flash-series::input") */
  id: string;
  /** Display label (e.g., "Gemini Flash Series") */
  label: string;
  /** Token type: "input", "output", or null if combined */
  tokenType: string | null;
  /** Remaining quota as fraction (0-1) */
  remainingFraction: number;
  /** Remaining quota as percentage (0-100) */
  remainingPercent: number;
  /** ISO timestamp when quota resets, null if unknown */
  resetTime: string | null;
  /** Model IDs in this bucket */
  modelIds: string[];
}

/**
 * Gemini CLI quota fetch result
 */
export interface GeminiCliQuotaResult {
  /** Whether fetch succeeded */
  success: boolean;
  /** Quota buckets grouped by model series */
  buckets: GeminiCliBucket[];
  /** GCP project ID for this account */
  projectId: string | null;
  /** Timestamp of fetch */
  lastUpdated: number;
  /** Error message if fetch failed */
  error?: string;
  /** Account ID (email) this quota belongs to */
  accountId?: string;
  /** True if token is expired and needs re-authentication */
  needsReauth?: boolean;
}
