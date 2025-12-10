/**
 * Migrate Command
 *
 * CLI command to migrate from v1 (JSON) to v2 (YAML) config format.
 *
 * Usage:
 *   ccs migrate           - Run migration
 *   ccs migrate --dry-run - Preview migration without changes
 *   ccs migrate --rollback <path> - Restore from backup
 *   ccs migrate --list-backups    - List available backups
 */

import {
  migrate,
  rollback,
  needsMigration,
  getBackupDirectories,
} from '../config/migration-manager';
import { hasUnifiedConfig } from '../config/unified-config-loader';

export async function handleMigrateCommand(args: string[]): Promise<void> {
  // Handle --list-backups
  if (args.includes('--list-backups')) {
    listBackups();
    return;
  }

  // Handle --rollback
  if (args.includes('--rollback')) {
    const rollbackIndex = args.indexOf('--rollback');
    const backupPath = args[rollbackIndex + 1];

    if (!backupPath) {
      console.error('[X] Error: --rollback requires backup path');
      console.log('[i] Usage: ccs migrate --rollback <backup-path>');
      console.log('[i] Use --list-backups to see available backups');
      process.exit(1);
    }

    await handleRollback(backupPath);
    return;
  }

  // Check if already migrated
  if (hasUnifiedConfig() && !needsMigration()) {
    console.log('[i] Already using unified config format (config.yaml)');
    return;
  }

  // Check if migration is needed
  if (!needsMigration()) {
    console.log('[i] No migration needed - no legacy config found');
    return;
  }

  // Handle --dry-run
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('[i] Dry run - no changes will be made');
    console.log('');
  }

  console.log('[i] Migrating to unified config format (v2)...');
  console.log('');

  const result = await migrate(dryRun);

  if (result.success) {
    console.log('[OK] Migration complete');
    console.log('');

    if (result.backupPath) {
      console.log(`    Backup created: ${result.backupPath}`);
    }

    if (result.migratedFiles.length > 0) {
      console.log('');
      console.log('    Migrated:');
      result.migratedFiles.forEach((f) => console.log(`      - ${f}`));
    }

    if (result.warnings.length > 0) {
      console.log('');
      console.log('    Warnings:');
      result.warnings.forEach((w) => console.log(`      [!] ${w}`));
    }

    if (dryRun) {
      console.log('');
      console.log('[i] This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('');
      console.log('[i] To rollback: ccs migrate --rollback ' + result.backupPath);
    }
  } else {
    console.error(`[X] Migration failed: ${result.error}`);

    if (result.migratedFiles.length > 0) {
      console.log('');
      console.log('    Partially migrated:');
      result.migratedFiles.forEach((f) => console.log(`      - ${f}`));
    }

    process.exit(1);
  }
}

async function handleRollback(backupPath: string): Promise<void> {
  console.log(`[i] Rolling back from: ${backupPath}`);
  console.log('');

  const success = await rollback(backupPath);

  if (success) {
    console.log('[OK] Rollback complete');
    console.log('[i] Legacy config restored');
  } else {
    console.error('[X] Rollback failed');
    process.exit(1);
  }
}

function listBackups(): void {
  const backups = getBackupDirectories();

  if (backups.length === 0) {
    console.log('[i] No backup directories found');
    return;
  }

  console.log('[i] Available backups (most recent first):');
  console.log('');
  backups.forEach((backup, index) => {
    console.log(`    ${index + 1}. ${backup}`);
  });
  console.log('');
  console.log('[i] To rollback: ccs migrate --rollback <backup-path>');
}

/**
 * Print help for migrate command.
 */
export function printMigrateHelp(): void {
  console.log('Usage: ccs migrate [options]');
  console.log('');
  console.log('Migrate from legacy JSON config to unified YAML format.');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run        Preview migration without making changes');
  console.log('  --rollback PATH  Restore from backup directory');
  console.log('  --list-backups   List available backup directories');
  console.log('  --help           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ccs migrate                      # Run migration');
  console.log('  ccs migrate --dry-run            # Preview changes');
  console.log('  ccs migrate --list-backups       # List backups');
  console.log('  ccs migrate --rollback ~/.ccs/backup-v1-2025-01-15');
}
