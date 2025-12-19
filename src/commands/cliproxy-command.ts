/**
 * CLIProxy Command Handler
 *
 * Manages CLIProxyAPI binary installation and profile variants.
 *
 * Binary commands:
 *   ccs cliproxy                  Show current version
 *   ccs cliproxy --install <ver>  Install specific version
 *   ccs cliproxy --latest         Install latest version
 *
 * Profile commands:
 *   ccs cliproxy create <name>    Create CLIProxy variant profile
 *   ccs cliproxy list             List all CLIProxy variant profiles
 *   ccs cliproxy remove <name>    Remove CLIProxy variant profile
 *
 * Supports dual-mode configuration:
 * - Unified YAML format (config.yaml) when CCS_UNIFIED_CONFIG=1 or config.yaml exists
 * - Legacy JSON format (config.json) as fallback
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getInstalledCliproxyVersion,
  installCliproxyVersion,
  fetchLatestCliproxyVersion,
  isCLIProxyInstalled,
  getCLIProxyPath,
  getPinnedVersion,
  savePinnedVersion,
  clearPinnedVersion,
  isVersionPinned,
} from '../cliproxy';
import { getAllAuthStatus, getOAuthConfig, triggerOAuth } from '../cliproxy/auth-handler';
import { getProviderAccounts } from '../cliproxy/account-manager';
import { CLIPROXY_FALLBACK_VERSION } from '../cliproxy/platform-detector';
import { CLIPROXY_PROFILES, CLIProxyProfileName } from '../auth/profile-detector';
import { getCcsDir, getConfigPath, loadConfig } from '../utils/config-manager';
import { getClaudeEnvVars, CLIPROXY_DEFAULT_PORT } from '../cliproxy/config-generator';
import { getProviderCatalog, supportsModelConfig, ModelEntry } from '../cliproxy/model-catalog';
import { CLIProxyProvider } from '../cliproxy/types';
import {
  initUI,
  header,
  subheader,
  color,
  dim,
  ok,
  fail,
  warn,
  info,
  table,
  infoBox,
} from '../utils/ui';
import { InteractivePrompt } from '../utils/prompt';
import { isReservedName } from '../config/reserved-names';
import {
  hasUnifiedConfig,
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
} from '../config/unified-config-loader';
import { isUnifiedConfigEnabled } from '../config/feature-flags';
import { stopProxy, getProxyStatus } from '../cliproxy/session-tracker';

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

interface CliproxyProfileArgs {
  name?: string;
  provider?: CLIProxyProfileName;
  model?: string;
  account?: string;
  force?: boolean;
  yes?: boolean;
}

/**
 * Parse command line arguments for profile commands
 */
function parseProfileArgs(args: string[]): CliproxyProfileArgs {
  const result: CliproxyProfileArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--provider' && args[i + 1]) {
      result.provider = args[++i] as CLIProxyProfileName;
    } else if (arg === '--model' && args[i + 1]) {
      result.model = args[++i];
    } else if (arg === '--account' && args[i + 1]) {
      result.account = args[++i];
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (!arg.startsWith('-') && !result.name) {
      result.name = arg;
    }
  }

  return result;
}

/**
 * Validate CLIProxy profile name
 */
function validateProfileName(name: string): string | null {
  if (!name) {
    return 'Profile name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
    return 'Name must start with letter, contain only letters, numbers, dot, dash, underscore';
  }
  if (name.length > 32) {
    return 'Name must be 32 characters or less';
  }
  // Use centralized reserved names list (includes built-in cliproxy profiles)
  if (isReservedName(name)) {
    return `'${name}' is a reserved name`;
  }
  return null;
}

/**
 * Check if unified config mode is active
 */
function isUnifiedMode(): boolean {
  return hasUnifiedConfig() || isUnifiedConfigEnabled();
}

/**
 * Check if CLIProxy variant profile exists
 */
function cliproxyVariantExists(name: string): boolean {
  try {
    if (isUnifiedMode()) {
      const config = loadOrCreateUnifiedConfig();
      return !!(config.cliproxy?.variants && name in config.cliproxy.variants);
    }
    const config = loadConfig();
    return !!(config.cliproxy && name in config.cliproxy);
  } catch {
    return false;
  }
}

/**
 * Create settings.json file for CLIProxy variant
 * Includes all 6 fields for proper Claude CLI integration
 */
function createCliproxySettingsFile(
  name: string,
  provider: CLIProxyProfileName,
  model: string,
  _account?: string
): string {
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${provider}-${name}.settings.json`);

  // Get base env vars from provider config
  const baseEnv = getClaudeEnvVars(provider as CLIProxyProvider, CLIPROXY_DEFAULT_PORT);

  const settings = {
    env: {
      ANTHROPIC_BASE_URL: baseEnv.ANTHROPIC_BASE_URL || '',
      ANTHROPIC_AUTH_TOKEN: baseEnv.ANTHROPIC_AUTH_TOKEN || '',
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: baseEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL || model,
    },
  };

  // Ensure directory exists
  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return settingsPath;
}

/**
 * Update config.json with new CLIProxy variant
 */
function addCliproxyVariant(
  name: string,
  provider: CLIProxyProfileName,
  settingsPath: string,
  account?: string
): void {
  const configPath = getConfigPath();

  // Read existing config or create new
  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = { profiles: {} };
  }

  // Ensure cliproxy section exists
  if (!config.cliproxy) {
    config.cliproxy = {};
  }

  // Use relative path with ~ for portability
  const relativePath = `~/.ccs/${path.basename(settingsPath)}`;

  // Build variant config with optional account
  const variantConfig: { provider: string; settings: string; account?: string } = {
    provider,
    settings: relativePath,
  };
  if (account) {
    variantConfig.account = account;
  }
  config.cliproxy[name] = variantConfig;

  // Write config atomically
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);
}

/**
 * Remove CLIProxy variant from config.json
 */
function removeCliproxyVariant(name: string): { provider: string; settings: string } | null {
  const configPath = getConfigPath();

  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }

  if (!config.cliproxy || !(name in config.cliproxy)) {
    return null;
  }

  const variant = config.cliproxy[name] as { provider: string; settings: string };
  delete config.cliproxy[name];

  // Clean up empty cliproxy section
  if (Object.keys(config.cliproxy).length === 0) {
    delete config.cliproxy;
  }

  // Write config atomically
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);

  return variant;
}

/**
 * Add CLIProxy variant to unified config (config.yaml)
 * Creates *.settings.json file and stores reference in config.yaml
 */
function addCliproxyVariantUnified(
  name: string,
  provider: CLIProxyProfileName,
  model: string,
  account?: string
): void {
  const ccsDir = path.join(require('os').homedir(), '.ccs');
  const settingsFile = `${provider}-${name}.settings.json`;
  const settingsPath = path.join(ccsDir, settingsFile);

  // Get base env vars from provider config
  const baseEnv = getClaudeEnvVars(provider as CLIProxyProvider, CLIPROXY_DEFAULT_PORT);

  // Create settings file with model override
  const settings = {
    env: {
      ANTHROPIC_BASE_URL: baseEnv.ANTHROPIC_BASE_URL || '',
      ANTHROPIC_AUTH_TOKEN: baseEnv.ANTHROPIC_AUTH_TOKEN || '',
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: baseEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL || model,
    },
  };

  // Ensure directory exists
  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  // Write settings file
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  // Update config.yaml with reference
  const config = loadOrCreateUnifiedConfig();

  // Ensure cliproxy.variants section exists
  if (!config.cliproxy) {
    config.cliproxy = {
      oauth_accounts: {},
      providers: ['gemini', 'codex', 'agy', 'qwen', 'iflow'],
      variants: {},
    };
  }
  if (!config.cliproxy.variants) {
    config.cliproxy.variants = {};
  }

  // Add variant with settings file reference
  config.cliproxy.variants[name] = {
    provider: provider as CLIProxyProvider,
    account,
    settings: `~/.ccs/${settingsFile}`,
  };

  saveUnifiedConfig(config);
}

/**
 * Remove CLIProxy variant from unified config
 */
function removeCliproxyVariantUnified(
  name: string
): { provider: string; settings?: string } | null {
  const config = loadOrCreateUnifiedConfig();

  if (!config.cliproxy?.variants || !(name in config.cliproxy.variants)) {
    return null;
  }

  const variant = config.cliproxy.variants[name];

  // Delete the settings file if it exists
  if (variant.settings) {
    const settingsPath = variant.settings.replace(/^~/, require('os').homedir());
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
  }

  delete config.cliproxy.variants[name];
  saveUnifiedConfig(config);

  return { provider: variant.provider, settings: variant.settings };
}

/**
 * Format model entry for display
 */
function formatModelOption(model: ModelEntry): string {
  const tierBadge = model.tier === 'paid' ? color(' [Paid Tier]', 'warning') : '';
  return `${model.name}${tierBadge}`;
}

/**
 * Handle 'ccs cliproxy create' command
 */
async function handleCreate(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseProfileArgs(args);

  console.log(header('Create CLIProxy Variant'));
  console.log('');

  // Step 1: Profile name
  let name = parsedArgs.name;
  if (!name) {
    name = await InteractivePrompt.input('Variant name (e.g., g3, flash, pro)', {
      validate: validateProfileName,
    });
  } else {
    const error = validateProfileName(name);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  // Check if exists
  if (cliproxyVariantExists(name) && !parsedArgs.force) {
    console.log(fail(`Variant '${name}' already exists`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    process.exit(1);
  }

  // Step 2: Provider selection
  let provider = parsedArgs.provider;
  if (!provider) {
    const providerOptions = CLIPROXY_PROFILES.map((p) => ({
      id: p,
      label: p.charAt(0).toUpperCase() + p.slice(1),
    }));

    provider = (await InteractivePrompt.selectFromList(
      'Select provider:',
      providerOptions
    )) as CLIProxyProfileName;
  } else if (!CLIPROXY_PROFILES.includes(provider)) {
    console.log(fail(`Invalid provider: ${provider}`));
    console.log(`    Available: ${CLIPROXY_PROFILES.join(', ')}`);
    process.exit(1);
  }

  // Step 2.5: Account selection
  let account = parsedArgs.account;
  const providerAccounts = getProviderAccounts(provider as CLIProxyProvider);

  if (!account) {
    if (providerAccounts.length === 0) {
      // No accounts - prompt to authenticate first
      console.log('');
      console.log(warn(`No accounts authenticated for ${provider}`));
      console.log('');

      const shouldAuth = await InteractivePrompt.confirm(`Authenticate with ${provider} now?`, {
        default: true,
      });

      if (!shouldAuth) {
        console.log('');
        console.log(info('Run authentication first:'));
        console.log(`  ${color(`ccs ${provider} --auth`, 'command')}`);
        process.exit(0);
      }

      // Trigger OAuth inline
      console.log('');
      const newAccount = await triggerOAuth(provider as CLIProxyProvider, {
        add: true,
        verbose: args.includes('--verbose'),
      });

      if (!newAccount) {
        console.log(fail('Authentication failed'));
        process.exit(1);
      }

      account = newAccount.id;
      console.log('');
      console.log(ok(`Authenticated as ${newAccount.email || newAccount.id}`));
    } else if (providerAccounts.length === 1) {
      // Single account - auto-select
      account = providerAccounts[0].id;
    } else {
      // Multiple accounts - show selector with "Add new" option
      const ADD_NEW_ID = '__add_new__';

      const accountOptions = [
        ...providerAccounts.map((acc) => ({
          id: acc.id,
          label: `${acc.email || acc.id}${acc.isDefault ? ' (default)' : ''}`,
        })),
        {
          id: ADD_NEW_ID,
          label: color('[+ Add new account...]', 'info'),
        },
      ];

      const defaultIdx = providerAccounts.findIndex((a) => a.isDefault);

      const selectedAccount = await InteractivePrompt.selectFromList(
        'Select account:',
        accountOptions,
        { defaultIndex: defaultIdx >= 0 ? defaultIdx : 0 }
      );

      if (selectedAccount === ADD_NEW_ID) {
        // Add new account inline
        console.log('');
        const newAccount = await triggerOAuth(provider as CLIProxyProvider, {
          add: true,
          verbose: args.includes('--verbose'),
        });

        if (!newAccount) {
          console.log(fail('Authentication failed'));
          process.exit(1);
        }

        account = newAccount.id;
        console.log('');
        console.log(ok(`Authenticated as ${newAccount.email || newAccount.id}`));
      } else {
        account = selectedAccount;
      }
    }
  } else {
    // Validate provided account exists
    const exists = providerAccounts.find((a) => a.id === account);
    if (!exists) {
      console.log(fail(`Account '${account}' not found for ${provider}`));
      console.log('');
      console.log('Available accounts:');
      providerAccounts.forEach((a) => {
        console.log(`  - ${a.email || a.id}${a.isDefault ? ' (default)' : ''}`);
      });
      process.exit(1);
    }
  }

  // Step 3: Model selection
  let model = parsedArgs.model;
  if (!model) {
    // Check if provider has model catalog for interactive selection
    if (supportsModelConfig(provider as CLIProxyProvider)) {
      const catalog = getProviderCatalog(provider as CLIProxyProvider);
      if (catalog) {
        const modelOptions = catalog.models.map((m) => ({
          id: m.id,
          label: formatModelOption(m),
        }));

        const defaultIdx = catalog.models.findIndex((m) => m.id === catalog.defaultModel);

        model = await InteractivePrompt.selectFromList('Select model:', modelOptions, {
          defaultIndex: defaultIdx >= 0 ? defaultIdx : 0,
        });
      }
    }

    // Fallback to manual input if no catalog
    if (!model) {
      model = await InteractivePrompt.input('Model name', {
        validate: (val) => (val ? null : 'Model is required'),
      });
    }
  }

  // Create files
  console.log('');
  console.log(info('Creating CLIProxy variant...'));

  try {
    if (isUnifiedMode()) {
      // Use unified config format (no settings file needed - env vars derived at runtime)
      addCliproxyVariantUnified(name, provider, model, account);

      console.log('');
      console.log(
        infoBox(
          `Variant:  ${name}\n` +
            `Provider: ${provider}\n` +
            `Model:    ${model}\n` +
            (account ? `Account:  ${account}\n` : '') +
            `Config:   ~/.ccs/config.yaml`,
          'CLIProxy Variant Created (Unified Config)'
        )
      );
    } else {
      // Legacy: create settings.json file
      const settingsPath = createCliproxySettingsFile(name, provider, model, account);
      addCliproxyVariant(name, provider, settingsPath, account);

      console.log('');
      console.log(
        infoBox(
          `Variant:  ${name}\n` +
            `Provider: ${provider}\n` +
            `Model:    ${model}\n` +
            (account ? `Account:  ${account}\n` : '') +
            `Settings: ~/.ccs/${path.basename(settingsPath)}`,
          'CLIProxy Variant Created'
        )
      );
    }
    console.log('');
    console.log(header('Usage'));
    console.log(`  ${color(`ccs ${name} "your prompt"`, 'command')}`);
    console.log('');
    console.log(dim('To change model later:'));
    console.log(`  ${color(`ccs ${name} --config`, 'command')}`);
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to create variant: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Handle 'ccs cliproxy list' command
 */
async function handleList(): Promise<void> {
  await initUI();

  console.log(header('CLIProxy Profiles'));
  console.log('');

  try {
    // Show auth status for built-in profiles
    console.log(subheader('Built-in Profiles'));
    const authStatuses = getAllAuthStatus();

    for (const status of authStatuses) {
      const oauthConfig = getOAuthConfig(status.provider);
      const icon = status.authenticated ? ok('') : warn('');
      const authLabel = status.authenticated
        ? color('authenticated', 'success')
        : dim('not authenticated');
      const lastAuthStr = status.lastAuth ? dim(` (${status.lastAuth.toLocaleDateString()})`) : '';

      console.log(
        `  ${icon} ${color(status.provider, 'command').padEnd(18)} ${oauthConfig.displayName.padEnd(16)} ${authLabel}${lastAuthStr}`
      );
    }
    console.log('');
    console.log(dim('  To authenticate: ccs <provider> --auth'));
    console.log(dim('  To logout:       ccs <provider> --logout'));
    console.log('');

    // Show custom variants if any (from unified or legacy config)
    let variantNames: string[];
    let variantData: Record<string, { provider: string; model?: string; settings?: string }>;

    if (isUnifiedMode()) {
      const unifiedConfig = loadOrCreateUnifiedConfig();
      const variants = unifiedConfig.cliproxy?.variants || {};
      variantNames = Object.keys(variants);
      variantData = {};
      for (const name of variantNames) {
        const v = variants[name];
        variantData[name] = { provider: v.provider, settings: v.settings };
      }
    } else {
      const config = loadConfig();
      const variants = config.cliproxy || {};
      variantNames = Object.keys(variants);
      variantData = {};
      for (const name of variantNames) {
        const v = variants[name] as { provider: string; settings: string };
        variantData[name] = { provider: v.provider, settings: v.settings };
      }
    }

    if (variantNames.length > 0) {
      console.log(subheader('Custom Variants'));

      // Build table data
      const rows: string[][] = variantNames.map((name) => {
        const variant = variantData[name];
        return [name, variant.provider, variant.settings || '-'];
      });

      // Print table
      console.log(
        table(rows, {
          head: ['Variant', 'Provider', 'Settings'],
          colWidths: [15, 12, 35],
        })
      );
      console.log('');
      console.log(dim(`Total: ${variantNames.length} custom variant(s)`));
      console.log('');
    }

    console.log(dim('To create a custom variant:'));
    console.log(`  ${color('ccs cliproxy create', 'command')}`);
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to list profiles: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Handle 'ccs cliproxy remove' command
 */
async function handleRemove(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseProfileArgs(args);

  // Get available variants based on config mode
  let variantNames: string[];
  let variantData: Record<string, { provider: string; settings?: string; model?: string }>;

  if (isUnifiedMode()) {
    const unifiedConfig = loadOrCreateUnifiedConfig();
    const variants = unifiedConfig.cliproxy?.variants || {};
    variantNames = Object.keys(variants);
    variantData = {};
    for (const name of variantNames) {
      const v = variants[name];
      variantData[name] = { provider: v.provider, settings: v.settings };
    }
  } else {
    const config = loadConfig();
    const variants = config.cliproxy || {};
    variantNames = Object.keys(variants);
    variantData = {};
    for (const name of variantNames) {
      const v = variants[name] as { provider: string; settings: string };
      variantData[name] = { provider: v.provider, settings: v.settings };
    }
  }

  if (variantNames.length === 0) {
    console.log(warn('No CLIProxy variants to remove'));
    process.exit(0);
  }

  // Interactive selection if not provided
  let name = parsedArgs.name;
  if (!name) {
    console.log(header('Remove CLIProxy Variant'));
    console.log('');
    console.log('Available variants:');
    variantNames.forEach((n, i) => {
      const v = variantData[n];
      console.log(`  ${i + 1}. ${n} (${v.provider})`);
    });
    console.log('');

    name = await InteractivePrompt.input('Variant name to remove', {
      validate: (val) => {
        if (!val) return 'Variant name is required';
        if (!variantNames.includes(val)) return `Variant '${val}' not found`;
        return null;
      },
    });
  }

  if (!variantNames.includes(name)) {
    console.log(fail(`Variant '${name}' not found`));
    console.log('');
    console.log('Available variants:');
    variantNames.forEach((n) => console.log(`  - ${n}`));
    process.exit(1);
  }

  const variant = variantData[name];

  // Confirm deletion
  console.log('');
  console.log(`Variant '${color(name, 'command')}' will be removed.`);
  console.log(`  Provider: ${variant.provider}`);
  console.log(`  Settings: ${variant.settings || '-'}`);
  console.log('');

  const confirmed =
    parsedArgs.yes || (await InteractivePrompt.confirm('Delete this variant?', { default: false }));

  if (!confirmed) {
    console.log(info('Cancelled'));
    process.exit(0);
  }

  try {
    if (isUnifiedMode()) {
      // Remove from unified config
      removeCliproxyVariantUnified(name);
    } else {
      // Remove from legacy config
      const removed = removeCliproxyVariant(name);
      if (!removed) {
        console.log(fail('Failed to remove variant from config'));
        process.exit(1);
      }

      // Remove settings file if it exists
      const settingsFile = removed.settings.replace(/^~/, process.env.HOME || '');
      if (fs.existsSync(settingsFile)) {
        fs.unlinkSync(settingsFile);
      }
    }

    console.log(ok(`Variant removed: ${name}`));
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to remove variant: ${(error as Error).message}`));
    process.exit(1);
  }
}

// ============================================================================
// BINARY MANAGEMENT
// ============================================================================

/**
 * Show cliproxy command help with styled UI
 */
async function showHelp(): Promise<void> {
  await initUI();

  console.log('');
  console.log(header('CLIProxy Management'));
  console.log('');

  // Usage
  console.log(subheader('Usage:'));
  console.log(`  ${color('ccs cliproxy', 'command')} <command> [options]`);
  console.log('');

  // Profile Commands
  console.log(subheader('Profile Commands:'));
  const profileCmds: [string, string][] = [
    ['create [name]', 'Create new CLIProxy variant profile'],
    ['list', 'List all CLIProxy variant profiles'],
    ['remove <name>', 'Remove a CLIProxy variant profile'],
  ];
  const maxProfileLen = Math.max(...profileCmds.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of profileCmds) {
    console.log(`  ${color(cmd.padEnd(maxProfileLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Proxy Lifecycle Commands
  console.log(subheader('Proxy Lifecycle:'));
  const lifecycleCmds: [string, string][] = [
    ['status', 'Show running CLIProxy status'],
    ['stop', 'Stop running CLIProxy instance'],
  ];
  const maxLifecycleLen = Math.max(...lifecycleCmds.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of lifecycleCmds) {
    console.log(`  ${color(cmd.padEnd(maxLifecycleLen + 2), 'command')} ${desc}`);
  }
  console.log('');
  console.log(dim('  Note: CLIProxy now persists by default. Use "stop" to terminate.'));
  console.log('');

  // Binary Commands
  console.log(subheader('Binary Commands:'));
  const binaryCmds: [string, string][] = [
    ['--install <version>', 'Install and pin a specific version'],
    ['--latest', 'Install the latest version (no pin)'],
    ['--update', 'Unpin and update to latest version'],
  ];
  const maxBinaryLen = Math.max(...binaryCmds.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of binaryCmds) {
    console.log(`  ${color(cmd.padEnd(maxBinaryLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Multi-Account Commands
  console.log(subheader('Multi-Account Commands:'));
  const multiAcctCmds: [string, string][] = [
    ['--auth', 'Authenticate with a provider (first account)'],
    ['--auth --add', 'Add another account to a provider'],
    ['--nickname <name>', 'Set friendly name for account'],
    ['--accounts', 'List all accounts for a provider'],
    ['--use <name>', 'Switch to account by nickname/email'],
  ];
  const maxMultiLen = Math.max(...multiAcctCmds.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of multiAcctCmds) {
    console.log(`  ${color(cmd.padEnd(maxMultiLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Create Options
  console.log(subheader('Create Options:'));
  const createOpts: [string, string][] = [
    ['--provider <name>', 'Provider (gemini, codex, agy, qwen)'],
    ['--model <model>', 'Model name'],
    ['--account <id>', 'Account ID (email or default)'],
    ['--force', 'Overwrite existing variant'],
    ['--yes, -y', 'Skip confirmation prompts'],
  ];
  const maxOptLen = Math.max(...createOpts.map(([opt]) => opt.length));
  for (const [opt, desc] of createOpts) {
    console.log(`  ${color(opt.padEnd(maxOptLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Examples
  console.log(subheader('Examples:'));
  console.log(
    `  $ ${color('ccs cliproxy create', 'command')}                    ${dim('# Interactive wizard')}`
  );
  console.log(`  $ ${color('ccs cliproxy create g3 --provider gemini', 'command')}`);
  console.log(
    `    ${color('--model gemini-3-pro-preview', 'command')}            ${dim('# Non-interactive')}`
  );
  console.log(
    `  $ ${color('ccs cliproxy list', 'command')}                       ${dim('# Show all variants')}`
  );
  console.log(
    `  $ ${color('ccs cliproxy remove g3', 'command')}                  ${dim('# Remove variant')}`
  );
  console.log(
    `  $ ${color('ccs cliproxy --latest', 'command')}                   ${dim('# Update binary')}`
  );
  console.log('');
  console.log(subheader('Multi-Account Examples:'));
  console.log(
    `  $ ${color('ccs gemini --auth', 'command')}                       ${dim('# First account')}`
  );
  console.log(
    `  $ ${color('ccs gemini --auth --add', 'command')}                 ${dim('# Add second account')}`
  );
  console.log(
    `  $ ${color('ccs gemini --auth --add --nickname work', 'command')} ${dim('# With nickname')}`
  );
  console.log(
    `  $ ${color('ccs agy --accounts', 'command')}                      ${dim('# List accounts')}`
  );
  console.log(
    `  $ ${color('ccs agy --use work', 'command')}                      ${dim('# Switch account')}`
  );
  console.log('');

  // Notes
  console.log(subheader('Notes:'));
  console.log(`  Default fallback version: ${color(CLIPROXY_FALLBACK_VERSION, 'info')}`);
  console.log(
    `  Releases: ${color('https://github.com/router-for-me/CLIProxyAPI/releases', 'path')}`
  );
  console.log('');
}

/**
 * Show current cliproxy status
 */
async function showStatus(verbose: boolean): Promise<void> {
  await initUI();

  const installed = isCLIProxyInstalled();
  const currentVersion = getInstalledCliproxyVersion();
  const binaryPath = getCLIProxyPath();
  const pinnedVersion = getPinnedVersion();

  console.log('');
  console.log(color('CLIProxyAPI Status', 'primary'));
  console.log('');

  if (installed) {
    console.log(`  Installed:  ${color('Yes', 'success')}`);
    const versionLabel = pinnedVersion
      ? `${color(`v${currentVersion}`, 'info')} ${color('(pinned)', 'warning')}`
      : color(`v${currentVersion}`, 'info');
    console.log(`  Version:    ${versionLabel}`);
    console.log(`  Binary:     ${dim(binaryPath)}`);
  } else {
    console.log(`  Installed:  ${color('No', 'error')}`);
    console.log(`  Fallback:   ${color(`v${CLIPROXY_FALLBACK_VERSION}`, 'info')}`);
    console.log(`  ${dim('Run "ccs gemini" or any provider to auto-install')}`);
  }

  // Try to fetch latest version
  try {
    console.log('');
    console.log(`  ${dim('Checking for updates...')}`);
    const latestVersion = await fetchLatestCliproxyVersion();

    if (latestVersion !== currentVersion) {
      if (pinnedVersion) {
        console.log(
          `  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(pinned to v' + pinnedVersion + ')')}`
        );
        console.log('');
        console.log(`  ${dim('Run "ccs cliproxy --update" to unpin and update')}`);
      } else {
        console.log(
          `  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(update available)')}`
        );
        console.log('');
        console.log(`  ${dim('Run "ccs cliproxy --latest" to update')}`);
      }
    } else {
      console.log(`  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(up to date)')}`);
    }
  } catch (error) {
    if (verbose) {
      const err = error as Error;
      console.log(`  Latest:     ${dim(`Could not fetch (${err.message})`)}`);
    }
  }

  console.log('');
  console.log(dim(`Run "ccs cliproxy --help" for all available commands`));
  console.log('');
}

/**
 * Install a specific version (pins the version to prevent auto-update)
 */
async function installVersion(version: string, verbose: boolean): Promise<void> {
  // Validate version format (basic semver check)
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(fail('Invalid version format. Expected format: X.Y.Z (e.g., 6.5.53)'));
    process.exit(1);
  }

  console.log(info(`Installing CLIProxyAPI v${version}...`));
  console.log('');

  try {
    await installCliproxyVersion(version, verbose);

    // Pin the version to prevent auto-update
    savePinnedVersion(version);

    console.log('');
    console.log(ok(`CLIProxyAPI v${version} installed (pinned)`));
    console.log('');
    console.log(dim('This version will be used until you run:'));
    console.log(
      `  ${color('ccs cliproxy --update', 'command')}  ${dim('# Update to latest and unpin')}`
    );
    console.log('');
  } catch (error) {
    const err = error as Error;
    console.error('');
    console.error(fail(`Failed to install CLIProxyAPI v${version}`));
    console.error(`    ${err.message}`);
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Version does not exist on GitHub');
    console.error('  2. Network connectivity issues');
    console.error('  3. GitHub API rate limiting');
    console.error('');
    console.error('Check available versions at:');
    console.error('  https://github.com/router-for-me/CLIProxyAPI/releases');
    process.exit(1);
  }
}

/**
 * Install latest version (clears any version pin)
 */
async function installLatest(verbose: boolean): Promise<void> {
  console.log(info('Fetching latest CLIProxyAPI version...'));

  try {
    const latestVersion = await fetchLatestCliproxyVersion();
    const currentVersion = getInstalledCliproxyVersion();
    const wasPinned = isVersionPinned();

    if (isCLIProxyInstalled() && latestVersion === currentVersion && !wasPinned) {
      console.log(ok(`Already running latest version: v${latestVersion}`));
      return;
    }

    console.log(info(`Latest version: v${latestVersion}`));
    if (isCLIProxyInstalled()) {
      console.log(info(`Current version: v${currentVersion}`));
    }
    if (wasPinned) {
      console.log(info(`Removing version pin (was v${getPinnedVersion()})`));
    }
    console.log('');

    await installCliproxyVersion(latestVersion, verbose);

    // Clear any version pin so auto-update works again
    clearPinnedVersion();

    console.log('');
    console.log(ok(`CLIProxyAPI updated to v${latestVersion}`));
    console.log(dim('Auto-update is now enabled.'));
    console.log('');
  } catch (error) {
    const err = error as Error;
    console.error(fail(`Failed to install latest version: ${err.message}`));
    process.exit(1);
  }
}

// ============================================================================
// PROXY LIFECYCLE COMMANDS
// ============================================================================

/**
 * Handle 'ccs cliproxy stop' - Stop running CLIProxy instance
 */
async function handleStop(): Promise<void> {
  await initUI();

  console.log(header('Stop CLIProxy'));
  console.log('');

  const result = await stopProxy();

  if (result.stopped) {
    console.log(ok(`CLIProxy stopped (PID ${result.pid})`));
    if (result.sessionCount && result.sessionCount > 0) {
      console.log(info(`${result.sessionCount} active session(s) were disconnected`));
    }
  } else {
    console.log(warn(result.error || 'Failed to stop CLIProxy'));
  }
  console.log('');
}

/**
 * Handle 'ccs cliproxy status' - Show running proxy status
 */
async function handleProxyStatus(): Promise<void> {
  await initUI();

  console.log(header('CLIProxy Status'));
  console.log('');

  const status = getProxyStatus();

  if (status.running) {
    console.log(`  Status:     ${color('Running', 'success')}`);
    console.log(`  PID:        ${status.pid}`);
    console.log(`  Port:       ${status.port}`);
    console.log(`  Sessions:   ${status.sessionCount || 0} active`);
    if (status.startedAt) {
      const started = new Date(status.startedAt);
      console.log(`  Started:    ${started.toLocaleString()}`);
    }
    console.log('');
    console.log(dim('To stop: ccs cliproxy stop'));
  } else {
    console.log(`  Status:     ${color('Not running', 'warning')}`);
    console.log('');
    console.log(dim('CLIProxy starts automatically when you run ccs gemini, codex, etc.'));
  }
  console.log('');
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Main cliproxy command handler
 */
export async function handleCliproxyCommand(args: string[]): Promise<void> {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const command = args[0];

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    await showHelp();
    return;
  }

  // Handle profile commands
  if (command === 'create') {
    await handleCreate(args.slice(1));
    return;
  }

  if (command === 'list' || command === 'ls') {
    await handleList();
    return;
  }

  if (command === 'remove' || command === 'delete' || command === 'rm') {
    await handleRemove(args.slice(1));
    return;
  }

  // Handle proxy lifecycle commands
  if (command === 'stop') {
    await handleStop();
    return;
  }

  if (command === 'status') {
    await handleProxyStatus();
    return;
  }

  // Handle --install <version>
  const installIdx = args.indexOf('--install');
  if (installIdx !== -1) {
    const version = args[installIdx + 1];
    if (!version || version.startsWith('-')) {
      console.error('[X] Missing version argument for --install');
      console.error('    Usage: ccs cliproxy --install <version>');
      console.error('    Example: ccs cliproxy --install 6.5.53');
      process.exit(1);
    }
    await installVersion(version, verbose);
    return;
  }

  // Handle --latest
  if (args.includes('--latest')) {
    await installLatest(verbose);
    return;
  }

  // Handle --update (unpin and update to latest)
  if (args.includes('--update')) {
    await installLatest(verbose);
    return;
  }

  // Default: show status
  await showStatus(verbose);
}
