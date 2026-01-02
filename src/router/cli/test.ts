import { color, bold } from '../../utils/ui';
import { getRouterProfile } from '../config/loader';
import { validateProfile } from '../config/validator';
import { resolveRoute } from '../resolver/route';
import { checkProviderHealth } from '../providers/health';
import { getProvider } from '../providers/registry';

interface TestOptions {
  verbose?: boolean;
}

const TEST_MODELS = [
  'claude-opus-4-5-20251124',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251015',
];

/**
 * Test router profile configuration
 * Usage: ccs router test <profile> [--verbose]
 */
export async function testCommand(profileName: string, _options: TestOptions = {}): Promise<void> {
  const profile = getRouterProfile(profileName);

  if (!profile) {
    console.log(`${color('[X]', 'error')} Profile "${profileName}" not found`);
    process.exit(1);
  }

  console.log(`\n${bold('Testing Router Profile: ' + profileName)}\n`);

  // Validate configuration
  console.log(`${color('Configuration Validation:', 'info')}`);
  const validation = await validateProfile(profileName, profile);

  if (validation.valid) {
    console.log(`  ${color('[OK]', 'success')} All providers configured correctly`);
  } else {
    validation.errors.forEach((e) => console.log(`  ${color('[X]', 'error')} ${e}`));
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach((w) => console.log(`  ${color('[!]', 'warning')} ${w}`));
  }

  console.log('');

  // Test route resolution
  console.log(`${color('Route Resolution:', 'info')}`);
  for (const model of TEST_MODELS) {
    try {
      const route = await resolveRoute(model, profile);
      console.log(`  ${color('[OK]', 'success')} ${model}`);
      console.log(`      -> ${route.tier} -> ${route.provider.name}/${route.targetModel}`);
    } catch (error) {
      console.log(`  ${color('[X]', 'error')} ${model}: ${(error as Error).message}`);
    }
  }

  console.log('');

  // Test provider health
  console.log(`${color('Provider Health:', 'info')}`);
  const providerNames = new Set([
    profile.tiers.opus.provider,
    profile.tiers.sonnet.provider,
    profile.tiers.haiku.provider,
  ]);

  let allHealthy = true;
  for (const name of providerNames) {
    const provider = await getProvider(name);
    if (!provider) {
      console.log(`  ${color('[X]', 'error')} ${name}: not found`);
      allHealthy = false;
      continue;
    }

    const health = await checkProviderHealth(provider);
    if (health.healthy) {
      console.log(`  ${color('[OK]', 'success')} ${name}: ${health.latency}ms`);
    } else {
      console.log(`  ${color('[X]', 'error')} ${name}: ${health.error}`);
      allHealthy = false;
    }
  }

  console.log('');

  // Summary
  if (validation.valid && allHealthy) {
    console.log(`${color('[OK]', 'success')} Profile "${profileName}" is ready to use`);
    console.log(`    Run with: ccs ${profileName}`);
  } else {
    console.log(`${color('[!]', 'warning')} Profile has issues - may not work correctly`);
    process.exit(1);
  }
}

// CLI registration
export const testCommandConfig = {
  name: 'test <profile>',
  description: 'Test router profile configuration',
  options: [{ flag: '-v, --verbose', description: 'Show detailed output' }],
  action: testCommand,
};
