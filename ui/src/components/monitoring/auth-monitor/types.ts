/**
 * Type definitions for Auth Monitor components
 */

export interface AccountRow {
  id: string;
  email: string;
  provider: string;
  displayName: string;
  isDefault: boolean;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  color: string;
  /** GCP Project ID (Antigravity only) - read-only */
  projectId?: string;
  /** Whether account is paused (skipped in quota rotation) */
  paused?: boolean;
}

export interface ProviderStats {
  provider: string;
  displayName: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  accountCount: number;
  accounts: AccountRow[];
}
