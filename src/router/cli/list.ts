import { color, bold, dim } from '../../utils/ui';
import { listRouterProfiles, getRouterProfile } from '../config/loader';
import { isProfileRunnable } from '../config/validator';

interface ListOptions {
  verbose?: boolean;
}

/**
 * List all router profiles
 * Usage: ccs router list [--verbose]
 */
export async function listCommand(options: ListOptions = {}): Promise<void> {
  const profiles = listRouterProfiles();

  if (profiles.length === 0) {
    console.log('[i] No router profiles configured');
    console.log('    Create one with: ccs router create <name>');
    return;
  }

  console.log(`\n${bold('Router Profiles:')}\n`);

  for (const name of profiles) {
    const profile = getRouterProfile(name);
    const { runnable, missing } = await isProfileRunnable(name);

    const status = runnable ? color('[OK]', 'success') : color('[!]', 'error');

    console.log(`  ${status} ${bold(name)}`);

    if (profile?.description) {
      console.log(`      ${dim(profile.description)}`);
    }

    if (options.verbose && profile) {
      console.log(`      opus:   ${profile.tiers.opus.provider}/${profile.tiers.opus.model}`);
      console.log(`      sonnet: ${profile.tiers.sonnet.provider}/${profile.tiers.sonnet.model}`);
      console.log(`      haiku:  ${profile.tiers.haiku.provider}/${profile.tiers.haiku.model}`);
    }

    if (!runnable) {
      console.log(`      ${color('Missing:', 'error')} ${missing.join(', ')}`);
    }

    console.log('');
  }
}

// CLI registration
export const listCommandConfig = {
  name: 'list',
  description: 'List all router profiles',
  options: [{ flag: '-v, --verbose', description: 'Show tier mappings' }],
  action: listCommand,
};
