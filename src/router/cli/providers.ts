import { color, bold } from '../../utils/ui';
import { listProviders, getAllProviders } from '../providers/registry';
import { checkAllProvidersHealth } from '../providers/health';

interface ProvidersOptions {
  type?: 'cliproxy' | 'api' | 'all';
  health?: boolean;
}

/**
 * List available providers
 * Usage: ccs router providers [--type cliproxy|api] [--health]
 */
export async function providersCommand(options: ProvidersOptions = {}): Promise<void> {
  const providers = await listProviders();
  const type = options.type ?? 'all';

  console.log(`\n${bold('Available Providers:')}\n`);

  // Show CLIProxy providers
  if (type === 'all' || type === 'cliproxy') {
    console.log(`${color('CLIProxy (OAuth-based):', 'info')}`);
    for (const name of providers.cliproxy) {
      console.log(`  - ${name}`);
    }
    console.log('');
  }

  // Show API providers
  if (type === 'all' || type === 'api') {
    console.log(`${color('API (Key-based):', 'info')}`);
    if (providers.api.length === 0) {
      console.log('  (none configured)');
      console.log('  Add in config.yaml: router.providers.<name>');
    } else {
      for (const name of providers.api) {
        console.log(`  - ${name}`);
      }
    }
    console.log('');
  }

  // Health check if requested
  if (options.health) {
    console.log(`${color('Health Status:', 'info')}`);
    const allProviders = await getAllProviders();
    const health = await checkAllProvidersHealth(allProviders);

    for (const result of health) {
      const status = result.healthy ? color('[OK]', 'success') : color('[X]', 'error');
      const latency = result.latency ? `${result.latency}ms` : '';
      const error = result.error ? ` (${result.error})` : '';

      console.log(`  ${status} ${result.provider} ${latency}${error}`);
    }
  }
}

// CLI registration
export const providersCommandConfig = {
  name: 'providers',
  description: 'List available providers',
  options: [
    { flag: '-t, --type <type>', description: 'Filter by type (cliproxy, api)' },
    { flag: '--health', description: 'Show health status' },
  ],
  action: providersCommand,
};
