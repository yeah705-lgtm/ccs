import { color, bold } from '../../utils/ui';
import { listProviders } from '../providers/registry';
import { getRouterProfile } from '../config/loader';
import { validateProfile } from '../config/validator';
import { saveRouterProfile } from '../config/writer';
import type { RouterProfile, TierConfig } from '../config/schema';

interface CreateOptions {
  copy?: string;
  fromPreset?: string;
  description?: string;
}

// Profile name validation
const RESERVED_NAMES = [
  'help',
  'list',
  'ls',
  'create',
  'run',
  'test',
  'providers',
  'default',
  'all',
];
const PROFILE_NAME_REGEX = /^[a-zA-Z0-9][-a-zA-Z0-9_]*$/;

function validateProfileName(name: string): string | null {
  if (!name || name.length === 0) {
    return 'Profile name cannot be empty';
  }
  if (name.length > 32) {
    return 'Profile name must be 32 characters or less';
  }
  if (RESERVED_NAMES.includes(name.toLowerCase())) {
    return `"${name}" is a reserved name`;
  }
  if (!PROFILE_NAME_REGEX.test(name)) {
    return 'Profile name must start with alphanumeric and contain only letters, numbers, dashes, underscores';
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return 'Profile name cannot contain path characters';
  }
  return null; // Valid
}

// Preset configurations
const PRESETS: Record<string, RouterProfile> = {
  balanced: {
    description: 'Balanced performance and cost',
    tiers: {
      opus: { provider: 'agy', model: 'gemini-claude-opus-4-5-thinking' },
      sonnet: { provider: 'gemini', model: 'gemini-2.5-pro' },
      haiku: { provider: 'glm', model: 'glm-4-flash' },
    },
  },
  budget: {
    description: 'Cost optimized - GLM primary',
    tiers: {
      opus: { provider: 'glm', model: 'glm-4.7' },
      sonnet: { provider: 'glm', model: 'glm-4.7' },
      haiku: { provider: 'glm', model: 'glm-4-flash' },
    },
  },
  premium: {
    description: 'Maximum quality - Antigravity focus',
    tiers: {
      opus: { provider: 'agy', model: 'gemini-claude-opus-4-5-thinking' },
      sonnet: { provider: 'agy', model: 'gemini-claude-opus-4-5-thinking' },
      haiku: { provider: 'gemini', model: 'gemini-2.5-flash' },
    },
  },
};

/**
 * Create new router profile
 * Usage: ccs router create <name> [--copy existing] [--from-preset balanced]
 */
export async function createCommand(name: string, options: CreateOptions = {}): Promise<void> {
  // Validate profile name
  const nameError = validateProfileName(name);
  if (nameError) {
    console.log(`${color('[X]', 'error')} Invalid profile name: ${nameError}`);
    process.exit(1);
  }

  // Check if profile already exists
  if (getRouterProfile(name)) {
    console.log(`${color('[X]', 'error')} Profile "${name}" already exists`);
    console.log('    Use: ccs router edit ' + name);
    process.exit(1);
  }

  let profile: RouterProfile;

  // Copy from existing profile
  if (options.copy) {
    const source = getRouterProfile(options.copy);
    if (!source) {
      console.log(`${color('[X]', 'error')} Source profile "${options.copy}" not found`);
      process.exit(1);
    }
    profile = JSON.parse(JSON.stringify(source));
    profile.description = options.description || `Copy of ${options.copy}`;
  }
  // Use preset
  else if (options.fromPreset) {
    const preset = PRESETS[options.fromPreset];
    if (!preset) {
      console.log(`${color('[X]', 'error')} Unknown preset: ${options.fromPreset}`);
      console.log('    Available: ' + Object.keys(PRESETS).join(', '));
      process.exit(1);
    }
    profile = JSON.parse(JSON.stringify(preset));
    if (options.description) {
      profile.description = options.description;
    }
  }
  // Interactive wizard
  else {
    profile = await runInteractiveWizard(name);
  }

  // Validate profile
  const validation = await validateProfile(name, profile);
  if (!validation.valid) {
    console.log(`${color('[!]', 'warning')} Profile has issues:`);
    validation.errors.forEach((e) => console.log(`    ${color(e, 'error')}`));
    // Continue anyway with warning
  }

  // Save profile
  await saveRouterProfile(name, profile);
  console.log(`${color('[OK]', 'success')} Created router profile: ${name}`);
  console.log(`    Run with: ccs ${name}`);
}

/**
 * Interactive wizard for creating profile
 */
async function runInteractiveWizard(name: string): Promise<RouterProfile> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let completed = false;

  rl.on('close', () => {
    if (!completed) {
      console.log('\n[i] Profile creation cancelled');
      process.exit(0);
    }
  });

  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  console.log(`\n${bold('Create Router Profile: ' + name)}\n`);

  // List available providers
  const providers = await listProviders();
  console.log('Available providers:');
  console.log('  CLIProxy: ' + providers.cliproxy.join(', '));
  if (providers.api.length > 0) {
    console.log('  API:      ' + providers.api.join(', '));
  }
  console.log('');

  // Configure each tier
  const tiers: RouterProfile['tiers'] = {
    opus: await configureTier(ask, 'opus', 'agy'),
    sonnet: await configureTier(ask, 'sonnet', 'gemini'),
    haiku: await configureTier(ask, 'haiku', 'glm'),
  };

  const description = await ask('Description (optional): ');

  completed = true;
  rl.close();

  return {
    description: description || undefined,
    tiers,
  };
}

async function configureTier(
  ask: (q: string) => Promise<string>,
  tier: string,
  defaultProvider: string
): Promise<TierConfig> {
  const provider = await ask(`${tier} provider [${defaultProvider}]: `);
  const model = await ask(`${tier} model: `);

  return {
    provider: provider || defaultProvider,
    model: model || `${defaultProvider}-default`,
  };
}

// CLI registration
export const createCommandConfig = {
  name: 'create <name>',
  description: 'Create a new router profile',
  options: [
    { flag: '--copy <profile>', description: 'Copy from existing profile' },
    { flag: '--from-preset <preset>', description: 'Use preset (balanced, budget, premium)' },
    { flag: '-d, --description <text>', description: 'Profile description' },
  ],
  action: createCommand,
};
