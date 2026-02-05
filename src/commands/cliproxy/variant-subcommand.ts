/**
 * CLIProxy Variant Management
 *
 * Handles:
 * - ccs cliproxy create [name]
 * - ccs cliproxy remove <name>
 */

import * as path from 'path';
import { getProviderAccounts } from '../../cliproxy/account-manager';
import { triggerOAuth } from '../../cliproxy/auth/oauth-handler';
import { CLIProxyProfileName, CLIPROXY_PROFILES } from '../../auth/profile-detector';
import { supportsModelConfig, getProviderCatalog, ModelEntry } from '../../cliproxy/model-catalog';
import { CLIProxyProvider, CLIProxyBackend } from '../../cliproxy/types';
import { isUnifiedMode } from '../../config/unified-config-loader';
import { initUI, header, color, ok, fail, warn, info, infoBox, dim } from '../../utils/ui';
import { InteractivePrompt } from '../../utils/prompt';
import {
  validateProfileName,
  variantExists,
  listVariants,
  createVariant,
  removeVariant,
} from '../../cliproxy/services';
import { DEFAULT_BACKEND } from '../../cliproxy/platform-detector';

interface CliproxyProfileArgs {
  name?: string;
  provider?: CLIProxyProfileName;
  model?: string;
  account?: string;
  force?: boolean;
  yes?: boolean;
}

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

function formatModelOption(model: ModelEntry): string {
  const tierBadge =
    model.tier === 'ultra'
      ? color(' [Ultra]', 'warning')
      : model.tier === 'pro'
        ? color(' [Pro]', 'warning')
        : '';
  return `${model.name}${tierBadge}`;
}

function getBackendLabel(backend: CLIProxyBackend): string {
  return backend === 'plus' ? 'CLIProxy Plus' : 'CLIProxy';
}

export async function handleCreate(
  args: string[],
  backend: CLIProxyBackend = DEFAULT_BACKEND
): Promise<void> {
  await initUI();
  const parsedArgs = parseProfileArgs(args);
  console.log(header(`Create ${getBackendLabel(backend)} Variant`));
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

  if (variantExists(name) && !parsedArgs.force) {
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
      account = providerAccounts[0].id;
    } else {
      const ADD_NEW_ID = '__add_new__';
      const accountOptions = [
        ...providerAccounts.map((acc) => ({
          id: acc.id,
          label: `${acc.email || acc.id}${acc.isDefault ? ' (default)' : ''}`,
        })),
        { id: ADD_NEW_ID, label: color('[+ Add new account...]', 'info') },
      ];
      const defaultIdx = providerAccounts.findIndex((a) => a.isDefault);
      const selectedAccount = await InteractivePrompt.selectFromList(
        'Select account:',
        accountOptions,
        { defaultIndex: defaultIdx >= 0 ? defaultIdx : 0 }
      );
      if (selectedAccount === ADD_NEW_ID) {
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
    const exists = providerAccounts.find((a) => a.id === account);
    if (!exists) {
      console.log(fail(`Account '${account}' not found for ${provider}`));
      console.log('');
      console.log('Available accounts:');
      providerAccounts.forEach((a) =>
        console.log(`  - ${a.email || a.id}${a.isDefault ? ' (default)' : ''}`)
      );
      process.exit(1);
    }
  }

  // Step 3: Model selection
  let model = parsedArgs.model;
  if (!model) {
    if (supportsModelConfig(provider as CLIProxyProvider)) {
      const catalog = getProviderCatalog(provider as CLIProxyProvider);
      if (catalog) {
        const modelOptions = catalog.models.map((m) => ({ id: m.id, label: formatModelOption(m) }));
        const defaultIdx = catalog.models.findIndex((m) => m.id === catalog.defaultModel);
        model = await InteractivePrompt.selectFromList('Select model:', modelOptions, {
          defaultIndex: defaultIdx >= 0 ? defaultIdx : 0,
        });
      }
    }
    if (!model) {
      model = await InteractivePrompt.input('Model name', {
        validate: (val) => (val ? null : 'Model is required'),
      });
    }
  }

  // Create variant
  console.log('');
  console.log(info(`Creating ${getBackendLabel(backend)} variant...`));
  const result = createVariant(name, provider, model, account);

  if (!result.success) {
    console.log(fail(`Failed to create variant: ${result.error}`));
    process.exit(1);
  }

  console.log('');
  const configType = isUnifiedMode()
    ? 'CLIProxy Variant Created (Unified Config)'
    : 'CLIProxy Variant Created';
  const settingsDisplay = isUnifiedMode()
    ? '~/.ccs/config.yaml'
    : `~/.ccs/${path.basename(result.settingsPath || '')}`;
  const portInfo = result.variant?.port ? `Port:     ${result.variant.port}\n` : '';
  console.log(
    infoBox(
      `Variant:  ${name}\nProvider: ${provider}\nModel:    ${model}\n${portInfo}${account ? `Account:  ${account}\n` : ''}${isUnifiedMode() ? 'Config' : 'Settings'}:   ${settingsDisplay}`,
      configType
    )
  );
  console.log('');
  console.log(header('Usage'));
  console.log(`  ${color(`ccs ${name} "your prompt"`, 'command')}`);
  console.log('');
  console.log(dim('To change model later:'));
  console.log(`  ${color(`ccs ${name} --config`, 'command')}`);
  console.log('');
}

export async function handleRemove(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseProfileArgs(args);
  const variants = listVariants();
  const variantNames = Object.keys(variants);

  if (variantNames.length === 0) {
    console.log(warn('No CLIProxy variants to remove'));
    process.exit(0);
  }

  let name = parsedArgs.name;
  if (!name) {
    console.log(header('Remove CLIProxy Variant'));
    console.log('');
    console.log('Available variants:');
    variantNames.forEach((n, i) => console.log(`  ${i + 1}. ${n} (${variants[n].provider})`));
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

  const variant = variants[name];
  console.log('');
  console.log(`Variant '${color(name, 'command')}' will be removed.`);
  console.log(`  Provider: ${variant.provider}`);
  if (variant.port) {
    console.log(`  Port:     ${variant.port}`);
  }
  console.log(`  Settings: ${variant.settings || '-'}`);
  console.log('');

  const confirmed =
    parsedArgs.yes || (await InteractivePrompt.confirm('Delete this variant?', { default: false }));
  if (!confirmed) {
    console.log(info('Cancelled'));
    process.exit(0);
  }

  const result = removeVariant(name);
  if (!result.success) {
    console.log(fail(`Failed to remove variant: ${result.error}`));
    process.exit(1);
  }

  console.log(ok(`Variant removed: ${name}`));
  console.log('');
}
