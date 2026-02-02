/**
 * Shared types for Weighted Round-Robin modules
 *
 * Extracted to break circular dependency between sync and migration modules.
 */

import { CLIProxyProvider } from './types';

/** Map provider code to auth file prefix used by CLIProxyAPI */
export function getFilePrefix(provider: CLIProxyProvider): string {
  const prefixMap: Partial<Record<CLIProxyProvider, string>> = {
    agy: 'antigravity',
    ghcp: 'github-copilot',
  };
  return prefixMap[provider] ?? provider;
}

/** Weighted file descriptor for interleaved round-robin distribution */
export interface WeightedFile {
  /** Filename with sequence position, e.g., "antigravity-s000_email.json" */
  filename: string;
  /** Account registry ID */
  accountId: string;
  /** 0-based sequence position */
  sequence: number;
}

/** Result of sync operation */
export interface SyncResult {
  /** Files created during sync */
  created: string[];
  /** Files removed during sync */
  removed: string[];
  /** Files unchanged (already existed) */
  unchanged: number;
}

/** Result of migration operation */
export interface MigrationResult {
  /** Number of email groups migrated */
  migrated: number;
  /** Whether migration was skipped (already complete) */
  skipped: boolean;
  /** Emails that failed weight update (best-effort migration) */
  failedWeightUpdates: string[];
}
