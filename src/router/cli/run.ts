import { spawn } from 'child_process';
import { color } from '../../utils/ui';
import { getRouterProfile, getRouterPort, listRouterProfiles } from '../config/loader';
import { isProfileRunnable } from '../config/validator';
import { startRouter } from '../server';
import { getRouterEnvVars } from '../config/generator';
import { checkProviderHealth } from '../providers/health';
import { getAllProviders } from '../providers/registry';

interface RunOptions {
  debug?: boolean;
  port?: number;
}

/**
 * Run Claude CLI with router profile
 * Usage: ccs router run <profile> [--debug] [--port 9400]
 */
export async function runCommand(profileName: string, options: RunOptions = {}): Promise<void> {
  // Get profile
  const profile = getRouterProfile(profileName);
  if (!profile) {
    console.log(`${color('[X]', 'error')} Profile "${profileName}" not found`);
    console.log('    Available: ' + listRouterProfiles().join(', '));
    process.exit(1);
  }

  // Check if runnable
  const { runnable, missing } = await isProfileRunnable(profileName);
  if (!runnable) {
    console.log(`${color('[X]', 'error')} Profile "${profileName}" cannot run:`);
    missing.forEach((m) => console.log(`    - ${m}`));
    process.exit(1);
  }

  const port = options.port ?? getRouterPort();

  // Pre-flight health checks
  console.log(`[i] Checking provider health...`);
  const providers = await getAllProviders();
  const neededProviders = new Set([
    profile.tiers.opus.provider,
    profile.tiers.sonnet.provider,
    profile.tiers.haiku.provider,
  ]);

  for (const p of providers) {
    if (neededProviders.has(p.name)) {
      const health = await checkProviderHealth(p);
      if (!health.healthy) {
        console.log(`${color('[!]', 'warning')} ${p.name}: ${health.error}`);
      } else if (options.debug) {
        console.log(`${color('[OK]', 'success')} ${p.name}: ${health.latency}ms`);
      }
    }
  }

  // Start router server
  console.log(`[i] Starting router on port ${port}...`);
  const { stop } = startRouter(profile, profileName, port);

  // Get environment variables for Claude CLI
  const env = {
    ...process.env,
    ...getRouterEnvVars(profile, port),
  };

  if (options.debug) {
    console.log(`[i] Routing configuration:`);
    console.log(`    opus:   ${profile.tiers.opus.provider}/${profile.tiers.opus.model}`);
    console.log(`    sonnet: ${profile.tiers.sonnet.provider}/${profile.tiers.sonnet.model}`);
    console.log(`    haiku:  ${profile.tiers.haiku.provider}/${profile.tiers.haiku.model}`);
  }

  // Spawn Claude CLI
  console.log(`[i] Starting Claude CLI...`);
  const claude = spawn('claude', process.argv.slice(4), {
    stdio: 'inherit',
    env,
  });

  // Handle signals
  const cleanup = () => {
    stop();
    claude.kill();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for Claude to exit
  claude.on('exit', (code) => {
    stop();
    process.exit(code ?? 0);
  });
}

// CLI registration
export const runCommandConfig = {
  name: 'run <profile>',
  description: 'Run Claude CLI with router profile',
  options: [
    { flag: '--debug', description: 'Show routing debug info' },
    { flag: '--port <port>', description: 'Router port (default: 9400)' },
  ],
  action: runCommand,
};
