/**
 * Migration Manager
 *
 * Handles migration from legacy JSON config (v1) to unified YAML config (v2).
 * Features:
 * - Automatic backup before migration
 * - Rollback support
 * - Settings file reference preservation (*.settings.json)
 * - Cache file restructuring
 *
 * Design: Settings remain in *.settings.json files (matching Claude's pattern)
 * while config.yaml stores references to these files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../utils/config-manager';
import type { ProfileConfig, AccountConfig, CLIProxyVariantConfig } from './unified-config-types';
import { createEmptyUnifiedConfig } from './unified-config-types';
import { saveUnifiedConfig, hasUnifiedConfig } from './unified-config-loader';
import { infoBox, warn } from '../utils/ui';

const BACKUP_DIR_PREFIX = 'backup-v1-';

/**
 * Migration result with details about what was migrated.
 */
export interface MigrationResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  migratedFiles: string[];
  warnings: string[];
}

/**
 * Check if migration from v1 to v2 is needed.
 */
export function needsMigration(): boolean {
  const ccsDir = getCcsDir();
  const hasOldConfig = fs.existsSync(path.join(ccsDir, 'config.json'));
  const hasNewConfig = hasUnifiedConfig();

  return hasOldConfig && !hasNewConfig;
}

/**
 * Get list of backup directories.
 */
export function getBackupDirectories(): string[] {
  const ccsDir = getCcsDir();
  if (!fs.existsSync(ccsDir)) return [];

  return fs
    .readdirSync(ccsDir)
    .filter((name) => name.startsWith(BACKUP_DIR_PREFIX))
    .map((name) => path.join(ccsDir, name))
    .sort()
    .reverse(); // Most recent first
}

/**
 * Perform migration from v1 to v2 format.
 */
export async function migrate(dryRun = false): Promise<MigrationResult> {
  const ccsDir = getCcsDir();
  const migratedFiles: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Create backup
    const timestamp = new Date().toISOString().split('T')[0];
    const backupDir = path.join(ccsDir, `${BACKUP_DIR_PREFIX}${timestamp}`);

    if (!dryRun) {
      await createBackup(ccsDir, backupDir);
    }

    // 2. Read old configs
    const oldConfig = readJsonSafe(path.join(ccsDir, 'config.json'));
    const oldProfiles = readJsonSafe(path.join(ccsDir, 'profiles.json'));

    // 3. Build unified config
    const unifiedConfig = createEmptyUnifiedConfig();

    // Set default if exists
    if (oldProfiles?.default && typeof oldProfiles.default === 'string') {
      unifiedConfig.default = oldProfiles.default;
    }

    // 4. Migrate accounts from profiles.json
    if (oldProfiles?.profiles) {
      for (const [name, meta] of Object.entries(oldProfiles.profiles)) {
        const metadata = meta as Record<string, unknown>;
        const account: AccountConfig = {
          created: (metadata.created as string) || new Date().toISOString(),
          last_used: (metadata.last_used as string) || null,
        };
        unifiedConfig.accounts[name] = account;
      }
      migratedFiles.push('profiles.json → config.yaml.accounts');
    }

    // 5. Migrate CLIProxy variants from config.json
    if (oldConfig?.cliproxy) {
      for (const [name, variantData] of Object.entries(oldConfig.cliproxy)) {
        const oldVariant = variantData as Record<string, unknown>;
        const variant: CLIProxyVariantConfig = {
          provider: oldVariant.provider as CLIProxyVariantConfig['provider'],
        };

        if (oldVariant.account) {
          variant.account = oldVariant.account as string;
        }

        // Keep reference to existing settings file
        if (oldVariant.settings) {
          variant.settings = oldVariant.settings as string;
        }

        unifiedConfig.cliproxy.variants[name] = variant;
      }
      migratedFiles.push('config.json.cliproxy → config.yaml.cliproxy.variants');
    }

    // 6. Migrate API profiles from config.json
    // Keep settings in *.settings.json files (matching Claude's ~/.claude/settings.json pattern)
    // config.yaml only stores reference to the settings file
    if (oldConfig?.profiles) {
      for (const [name, settingsPath] of Object.entries(oldConfig.profiles)) {
        const pathStr = settingsPath as string;
        const expandedPath = expandPath(pathStr);

        // Verify settings file exists
        if (!fs.existsSync(expandedPath)) {
          warnings.push(`Skipped ${name}: settings file not found at ${pathStr}`);
          continue;
        }

        // Store reference to settings file (keep using ~ for portability)
        const profile: ProfileConfig = {
          type: 'api',
          settings: pathStr,
        };
        unifiedConfig.profiles[name] = profile;
        migratedFiles.push(`config.json.profiles.${name} → config.yaml (settings: ${pathStr})`);
      }
    }

    // 6b. Migrate built-in CLIProxy OAuth profile settings (gemini, codex, agy, qwen, iflow)
    // Keep settings in *.settings.json files - only record reference in config.yaml
    // This matches Claude's ~/.claude/settings.json pattern for user familiarity
    const builtInProviders = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
    for (const provider of builtInProviders) {
      const settingsFile = `${provider}.settings.json`;
      const settingsPath = path.join(ccsDir, settingsFile);

      if (fs.existsSync(settingsPath)) {
        // Create variant with reference to settings file
        const variant: CLIProxyVariantConfig = {
          provider: provider as CLIProxyVariantConfig['provider'],
          settings: `~/.ccs/${settingsFile}`,
        };

        unifiedConfig.cliproxy.variants[provider] = variant;
        migratedFiles.push(`${settingsFile} → config.yaml.cliproxy.variants.${provider}`);
      }
    }

    // 7. Migrate cache files
    if (!dryRun) {
      const cacheDir = path.join(ccsDir, 'cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      if (moveIfExists(path.join(ccsDir, 'usage-cache.json'), path.join(cacheDir, 'usage.json'))) {
        migratedFiles.push('usage-cache.json → cache/usage.json');
      }

      if (
        moveIfExists(
          path.join(ccsDir, 'update-check.json'),
          path.join(cacheDir, 'update-check.json')
        )
      ) {
        migratedFiles.push('update-check.json → cache/update-check.json');
      }
    }

    // 8. Write new config (unless dry run)
    // Note: Settings remain in *.settings.json files, config.yaml only stores references
    if (!dryRun) {
      saveUnifiedConfig(unifiedConfig);
    }

    return {
      success: true,
      backupPath: dryRun ? undefined : backupDir,
      migratedFiles,
      warnings,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      migratedFiles,
      warnings,
    };
  }
}

/**
 * Rollback migration by restoring from backup.
 */
export async function rollback(backupPath: string): Promise<boolean> {
  const ccsDir = getCcsDir();

  if (!fs.existsSync(backupPath)) {
    console.error(`[X] Backup not found: ${backupPath}`);
    return false;
  }

  try {
    // Remove new config files
    const configYaml = path.join(ccsDir, 'config.yaml');
    const cacheDir = path.join(ccsDir, 'cache');

    if (fs.existsSync(configYaml)) fs.unlinkSync(configYaml);

    // Restore cache files to original locations
    if (fs.existsSync(cacheDir)) {
      moveIfExists(path.join(cacheDir, 'usage.json'), path.join(ccsDir, 'usage-cache.json'));
      moveIfExists(
        path.join(cacheDir, 'update-check.json'),
        path.join(ccsDir, 'update-check.json')
      );

      // Remove cache dir if empty
      const remaining = fs.readdirSync(cacheDir);
      if (remaining.length === 0) {
        fs.rmdirSync(cacheDir);
      }
    }

    // Restore files from backup
    const files = fs.readdirSync(backupPath);
    for (const file of files) {
      fs.copyFileSync(path.join(backupPath, file), path.join(ccsDir, file));
    }

    return true;
  } catch (err) {
    console.error(`[X] Rollback failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return false;
  }
}

// --- Helper Functions ---

/**
 * Read JSON file safely, returning null on error or if file doesn't exist.
 */
function readJsonSafe(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Expand ~ to home directory in path.
 */
function expandPath(p: string): string {
  return p.replace(/^~/, process.env.HOME || '');
}

/**
 * Move file if it exists. Returns true if moved, false if source didn't exist.
 */
function moveIfExists(from: string, to: string): boolean {
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
    return true;
  }
  return false;
}

/**
 * Create backup of all v1 config files.
 */
async function createBackup(srcDir: string, backupDir: string): Promise<void> {
  // Check if backup already exists (prevent overwriting)
  if (fs.existsSync(backupDir)) {
    // Add timestamp suffix to make unique
    const suffix = Date.now().toString(36);
    const uniqueBackupDir = `${backupDir}-${suffix}`;
    fs.mkdirSync(uniqueBackupDir, { recursive: true });
    await performBackup(srcDir, uniqueBackupDir);
    return;
  }

  fs.mkdirSync(backupDir, { recursive: true });
  await performBackup(srcDir, backupDir);
}

async function performBackup(srcDir: string, backupDir: string): Promise<void> {
  const filesToBackup = ['config.json', 'profiles.json', 'usage-cache.json', 'update-check.json'];

  // Also backup *.settings.json files
  const allFiles = fs.readdirSync(srcDir);
  const settingsFiles = allFiles.filter((f) => f.endsWith('.settings.json'));
  filesToBackup.push(...settingsFiles);

  for (const file of filesToBackup) {
    const src = path.join(srcDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupDir, file));
    }
  }
}

/**
 * Auto-migrate on first run after update.
 * Silent if already migrated or no config exists.
 * Shows friendly message with backup location on success.
 */
export async function autoMigrate(): Promise<void> {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test' || process.env.CCS_SKIP_MIGRATION === '1') {
    return;
  }

  // Skip if no migration needed
  if (!needsMigration()) {
    return;
  }

  const result = await migrate(false);

  if (result.success) {
    console.log('');
    console.log(infoBox('Migrated to unified config (config.yaml)', 'SUCCESS'));
    console.log(`  Backup: ${result.backupPath}`);
    console.log(`  Items:  ${result.migratedFiles.length} migrated`);
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(warn(warning));
      }
    }
    console.log(`  Rollback: ccs migrate --rollback ${result.backupPath}`);
    console.log('');
  } else {
    console.log('');
    console.log(infoBox('Migration failed - using legacy config', 'WARNING'));
    console.log(`  Error: ${result.error}`);
    console.log('  Retry: ccs migrate');
    console.log('');
  }
}
