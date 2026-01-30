/**
 * Weight Sync Module for CLIProxy Weighted Round-Robin
 *
 * Implements weighted round-robin distribution by generating auth token files
 * with specific naming patterns that CLIProxyAPI discovers alphabetically.
 *
 * Naming pattern: antigravity-r{NN}{suffix}_{email}.json
 * - Multi-round accounts (weight>1): no suffix, appear in rounds 01 to weight
 * - Single-round accounts (weight=1): letter suffix (a-z, aa-az...), distributed across rounds
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

// Forward declaration to avoid circular import - migration module will be imported dynamically
let migrationModule: typeof import('./weighted-round-robin-migration') | null = null;

async function getMigrationModule() {
  if (!migrationModule) {
    migrationModule = await import('./weighted-round-robin-migration');
  }
  return migrationModule;
}

/**
 * Generate suffix for single-round accounts based on index.
 * - 0-25 → 'a'-'z'
 * - 26-51 → 'aa'-'az'
 * - 52-77 → 'ba'-'bz'
 *
 * NOTE: Supports up to 676 single-round accounts per round (26 + 26*25 = 676).
 * For 676+ accounts, suffix generation would produce incorrect results.
 * This is an acceptable limitation as 676 single-round accounts per round
 * is far beyond any realistic usage scenario.
 *
 * @param index Zero-based index
 * @returns Letter suffix
 */
function generateSuffix(index: number): string {
  if (index < 0) return 'a';

  if (index < 26) {
    // a-z
    return String.fromCharCode(97 + index);
  }

  // aa-az, ba-bz, ca-cz...
  const firstLetter = Math.floor(index / 26) - 1;
  const secondLetter = index % 26;
  return String.fromCharCode(97 + firstLetter) + String.fromCharCode(97 + secondLetter);
}

/**
 * Generate weighted file descriptors from accounts.
 * Distributes accounts across rounds based on weight:
 * - Multi-round (weight>1): appear every round up to their weight
 * - Single-round (weight=1): distributed evenly across rounds with letter suffixes
 *
 * @param accounts All accounts for provider
 * @param provider CLIProxy provider name
 * @returns Array of weighted file descriptors
 */
export function generateWeightedFiles(
  accounts: AccountInfo[],
  provider: CLIProxyProvider
): WeightedFile[] {
  const result: WeightedFile[] = [];

  // Filter active accounts (not paused, weight > 0)
  const activeAccounts = accounts.filter((a) => !a.paused && (a.weight ?? 1) > 0);

  if (activeAccounts.length === 0) {
    return result;
  }

  // Calculate max rounds from highest weight
  const maxRounds = Math.max(...activeAccounts.map((a) => a.weight ?? 1));

  // Partition accounts by weight
  const multiRound = activeAccounts.filter((a) => (a.weight ?? 1) > 1);
  const singleRound = activeAccounts.filter((a) => (a.weight ?? 1) === 1);

  // Calculate distribution of single-round accounts across rounds
  const prosPerRound = Math.ceil(singleRound.length / maxRounds);

  // Generate files for each round
  for (let round = 1; round <= maxRounds; round++) {
    const roundStr = round.toString().padStart(2, '0');

    // Add multi-round accounts (no suffix, appear every round up to their weight)
    for (const account of multiRound) {
      const weight = account.weight ?? 1;
      if (round <= weight) {
        const prefix = getFilePrefix(provider);
        const filename = `${prefix}-r${roundStr}_${account.id}.json`;
        result.push({
          filename,
          accountId: account.id,
          round,
          suffix: '',
        });
      }
    }

    // Add single-round accounts for this round (with suffix)
    const startIdx = (round - 1) * prosPerRound;
    const endIdx = Math.min(startIdx + prosPerRound, singleRound.length);
    const sliceForRound = singleRound.slice(startIdx, endIdx);

    for (let i = 0; i < sliceForRound.length; i++) {
      const account = sliceForRound[i];
      const suffix = generateSuffix(i);
      const prefix = getFilePrefix(provider);
      const filename = `${prefix}-r${roundStr}${suffix}_${account.id}.json`;
      result.push({
        filename,
        accountId: account.id,
        round,
        suffix,
      });
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
  // Try r01_ file first (multi-round canonical weighted file)
  const r01Path = path.join(authDir, `${prefix}-r01_${account.id}.json`);
  if (fs.existsSync(r01Path)) {
    return r01Path;
  }

  // Try r01{suffix}_ file (single-round accounts get r01a_, r01b_, etc.)
  const weightedPattern = new RegExp(
    `^${prefix}-r\\d{2}[a-z]*_${account.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.json$`
  );
  const files = fs.readdirSync(authDir);
  const weightedFile = files.find((f) => weightedPattern.test(f));
  if (weightedFile) {
    return path.join(authDir, weightedFile);
  }

  // Fall back to original tokenFile
  return path.join(authDir, account.tokenFile);
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
      await migration.migrateOldPrefixes(provider);
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

  // Get current weighted files (matching r\d{2}[a-z]*_ pattern)
  const currentFiles = fs.readdirSync(authDir).filter((f) => {
    const prefix = getFilePrefix(provider);
    const pattern = new RegExp(`^${prefix}-r\\d{2}[a-z]*_`);
    return pattern.test(f);
  });

  // Determine files to create and remove
  const toCreate = targetFiles.filter((f) => !currentFiles.includes(f.filename));
  const toRemove = currentFiles.filter((f) => !targetFilenames.has(f));

  // Remove obsolete files
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

  // Create new files
  for (const weightedFile of toCreate) {
    const targetPath = path.join(authDir, weightedFile.filename);

    // Find account to copy token from
    const account = accounts.find((a) => a.id === weightedFile.accountId);
    if (!account) {
      console.warn(
        `Account ${weightedFile.accountId} not found, skipping ${weightedFile.filename}`
      );
      continue;
    }

    // Get canonical token content
    const canonicalPath = getCanonicalTokenPath(account, authDir, provider);
    if (!fs.existsSync(canonicalPath)) {
      console.warn(
        `Canonical token for ${account.id} not found at ${canonicalPath}, skipping ${weightedFile.filename}`
      );
      continue;
    }

    try {
      // Read canonical token
      const tokenContent = fs.readFileSync(canonicalPath, 'utf-8');

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

  // Self-healing cleanup: remove old-format (non-r{NN}) provider files
  // Catches files migration missed (no email, orphaned accounts, etc.)
  // Preserves canonical token files referenced by registered accounts
  // SAFETY: Only run when provider has registered accounts — otherwise cleanup
  // would destroy legitimate auth files that haven't been migrated yet
  const prefix = getFilePrefix(provider);
  const weightedPattern = new RegExp(`^${prefix}-r\\d{2}[a-z]*_`);
  const canonicalFiles = new Set(accounts.map((a) => a.tokenFile));

  const oldFormatFiles =
    accounts.length > 0
      ? fs.readdirSync(authDir).filter((f) => {
          if (!f.startsWith(`${prefix}-`) || !f.endsWith('.json')) return false;
          if (weightedPattern.test(f)) return false; // Already weighted format
          if (canonicalFiles.has(f)) return false; // Canonical token source — keep
          return true;
        })
      : [];

  for (const filename of oldFormatFiles) {
    try {
      fs.unlinkSync(path.join(authDir, filename));
      result.removed.push(filename);
    } catch {
      // Ignore deletion errors
    }
  }

  // Move old canonical files to auth-backup/ after r01 files are created
  // This prevents CLIProxyAPI from discovering old canonical files alongside r{NN} files
  const backupDir = path.join(path.dirname(authDir), 'auth-backup');

  // Load registry once for all accounts (avoid race condition from load/save per account)
  const { loadAccountsRegistry, saveAccountsRegistry } = await import('./account-manager');
  const registry = loadAccountsRegistry();
  let registryModified = false;

  for (const account of accounts) {
    const canonicalFile = account.tokenFile;

    // Skip if already r{NN} format (nothing to migrate)
    if (weightedPattern.test(canonicalFile)) {
      continue;
    }

    // Find any weighted file created for this account (r01_, r01a_, r01b_, etc.)
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

        // Update registry in-memory (saved once after loop)
        const providerAccounts = registry.providers[provider];
        if (providerAccounts?.accounts[account.id]) {
          providerAccounts.accounts[account.id].tokenFile = accountWeightedFile.filename;
          registryModified = true;
        }

        result.removed.push(canonicalFile);
      }
    } catch {
      // Skip on error (content mismatch, read failure, etc.)
      continue;
    }
  }

  // Save registry once after all backup operations
  if (registryModified) {
    saveAccountsRegistry(registry);
  }

  return result;
}
