/**
 * Weight Migration Module
 *
 * Migrates old k_, m_, z_ prefixed auth files to weighted round-robin structure.
 * One-time migration that executes automatically on first sync.
 *
 * Old pattern: antigravity-{prefix}{email}.json (k_, m_, z_, or empty)
 * New pattern: antigravity-r{NN}{suffix}_{email}.json (weighted round-robin)
 *
 * Migration logic:
 * 1. Detect old prefix files (excludes r{NN}_ pattern)
 * 2. Group by email (read from JSON content, not filename)
 * 3. Calculate weight = duplicate count
 * 4. Update registry with weights
 * 5. Generate new weighted files via syncWeightedAuthFiles
 * 6. Remove old prefixed files
 * 7. Mark migration complete
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIProxyProvider } from './types';
import { setAccountWeight } from './account-manager';
import { getAuthDir, getCliproxyDir } from './config-generator';
import { syncWeightedAuthFiles } from './weighted-round-robin-sync';

/** Migration marker version */
const MIGRATION_MARKER = '.weight-migration-v1';

/** Old prefix file descriptor */
interface OldPrefixFile {
  /** Filename */
  filename: string;
  /** Email from JSON content */
  email: string;
  /** File modification time (for canonical selection) */
  mtime: Date;
  /** Has k_ prefix (preferred canonical) */
  hasKPrefix: boolean;
}

/** Email group for weight calculation */
interface EmailGroup {
  /** Email address */
  email: string;
  /** Weight (duplicate count) */
  weight: number;
  /** Canonical file to preserve */
  canonicalFile: string;
}

/**
 * Check if migration is complete for provider.
 */
export function isMigrationComplete(provider: CLIProxyProvider): boolean {
  const markerPath = path.join(getCliproxyDir(), `${MIGRATION_MARKER}-${provider}`);
  return fs.existsSync(markerPath);
}

/**
 * Mark migration as complete for provider.
 */
function markMigrationComplete(provider: CLIProxyProvider): void {
  const markerPath = path.join(getCliproxyDir(), `${MIGRATION_MARKER}-${provider}`);
  const dir = path.dirname(markerPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(markerPath, new Date().toISOString(), { mode: 0o600 });
}

/**
 * Detect old prefix files for provider.
 * Pattern: {provider}-{prefix}{email}.json where prefix is k_, m_, z_, or empty
 * Excludes: r{NN}_ pattern (already migrated)
 *
 * Reads email from JSON content, not filename parsing.
 */
function detectOldPrefixFiles(provider: CLIProxyProvider): OldPrefixFile[] {
  const authDir = getAuthDir();
  const result: OldPrefixFile[] = [];

  if (!fs.existsSync(authDir)) {
    return result;
  }

  const files = fs.readdirSync(authDir);

  for (const filename of files) {
    // Must be JSON file for this provider
    if (!filename.endsWith('.json') || !filename.startsWith(`${provider}-`)) {
      continue;
    }

    // Skip if already weighted (r{NN}_ pattern)
    if (/^[^-]+-r\d{2}[a-z]*_/.test(filename)) {
      continue;
    }

    // Read email from JSON content
    const filePath = path.join(authDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const email = data.email || '';

      if (!email) {
        // Skip files without email
        continue;
      }

      const stats = fs.statSync(filePath);
      const hasKPrefix = filename.includes('-k_');

      result.push({
        filename,
        email,
        mtime: stats.mtime,
        hasKPrefix,
      });
    } catch {
      // Skip invalid JSON files
      continue;
    }
  }

  return result;
}

/**
 * Group old prefix files by email and calculate weights.
 * Canonical selection: prefer k_ prefix, then newest mtime.
 */
function groupByEmail(files: OldPrefixFile[]): EmailGroup[] {
  const emailMap = new Map<string, OldPrefixFile[]>();

  // Group files by email
  for (const file of files) {
    const existing = emailMap.get(file.email) || [];
    existing.push(file);
    emailMap.set(file.email, existing);
  }

  // Calculate weight and select canonical
  const result: EmailGroup[] = [];

  for (const [email, group] of emailMap.entries()) {
    const weight = group.length;

    // Select canonical: prefer k_ prefix, then newest mtime
    const kPrefixFiles = group.filter((f) => f.hasKPrefix);
    let canonical: OldPrefixFile;

    if (kPrefixFiles.length > 0) {
      // Pick newest k_ prefixed file
      canonical = kPrefixFiles.reduce((a, b) => (a.mtime > b.mtime ? a : b));
    } else {
      // Pick newest file overall
      canonical = group.reduce((a, b) => (a.mtime > b.mtime ? a : b));
    }

    result.push({
      email,
      weight,
      canonicalFile: canonical.filename,
    });
  }

  return result;
}

/**
 * Migrate old prefix files to weighted round-robin structure.
 * Auto-executes on first sync (per validation decision).
 *
 * @param provider CLIProxy provider
 * @returns Migration result with count of migrated accounts
 */
export async function migrateOldPrefixes(
  provider: CLIProxyProvider
): Promise<{ migrated: number; skipped: boolean }> {
  // Check if already migrated
  if (isMigrationComplete(provider)) {
    return { migrated: 0, skipped: true };
  }

  // Detect old prefix files
  const oldFiles = detectOldPrefixFiles(provider);

  if (oldFiles.length === 0) {
    // No files to migrate, mark complete
    markMigrationComplete(provider);
    return { migrated: 0, skipped: false };
  }

  // Group by email and calculate weights
  const groups = groupByEmail(oldFiles);

  // Update weights in registry
  for (const group of groups) {
    try {
      setAccountWeight(provider, group.email, group.weight);
    } catch (error) {
      console.warn(`Failed to set weight for ${group.email}:`, error);
    }
  }

  // Generate new weighted files
  await syncWeightedAuthFiles(provider);

  // Remove old prefixed files
  const authDir = getAuthDir();
  for (const file of oldFiles) {
    const filePath = path.join(authDir, file.filename);
    try {
      fs.unlinkSync(filePath);
    } catch {
      console.warn(`Warning: Could not remove old file: ${file.filename}`);
    }
  }

  // Mark migration complete
  markMigrationComplete(provider);

  return { migrated: groups.length, skipped: false };
}
