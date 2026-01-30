/**
 * Shared types for Weighted Round-Robin modules
 *
 * Extracted to break circular dependency between sync and migration modules.
 */

/** Weighted file descriptor for round-robin distribution */
export interface WeightedFile {
  /** Filename with round and suffix, e.g., "antigravity-r01_email.json" */
  filename: string;
  /** Account registry ID */
  accountId: string;
  /** 1-based round number */
  round: number;
  /** Empty for multi-round, letter suffix for single-round */
  suffix: string;
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
