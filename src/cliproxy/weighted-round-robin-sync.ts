/**
 * Weight Sync Module for CLIProxy Weighted Round-Robin
 *
 * Implements interleaved weighted round-robin distribution by generating auth token files
 * with sequence-based naming that CLIProxyAPI discovers alphabetically.
 *
 * Naming pattern: antigravity-s{NNN}_{email}.json
 * - Each account appears `weight` times in the sequence
 * - Low-weight accounts (weight=1) spread evenly across the sequence
 * - High-weight accounts fill remaining slots via round-robin
 * - Alphabetical sort = rotation order (3-digit zero-padded sequence number)
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIProxyProvider } from './types';
import { AccountInfo, getProviderAccounts } from './account-manager';
import { getAuthDir } from './config-generator';
import { WeightedFile, SyncResult, getFilePrefix } from './weighted-round-robin-shared-types';

// Re-export types for convenience
export type { WeightedFile, SyncResult } from './weighted-round-robin-shared-types';
export { getFilePrefix } from './weighted-round-robin-shared-types';

/** Per-provider sync mutex state with coalescing */
const syncState = new Map<string, { running: boolean; pendingResync: boolean }>();

/**
 * Schedule a sync for provider with mutex + coalescing.
 * If sync already running, sets pendingResync flag instead of spawning concurrent.
 * After sync completes, re-runs if pendingResync was set (picks up latest registry state).
 */
export function scheduleSyncForProvider(provider: CLIProxyProvider): void {
  const key = provider;
  const state = syncState.get(key) ?? { running: false, pendingResync: false };

  if (state.running) {
    state.pendingResync = true;
    syncState.set(key, state);
    return;
  }

  state.running = true;
  state.pendingResync = false;
  syncState.set(key, state);

  const runSync = async () => {
    try {
      await syncWeightedAuthFiles(provider);
    } catch (err) {
      console.error(`[weighted-sync] Sync failed for ${provider}:`, (err as Error).message);
    } finally {
      const current = syncState.get(key);
      if (current?.pendingResync) {
        current.pendingResync = false;
        current.running = true;
        syncState.set(key, current);
        void runSync();
      } else {
        syncState.set(key, { running: false, pendingResync: false });
      }
    }
  };

  void runSync();
}

// Forward declaration to avoid circular import - migration module will be imported dynamically
let migrationModule: typeof import('./weighted-round-robin-migration') | null = null;

async function getMigrationModule() {
  if (!migrationModule) {
    migrationModule = await import('./weighted-round-robin-migration');
  }
  return migrationModule;
}

/**
 * Generate weighted file descriptors with interleaved distribution.
 * Each account appears `weight` times. Low-weight accounts (weight=1) are
 * spread evenly across the sequence; high-weight accounts fill remaining slots
 * via round-robin. Output is sorted by sequence number for deterministic order.
 *
 * @param accounts All accounts for provider
 * @param provider CLIProxy provider name
 * @returns Array of weighted file descriptors in sequence order
 */
export function generateWeightedFiles(
  accounts: AccountInfo[],
  provider: CLIProxyProvider
): WeightedFile[] {
  // Filter active accounts (not paused, weight > 0)
  const active = accounts.filter((a) => !a.paused && (a.weight ?? 1) > 0);
  if (active.length === 0) return [];

  // Sort by weight descending, then by id for stability
  const sorted = [...active].sort((a, b) => {
    const wDiff = (b.weight ?? 1) - (a.weight ?? 1);
    return wDiff !== 0 ? wDiff : a.id.localeCompare(b.id);
  });

  const totalSlots = sorted.reduce((sum, a) => sum + (a.weight ?? 1), 0);
  if (totalSlots === 0) return [];

  const prefix = getFilePrefix(provider);
  const result: WeightedFile[] = new Array(totalSlots);

  // Partition into high-weight (>1) and low-weight (=1) groups
  const highWeight = sorted.filter((a) => (a.weight ?? 1) > 1);
  const lowWeight = sorted.filter((a) => (a.weight ?? 1) === 1);

  // If no low-weight accounts, round-robin all high-weight accounts
  if (lowWeight.length === 0) {
    let idx = 0;
    for (let seq = 0; seq < totalSlots; seq++) {
      const account = highWeight[idx % highWeight.length];
      idx++;
      const seqStr = String(seq).padStart(3, '0');
      result[seq] = {
        filename: `${prefix}-s${seqStr}_${account.id}.json`,
        accountId: account.id,
        sequence: seq,
      };
    }
    return result;
  }

  // If no high-weight accounts, list all low-weight accounts sequentially
  if (highWeight.length === 0) {
    for (let seq = 0; seq < totalSlots; seq++) {
      const account = lowWeight[seq % lowWeight.length];
      const seqStr = String(seq).padStart(3, '0');
      result[seq] = {
        filename: `${prefix}-s${seqStr}_${account.id}.json`,
        accountId: account.id,
        sequence: seq,
      };
    }
    return result;
  }

  // Spread low-weight positions evenly across the sequence
  const lowPositions = new Set<number>();
  for (let i = 0; i < lowWeight.length; i++) {
    let pos = Math.floor((i * totalSlots) / lowWeight.length);
    // Resolve collisions: shift forward to nearest free slot
    while (lowPositions.has(pos) && pos < totalSlots) pos++;
    if (pos < totalSlots) lowPositions.add(pos);
  }

  // Fill sequence: low-weight at computed positions, high-weight round-robin elsewhere
  let lowIdx = 0;
  let highIdx = 0;

  for (let seq = 0; seq < totalSlots; seq++) {
    const seqStr = String(seq).padStart(3, '0');

    if (lowPositions.has(seq) && lowIdx < lowWeight.length) {
      const account = lowWeight[lowIdx++];
      result[seq] = {
        filename: `${prefix}-s${seqStr}_${account.id}.json`,
        accountId: account.id,
        sequence: seq,
      };
    } else {
      const account = highWeight[highIdx % highWeight.length];
      highIdx++;
      result[seq] = {
        filename: `${prefix}-s${seqStr}_${account.id}.json`,
        accountId: account.id,
        sequence: seq,
      };
    }
  }

  return result;
}

/**
 * Get canonical token file path for an account.
 * Prefers r01_ file if exists, otherwise falls back to original tokenFile.
 *
 * @param account Account to get token from
 * @param authDir Auth directory path
 * @param provider CLIProxy provider
 * @returns Path to canonical token file
 */
function getCanonicalTokenPath(
  account: AccountInfo,
  authDir: string,
  provider: CLIProxyProvider
): string {
  const prefix = getFilePrefix(provider);

  // Try s000_ file first (first sequence position = canonical)
  const s000Path = path.join(authDir, `${prefix}-s000_${account.id}.json`);
  if (fs.existsSync(s000Path)) {
    return s000Path;
  }

  // Try any s{NNN}_ file for this account
  const escapedId = account.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sequencePattern = new RegExp(`^${prefix}-s\\d{3}_${escapedId}\\.json$`);
  const files = fs.readdirSync(authDir);
  const sequenceFile = files.find((f) => sequencePattern.test(f));
  if (sequenceFile) {
    return path.join(authDir, sequenceFile);
  }

  // Try legacy r{NN}_ file (for transition period)
  const legacyPattern = new RegExp(`^${prefix}-r\\d{2}[a-z]*_${escapedId}\\.json$`);
  const legacyFile = files.find((f) => legacyPattern.test(f));
  if (legacyFile) {
    return path.join(authDir, legacyFile);
  }

  // Fall back to original tokenFile in auth dir
  const originalPath = path.join(authDir, account.tokenFile);
  if (fs.existsSync(originalPath)) {
    return originalPath;
  }

  // Last resort: check auth-backup/ for files that were moved during a previous sync.
  // This recovers from the scenario where canonical files were backed up but
  // new sequence files weren't created (e.g., due to empty registry race).
  const backupDir = path.join(path.dirname(authDir), 'auth-backup');
  if (fs.existsSync(backupDir)) {
    const backupPath = path.join(backupDir, account.tokenFile);
    if (fs.existsSync(backupPath)) {
      return backupPath;
    }
    // Also check for any backup file matching this account's id
    const backupFiles = fs.readdirSync(backupDir);
    const backupMatch = backupFiles.find((f) => f.includes(account.id) && f.endsWith('.json'));
    if (backupMatch) {
      return path.join(backupDir, backupMatch);
    }
  }

  // Return original path even if it doesn't exist (caller handles missing file)
  return originalPath;
}

/**
 * Sync weighted auth files for provider.
 * Creates/removes files to match current account weights.
 * Uses atomic writes for safety.
 *
 * @param provider CLIProxy provider
 * @param options.skipMigrationCheck Skip migration check (used internally by migration module to avoid infinite recursion)
 * @returns Sync result with created/removed/unchanged counts
 */
export async function syncWeightedAuthFiles(
  provider: CLIProxyProvider,
  options?: { skipMigrationCheck?: boolean }
): Promise<SyncResult> {
  // Check and run migration if needed (auto-migrate on first sync)
  // Skip when called from migration module to avoid infinite mutual recursion:
  // sync → migration → sync → migration → ...
  if (!options?.skipMigrationCheck) {
    const migration = await getMigrationModule();
    if (!migration.isMigrationComplete(provider)) {
      await migration.migrateRoundToSequence(provider);
    }
  }

  const authDir = getAuthDir();
  const accounts = getProviderAccounts(provider);

  const result: SyncResult = {
    created: [],
    removed: [],
    unchanged: 0,
  };

  // Ensure auth dir exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
  }

  // Generate target file list from accounts
  const targetFiles = generateWeightedFiles(accounts, provider);
  const targetFilenames = new Set(targetFiles.map((f) => f.filename));

  // Get current weighted files (matching s\d{3}_ pattern)
  const filePrefix = getFilePrefix(provider);
  const newPattern = new RegExp(`^${filePrefix}-s\\d{3}_`);
  const currentFiles = fs.readdirSync(authDir).filter((f) => newPattern.test(f));

  // Also detect old r{NN} format files for removal during transition
  const oldPattern = new RegExp(`^${filePrefix}-r\\d{2}[a-z]*_`);
  const oldFormatFiles = fs.readdirSync(authDir).filter((f) => oldPattern.test(f));

  // Determine files to create and remove
  const toCreate = targetFiles.filter((f) => !currentFiles.includes(f.filename));
  const toRemove = [
    ...currentFiles.filter((f) => !targetFilenames.has(f)),
    ...oldFormatFiles, // Remove all old r{NN} files during transition
  ];

  // Cache token content per account BEFORE any deletions.
  // This prevents the chicken-and-egg problem where removing old sequence files
  // destroys the source token before new files can be created from it.
  const tokenContentCache = new Map<string, string>();
  for (const weightedFile of toCreate) {
    if (tokenContentCache.has(weightedFile.accountId)) continue;

    const account = accounts.find((a) => a.id === weightedFile.accountId);
    if (!account) continue;

    const canonicalPath = getCanonicalTokenPath(account, authDir, provider);
    if (fs.existsSync(canonicalPath)) {
      try {
        tokenContentCache.set(weightedFile.accountId, fs.readFileSync(canonicalPath, 'utf-8'));
      } catch {
        // Will be reported during creation step
      }
    }
  }

  // Remove obsolete files (safe now — token content is cached in memory)
  for (const filename of toRemove) {
    const filePath = path.join(authDir, filename);
    try {
      fs.unlinkSync(filePath);
      result.removed.push(filename);
    } catch (error) {
      // Ignore deletion errors (file may have been removed already)
      console.warn(`Failed to remove ${filename}:`, error);
    }
  }

  // Create new files from cached token content
  for (const weightedFile of toCreate) {
    const targetPath = path.join(authDir, weightedFile.filename);

    const tokenContent = tokenContentCache.get(weightedFile.accountId);
    if (!tokenContent) {
      console.warn(
        `No cached token for ${weightedFile.accountId}, skipping ${weightedFile.filename}`
      );
      continue;
    }

    try {
      // Write to temp file first (atomic write)
      const tempPath = `${targetPath}.tmp`;
      fs.writeFileSync(tempPath, tokenContent, { mode: 0o600 });

      // Rename to final path (atomic operation)
      fs.renameSync(tempPath, targetPath);

      result.created.push(weightedFile.filename);
    } catch (error) {
      console.warn(`Failed to create ${weightedFile.filename}:`, error);
      // Clean up temp file if exists
      const tempPath = `${targetPath}.tmp`;
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Count unchanged files
  result.unchanged = targetFilenames.size - result.created.length;

  // Move old canonical files to auth-backup/ after sequence files are created
  // This prevents CLIProxyAPI from discovering old canonical files alongside s{NNN} files
  const backupDir = path.join(path.dirname(authDir), 'auth-backup');

  // Collect tokenFile changes first, then apply as targeted merge to fresh registry
  // This prevents overwriting concurrent setAccountWeight() calls from other providers
  const tokenFileUpdates: Array<{ accountId: string; newTokenFile: string }> = [];
  const sequencePattern = new RegExp(`^${filePrefix}-s\\d{3}_`);

  for (const account of accounts) {
    const canonicalFile = account.tokenFile;

    // Skip if already s{NNN} format (nothing to migrate)
    if (sequencePattern.test(canonicalFile)) {
      continue;
    }

    // Find any sequence file created for this account
    const accountWeightedFile = targetFiles.find((f) => f.accountId === account.id);
    if (!accountWeightedFile) continue;

    const weightedPath = path.join(authDir, accountWeightedFile.filename);
    const canonicalPath = path.join(authDir, canonicalFile);

    if (!fs.existsSync(weightedPath) || !fs.existsSync(canonicalPath)) {
      continue;
    }

    // Verify weighted file has same content as canonical (safety check)
    try {
      const weightedContent = fs.readFileSync(weightedPath, 'utf-8');
      const canonicalContent = fs.readFileSync(canonicalPath, 'utf-8');

      if (weightedContent === canonicalContent) {
        // Create backup directory if needed
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        }

        // Move old canonical to backup directory
        const backupPath = path.join(backupDir, canonicalFile);
        fs.renameSync(canonicalPath, backupPath);

        tokenFileUpdates.push({
          accountId: account.id,
          newTokenFile: accountWeightedFile.filename,
        });
        result.removed.push(canonicalFile);
      }
    } catch {
      // Skip on error (content mismatch, read failure, etc.)
      continue;
    }
  }

  // Targeted merge: re-load fresh registry, apply only tokenFile changes, save
  // This minimizes the race window with concurrent setAccountWeight() calls
  if (tokenFileUpdates.length > 0) {
    const { loadAccountsRegistry, saveAccountsRegistry } = await import('./account-manager');
    const freshRegistry = loadAccountsRegistry();
    const providerAccounts = freshRegistry.providers[provider];

    if (providerAccounts) {
      for (const update of tokenFileUpdates) {
        if (providerAccounts.accounts[update.accountId]) {
          providerAccounts.accounts[update.accountId].tokenFile = update.newTokenFile;
        }
      }
      saveAccountsRegistry(freshRegistry);
    }
  }

  return result;
}
