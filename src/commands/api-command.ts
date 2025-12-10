/**
 * API Command Handler
 *
 * Manages CCS API profiles for custom API providers.
 * Commands: create, list, remove
 *
 * Supports dual-mode configuration:
 * - Unified YAML format (config.yaml) when CCS_UNIFIED_CONFIG=1 or config.yaml exists
 * - Legacy JSON format (config.json, *.settings.json) as fallback
 */

import * as fs from 'fs';
import * as path from 'path';
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
import { getCcsDir, getConfigPath, loadConfig } from '../utils/config-manager';
import { isReservedName } from '../config/reserved-names';
import {
  hasUnifiedConfig,
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
} from '../config/unified-config-loader';
import { setProfileSecrets, deleteAllProfileSecrets } from '../config/secrets-manager';
import { isUnifiedConfigEnabled } from '../config/feature-flags';

interface ApiCommandArgs {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  force?: boolean;
  yes?: boolean;
}

/**
 * Parse command line arguments for api commands
 */
function parseArgs(args: string[]): ApiCommandArgs {
  const result: ApiCommandArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--base-url' && args[i + 1]) {
      result.baseUrl = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      result.apiKey = args[++i];
    } else if (arg === '--model' && args[i + 1]) {
      result.model = args[++i];
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
 * Validate API profile name
 */
function validateApiName(name: string): string | null {
  if (!name) {
    return 'API name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
    return 'API name must start with letter, contain only letters, numbers, dot, dash, underscore';
  }
  if (name.length > 32) {
    return 'API name must be 32 characters or less';
  }
  // Use centralized reserved names list
  if (isReservedName(name)) {
    return `'${name}' is a reserved name`;
  }
  return null;
}

/**
 * Validate URL format
 */
function validateUrl(url: string): string | null {
  if (!url) {
    return 'Base URL is required';
  }
  try {
    new URL(url);
    return null;
  } catch {
    return 'Invalid URL format (must include protocol, e.g., https://)';
  }
}

/**
 * Check if unified config mode is active
 */
function isUnifiedMode(): boolean {
  return hasUnifiedConfig() || isUnifiedConfigEnabled();
}

/**
 * Check if API profile already exists in config
 */
function apiExists(name: string): boolean {
  try {
    if (isUnifiedMode()) {
      const config = loadOrCreateUnifiedConfig();
      return name in config.profiles;
    }
    const config = loadConfig();
    return name in config.profiles;
  } catch {
    return false;
  }
}

/**
 * Create settings.json file for API profile
 * Includes all 4 model fields for proper Claude CLI integration
 */
function createSettingsFile(name: string, baseUrl: string, apiKey: string, model: string): string {
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${name}.settings.json`);

  const settings = {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return settingsPath;
}

/**
 * Update config.json with new API profile
 */
function updateConfig(name: string, _settingsPath: string): void {
  const configPath = getConfigPath();
  const ccsDir = getCcsDir();

  // Read existing config or create new
  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = { profiles: {} };
  }

  // Use relative path with ~ for portability
  const relativePath = `~/.ccs/${name}.settings.json`;
  config.profiles[name] = relativePath;

  // Ensure directory exists
  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  // Write config atomically (write to temp, then rename)
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);
}

/**
 * Create API profile in unified config (config.yaml + secrets.yaml)
 */
function createApiProfileUnified(
  name: string,
  baseUrl: string,
  apiKey: string,
  model: string
): void {
  const config = loadOrCreateUnifiedConfig();

  // Add profile to config.yaml (non-sensitive data only)
  config.profiles[name] = {
    type: 'api',
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    },
  };

  saveUnifiedConfig(config);

  // Store API key in secrets.yaml (sensitive data)
  setProfileSecrets(name, {
    ANTHROPIC_AUTH_TOKEN: apiKey,
  });
}

/**
 * Remove API profile from unified config
 */
function removeApiProfileUnified(name: string): void {
  const config = loadOrCreateUnifiedConfig();

  if (!config.profiles[name]) {
    throw new Error(`API profile not found: ${name}`);
  }

  delete config.profiles[name];

  // Clear default if it was the deleted profile
  if (config.default === name) {
    config.default = undefined;
  }

  saveUnifiedConfig(config);

  // Remove secrets
  deleteAllProfileSecrets(name);
}

/**
 * Handle 'ccs api create' command
 */
async function handleCreate(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseArgs(args);

  console.log(header('Create API Profile'));
  console.log('');

  // Step 1: API name
  let name = parsedArgs.name;
  if (!name) {
    name = await InteractivePrompt.input('API name', {
      validate: validateApiName,
    });
  } else {
    const error = validateApiName(name);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  // Check if exists
  if (apiExists(name) && !parsedArgs.force) {
    console.log(fail(`API '${name}' already exists`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    process.exit(1);
  }

  // Step 2: Base URL
  let baseUrl = parsedArgs.baseUrl;
  if (!baseUrl) {
    baseUrl = await InteractivePrompt.input('API Base URL (e.g., https://api.example.com)', {
      validate: validateUrl,
    });
  } else {
    const error = validateUrl(baseUrl);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  // Step 3: API Key
  let apiKey = parsedArgs.apiKey;
  if (!apiKey) {
    apiKey = await InteractivePrompt.password('API Key');
    if (!apiKey) {
      console.log(fail('API key is required'));
      process.exit(1);
    }
  }

  // Step 4: Model (optional)
  const defaultModel = 'claude-sonnet-4-5-20250929';
  let model = parsedArgs.model;
  if (!model && !parsedArgs.yes) {
    model = await InteractivePrompt.input('Default model', {
      default: defaultModel,
    });
  }
  model = model || defaultModel;

  // Create files
  console.log('');
  console.log(info('Creating API profile...'));

  try {
    if (isUnifiedMode()) {
      // Use unified config format
      createApiProfileUnified(name, baseUrl, apiKey, model);
      console.log('');
      console.log(
        infoBox(
          `API:      ${name}\n` +
            `Config:   ~/.ccs/config.yaml\n` +
            `Secrets:  ~/.ccs/secrets.yaml\n` +
            `Base URL: ${baseUrl}\n` +
            `Model:    ${model}`,
          'API Profile Created (Unified Config)'
        )
      );
    } else {
      // Use legacy JSON format
      const settingsPath = createSettingsFile(name, baseUrl, apiKey, model);
      updateConfig(name, settingsPath);
      console.log('');
      console.log(
        infoBox(
          `API:      ${name}\n` +
            `Settings: ~/.ccs/${name}.settings.json\n` +
            `Base URL: ${baseUrl}\n` +
            `Model:    ${model}`,
          'API Profile Created'
        )
      );
    }
    console.log('');
    console.log(header('Usage'));
    console.log(`  ${color(`ccs ${name} "your prompt"`, 'command')}`);
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to create API profile: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Check if API profile has real API key (not placeholder)
 */
function isApiConfigured(apiName: string): boolean {
  try {
    if (isUnifiedMode()) {
      // Check secrets.yaml for unified config
      const { getProfileSecrets } = require('../config/secrets-manager');
      const secrets = getProfileSecrets(apiName);
      const token = secrets?.ANTHROPIC_AUTH_TOKEN || '';
      return token.length > 0 && !token.includes('YOUR_') && !token.includes('your-');
    }
    // Legacy: check settings.json file
    const ccsDir = getCcsDir();
    const settingsPath = path.join(ccsDir, `${apiName}.settings.json`);
    if (!fs.existsSync(settingsPath)) return false;

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const token = settings?.env?.ANTHROPIC_AUTH_TOKEN || '';
    // Check if it's a placeholder or empty
    return token.length > 0 && !token.includes('YOUR_') && !token.includes('your-');
  } catch {
    return false;
  }
}

/**
 * Handle 'ccs api list' command
 */
async function handleList(): Promise<void> {
  await initUI();

  console.log(header('CCS API Profiles'));
  console.log('');

  try {
    if (isUnifiedMode()) {
      // List from unified config
      const unifiedConfig = loadOrCreateUnifiedConfig();
      const apis = Object.keys(unifiedConfig.profiles);

      if (apis.length === 0) {
        console.log(warn('No API profiles configured'));
        console.log('');
        console.log('To create an API profile:');
        console.log(`  ${color('ccs api create', 'command')}`);
        console.log('');
        return;
      }

      // Build table data with status indicators
      const rows: string[][] = apis.map((name) => {
        const status = isApiConfigured(name) ? color('[OK]', 'success') : color('[!]', 'warning');
        return [name, 'config.yaml', status];
      });

      // Print table
      console.log(
        table(rows, {
          head: ['API', 'Config', 'Status'],
          colWidths: [15, 20, 10],
        })
      );
      console.log('');

      // Show CLIProxy variants if any
      const variants = Object.keys(unifiedConfig.cliproxy?.variants || {});
      if (variants.length > 0) {
        console.log(subheader('CLIProxy Variants'));
        const cliproxyRows = variants.map((name) => {
          const variant = unifiedConfig.cliproxy?.variants[name];
          return [name, variant?.provider || 'unknown', variant?.model || '-'];
        });

        console.log(
          table(cliproxyRows, {
            head: ['Variant', 'Provider', 'Model'],
            colWidths: [15, 15, 20],
          })
        );
        console.log('');
      }

      console.log(dim(`Total: ${apis.length} API profile(s)`));
      console.log('');
      return;
    }

    // Legacy: list from config.json
    const config = loadConfig();
    const apis = Object.keys(config.profiles);

    if (apis.length === 0) {
      console.log(warn('No API profiles configured'));
      console.log('');
      console.log('To create an API profile:');
      console.log(`  ${color('ccs api create', 'command')}`);
      console.log('');
      return;
    }

    // Build table data with status indicators
    const rows: string[][] = apis.map((name) => {
      const settingsPath = config.profiles[name];
      const status = isApiConfigured(name) ? color('[OK]', 'success') : color('[!]', 'warning');

      return [name, settingsPath, status];
    });

    // Print table
    console.log(
      table(rows, {
        head: ['API', 'Settings File', 'Status'],
        colWidths: [15, 35, 10],
      })
    );
    console.log('');

    // Show CLIProxy variants if any
    if (config.cliproxy && Object.keys(config.cliproxy).length > 0) {
      console.log(subheader('CLIProxy Variants'));
      const cliproxyRows = Object.entries(config.cliproxy).map(([name, v]) => {
        const variant = v as { provider: string; settings: string };
        return [name, variant.provider, variant.settings];
      });

      console.log(
        table(cliproxyRows, {
          head: ['Variant', 'Provider', 'Settings'],
          colWidths: [15, 15, 30],
        })
      );
      console.log('');
    }

    console.log(dim(`Total: ${apis.length} API profile(s)`));
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to list API profiles: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Handle 'ccs api remove' command
 */
async function handleRemove(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseArgs(args);

  // Get available APIs based on config mode
  let apis: string[];
  if (isUnifiedMode()) {
    const unifiedConfig = loadOrCreateUnifiedConfig();
    apis = Object.keys(unifiedConfig.profiles);
  } else {
    const config = loadConfig();
    apis = Object.keys(config.profiles);
  }

  if (apis.length === 0) {
    console.log(warn('No API profiles to remove'));
    process.exit(0);
  }

  // Interactive API selection if not provided
  let name = parsedArgs.name;
  if (!name) {
    console.log(header('Remove API Profile'));
    console.log('');
    console.log('Available APIs:');
    apis.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log('');

    name = await InteractivePrompt.input('API name to remove', {
      validate: (val) => {
        if (!val) return 'API name is required';
        if (!apis.includes(val)) return `API '${val}' not found`;
        return null;
      },
    });
  }

  if (!apis.includes(name)) {
    console.log(fail(`API '${name}' not found`));
    console.log('');
    console.log('Available APIs:');
    apis.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }

  // Confirm deletion
  console.log('');
  console.log(`API '${color(name, 'command')}' will be removed.`);
  if (isUnifiedMode()) {
    console.log('  Config: ~/.ccs/config.yaml');
    console.log('  Secrets: ~/.ccs/secrets.yaml');
  } else {
    console.log(`  Settings: ~/.ccs/${name}.settings.json`);
  }
  console.log('');

  const confirmed =
    parsedArgs.yes ||
    (await InteractivePrompt.confirm('Delete this API profile?', { default: false }));

  if (!confirmed) {
    console.log(info('Cancelled'));
    process.exit(0);
  }

  try {
    if (isUnifiedMode()) {
      // Remove from unified config
      removeApiProfileUnified(name);
    } else {
      // Remove from legacy config.json
      const config = loadConfig();
      delete config.profiles[name];
      const configPath = getConfigPath();
      const tempPath = configPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      fs.renameSync(tempPath, configPath);

      // Remove settings file if it exists
      const expandedPath = path.join(getCcsDir(), `${name}.settings.json`);
      if (fs.existsSync(expandedPath)) {
        fs.unlinkSync(expandedPath);
      }
    }

    console.log(ok(`API profile removed: ${name}`));
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to remove API profile: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Show help for api commands
 */
async function showHelp(): Promise<void> {
  await initUI();

  console.log(header('CCS API Management'));
  console.log('');
  console.log(subheader('Usage'));
  console.log(`  ${color('ccs api', 'command')} <command> [options]`);
  console.log('');
  console.log(subheader('Commands'));
  console.log(`  ${color('create [name]', 'command')}    Create new API profile (interactive)`);
  console.log(`  ${color('list', 'command')}             List all API profiles`);
  console.log(`  ${color('remove <name>', 'command')}    Remove an API profile`);
  console.log('');
  console.log(subheader('Options'));
  console.log(`  ${color('--base-url <url>', 'command')}     API base URL (create)`);
  console.log(`  ${color('--api-key <key>', 'command')}      API key (create)`);
  console.log(`  ${color('--model <model>', 'command')}      Default model (create)`);
  console.log(`  ${color('--force', 'command')}              Overwrite existing (create)`);
  console.log(`  ${color('--yes, -y', 'command')}            Skip confirmation prompts`);
  console.log('');
  console.log(subheader('Examples'));
  console.log(`  ${dim('# Interactive wizard')}`);
  console.log(`  ${color('ccs api create', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Create with name')}`);
  console.log(`  ${color('ccs api create myapi', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Remove API profile')}`);
  console.log(`  ${color('ccs api remove myapi', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Show all API profiles')}`);
  console.log(`  ${color('ccs api list', 'command')}`);
  console.log('');
}

/**
 * Main api command router
 */
export async function handleApiCommand(args: string[]): Promise<void> {
  const command = args[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    await showHelp();
    return;
  }

  switch (command) {
    case 'create':
      await handleCreate(args.slice(1));
      break;
    case 'list':
      await handleList();
      break;
    case 'remove':
    case 'delete':
    case 'rm':
      await handleRemove(args.slice(1));
      break;
    default:
      await initUI();
      console.log(fail(`Unknown command: ${command}`));
      console.log('');
      console.log('Run for help:');
      console.log(`  ${color('ccs api --help', 'command')}`);
      process.exit(1);
  }
}
