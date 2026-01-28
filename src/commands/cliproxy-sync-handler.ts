/**
 * CLIProxy Sync Command Handler
 *
 * Handles `ccs cliproxy sync` command for syncing API profiles to local CLIProxy config.
 */

import { syncToLocalConfig, generateSyncPreview, getLocalSyncStatus } from '../cliproxy/sync';
import { initUI, header, subheader, color, dim, ok, fail, warn, info, table } from '../utils/ui';

interface SyncArgs {
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
}

/**
 * Parse sync command arguments.
 */
export function parseSyncArgs(args: string[]): SyncArgs {
  return {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    force: args.includes('--force') || args.includes('-f'),
  };
}

/**
 * Handle `ccs cliproxy sync` command.
 */
export async function handleSync(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseSyncArgs(args);

  console.log(header('CLIProxy Profile Sync'));
  console.log('');

  // Check status
  const status = getLocalSyncStatus();

  if (!status.configExists) {
    console.log(fail('CLIProxy config not found'));
    console.log('');
    console.log('Run to generate config:');
    console.log(`  ${color('ccs doctor --fix', 'command')}`);
    console.log('');
    process.exit(1);
  }

  // Get preview
  const preview = generateSyncPreview();

  if (preview.length === 0) {
    console.log(warn('No API profiles configured to sync'));
    console.log('');
    console.log('Configure API profiles with:');
    console.log(`  ${color('ccs api create', 'command')}`);
    console.log('');
    return;
  }

  // Show preview
  console.log(subheader(`Profiles to Sync (${preview.length})`));
  console.log('');

  const rows = preview.map((p) => {
    const model = p.modelName ? color(p.modelName, 'info') : dim('default');
    const url = p.baseUrl ? dim(p.baseUrl) : dim('-');
    return [p.name, url, model];
  });

  console.log(table(rows, { head: ['Profile', 'Base URL', 'Model'], colWidths: [15, 40, 20] }));
  console.log('');

  if (parsed.verbose) {
    console.log(dim(`Config path: ${status.configPath}`));
    console.log(dim(`Current keys: ${status.currentKeyCount}`));
    console.log('');
  }

  // Dry-run mode
  if (parsed.dryRun) {
    console.log(info('Dry-run mode - no changes will be made'));
    console.log('');
    console.log(`Would sync ${preview.length} profile(s) to:`);
    console.log(`  ${dim(status.configPath)}`);
    console.log('');
    console.log('Run without --dry-run to apply changes:');
    console.log(`  ${color('ccs cliproxy sync', 'command')}`);
    console.log('');
    return;
  }

  // Execute sync
  console.log(info('Syncing profiles to local config...'));

  const result = syncToLocalConfig();

  if (!result.success) {
    console.log('');
    console.log(fail(`Sync failed: ${result.error}`));
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log(ok(`Synced ${result.syncedCount} profile(s)`));
  console.log(`  ${dim(result.configPath)}`);
  console.log('');

  // Show synced profiles
  for (const p of preview) {
    console.log(`  ${ok('')} ${p.name}`);
  }
  console.log('');

  console.log(info('Restart CLIProxy to apply changes:'));
  console.log(`  ${color('ccs cliproxy stop && ccs gemini', 'command')}`);
  console.log('');
}
