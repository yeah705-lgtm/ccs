/**
 * Account registry CRUD operations
 * Handles loading, saving, and syncing the accounts.json file
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIProxyProvider } from '../types';
import { PROVIDER_TYPE_VALUES } from '../auth/auth-types';
import { getAuthDir } from '../config-generator';
import { AccountsRegistry, AccountInfo, PROVIDERS_WITHOUT_EMAIL } from './types';
import {
  getAccountsRegistryPath,
  getPausedDir,
  extractAccountIdFromTokenFile,
  generateNickname,
  validateNickname,
  moveTokenToPaused,
  moveTokenFromPaused,
  deleteTokenFile,
} from './token-file-ops';

/** Default registry structure */
const DEFAULT_REGISTRY: AccountsRegistry = {
  version: 1,
  providers: {},
};

/**
 * Load accounts registry
 */
export function loadAccountsRegistry(): AccountsRegistry {
  const registryPath = getAccountsRegistryPath();

  if (!fs.existsSync(registryPath)) {
    return { ...DEFAULT_REGISTRY };
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    const data = JSON.parse(content);
    return {
      version: data.version || 1,
      providers: data.providers || {},
    };
  } catch {
    return { ...DEFAULT_REGISTRY };
  }
}

/**
 * Save accounts registry
 */
export function saveAccountsRegistry(registry: AccountsRegistry): void {
  const registryPath = getAccountsRegistryPath();
  const dir = path.dirname(registryPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', {
    mode: 0o600,
  });
}

/**
 * Sync registry with actual token files
 * Removes stale entries where token file no longer exists
 * For paused accounts, checks both auth/ and paused/ directories
 * Called automatically when loading accounts
 */
export function syncRegistryWithTokenFiles(registry: AccountsRegistry): boolean {
  const authDir = getAuthDir();
  const pausedDir = getPausedDir();
  let modified = false;

  for (const [_providerName, providerAccounts] of Object.entries(registry.providers)) {
    if (!providerAccounts) continue;

    const staleIds: string[] = [];

    for (const [accountId, meta] of Object.entries(providerAccounts.accounts)) {
      const tokenPath = path.join(authDir, meta.tokenFile);
      const pausedPath = path.join(pausedDir, meta.tokenFile);

      // For paused accounts, check paused dir; for active accounts, check auth dir
      const expectedPath = meta.paused ? pausedPath : tokenPath;
      // Also accept if file exists in either location (handles edge cases)
      const existsAnywhere = fs.existsSync(tokenPath) || fs.existsSync(pausedPath);

      if (!fs.existsSync(expectedPath) && !existsAnywhere) {
        staleIds.push(accountId);
      }
    }

    // Remove stale accounts
    for (const id of staleIds) {
      delete providerAccounts.accounts[id];
      modified = true;

      // Update default if deleted
      if (providerAccounts.default === id) {
        const remainingIds = Object.keys(providerAccounts.accounts);
        providerAccounts.default = remainingIds[0] || 'default';
      }
    }
  }

  return modified;
}

/**
 * Register a new account
 * Called after successful OAuth to record the account
 *
 * For providers without email (kiro, ghcp):
 * - nickname is REQUIRED and used as accountId
 * - Uniqueness is enforced to prevent overwriting
 *
 * For providers with email:
 * - email is used as accountId
 * - nickname is auto-generated from email if not provided
 */
export function registerAccount(
  provider: CLIProxyProvider,
  tokenFile: string,
  email?: string,
  nickname?: string,
  projectId?: string
): AccountInfo {
  const registry = loadAccountsRegistry();

  // Initialize provider section if needed
  if (!registry.providers[provider]) {
    registry.providers[provider] = {
      default: 'default',
      accounts: {},
    };
  }

  const providerAccounts = registry.providers[provider];
  if (!providerAccounts) {
    throw new Error('Failed to initialize provider accounts');
  }

  // Determine account ID based on provider type
  let accountId: string;
  let accountNickname: string;

  if (PROVIDERS_WITHOUT_EMAIL.includes(provider)) {
    // For kiro/ghcp: nickname is REQUIRED and used as accountId
    if (!nickname || nickname === 'default') {
      throw new Error(
        `Nickname is required when adding ${provider} accounts. ` +
          `Use --nickname <name> or provide a nickname in the UI.`
      );
    }

    // Validate nickname format
    const validationError = validateNickname(nickname);
    if (validationError) {
      throw new Error(validationError);
    }

    // Check uniqueness
    for (const [existingId, _account] of Object.entries(providerAccounts.accounts)) {
      if (existingId.toLowerCase() === nickname.toLowerCase()) {
        throw new Error(
          `An account with nickname "${nickname}" already exists for ${provider}. ` +
            `Choose a different nickname.`
        );
      }
    }

    accountId = nickname;
    accountNickname = nickname;
  } else {
    // For other providers: use email as accountId, fallback to filename extraction
    accountId = extractAccountIdFromTokenFile(tokenFile, email);
    accountNickname = nickname || generateNickname(email);
  }

  const isFirstAccount = Object.keys(providerAccounts.accounts).length === 0;

  // Create or update account
  const accountMeta: Omit<AccountInfo, 'id' | 'provider' | 'isDefault'> = {
    email,
    nickname: accountNickname,
    tokenFile,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };

  // Include projectId for Antigravity accounts
  if (provider === 'agy' && projectId) {
    accountMeta.projectId = projectId;
  }

  providerAccounts.accounts[accountId] = accountMeta;

  // Set as default if first account
  if (isFirstAccount) {
    providerAccounts.default = accountId;
  }

  saveAccountsRegistry(registry);

  return {
    id: accountId,
    provider,
    isDefault: accountId === providerAccounts.default,
    email,
    nickname: accountNickname,
    tokenFile,
    createdAt: providerAccounts.accounts[accountId].createdAt,
    lastUsedAt: providerAccounts.accounts[accountId].lastUsedAt,
    projectId: providerAccounts.accounts[accountId].projectId,
  };
}

/**
 * Set default account for a provider
 */
export function setDefaultAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts || !providerAccounts.accounts[accountId]) {
    return false;
  }

  providerAccounts.default = accountId;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Pause an account (skip in quota rotation)
 * Moves token file to paused/ subdir so CLIProxyAPI won't discover it
 */
export function pauseAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  const accountMeta = providerAccounts.accounts[accountId];

  // Skip if already paused (idempotent)
  if (accountMeta.paused) {
    return true;
  }

  // Move token file to paused directory (if it exists in auth dir)
  moveTokenToPaused(accountMeta.tokenFile);

  providerAccounts.accounts[accountId].paused = true;
  providerAccounts.accounts[accountId].pausedAt = new Date().toISOString();
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Resume a paused account
 * Moves token file back from paused/ to auth/ so CLIProxyAPI can discover it
 */
export function resumeAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  const accountMeta = providerAccounts.accounts[accountId];

  // Skip if already active (idempotent)
  if (!accountMeta.paused) {
    return true;
  }

  // Move token file back from paused directory (if it exists in paused dir)
  moveTokenFromPaused(accountMeta.tokenFile);

  providerAccounts.accounts[accountId].paused = false;
  providerAccounts.accounts[accountId].pausedAt = undefined;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Remove an account
 */
export function removeAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts || !providerAccounts.accounts[accountId]) {
    return false;
  }

  // Delete token file from both auth and paused directories
  const tokenFile = providerAccounts.accounts[accountId].tokenFile;
  deleteTokenFile(tokenFile);

  // Remove from registry
  delete providerAccounts.accounts[accountId];

  // Update default if needed
  const remainingAccounts = Object.keys(providerAccounts.accounts);
  if (providerAccounts.default === accountId && remainingAccounts.length > 0) {
    providerAccounts.default = remainingAccounts[0];
  }

  saveAccountsRegistry(registry);
  return true;
}

/**
 * Rename an account's nickname
 */
export function renameAccount(
  provider: CLIProxyProvider,
  accountId: string,
  newNickname: string
): boolean {
  const validationError = validateNickname(newNickname);
  if (validationError) {
    throw new Error(validationError);
  }

  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  // Check if nickname is already used by another account
  for (const [id, account] of Object.entries(providerAccounts.accounts)) {
    if (id !== accountId && account.nickname?.toLowerCase() === newNickname.toLowerCase()) {
      throw new Error(`Nickname "${newNickname}" is already used by another account`);
    }
  }

  providerAccounts.accounts[accountId].nickname = newNickname;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Update last used timestamp for an account
 */
export function touchAccount(provider: CLIProxyProvider, accountId: string): void {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (providerAccounts?.accounts[accountId]) {
    providerAccounts.accounts[accountId].lastUsedAt = new Date().toISOString();
    saveAccountsRegistry(registry);
  }
}

/**
 * Update account tier
 */
export function setAccountTier(
  provider: CLIProxyProvider,
  accountId: string,
  tier: 'free' | 'pro' | 'ultra' | 'unknown'
): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  providerAccounts.accounts[accountId].tier = tier;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Auto-discover accounts from existing token files
 * Called during migration or first run to populate accounts registry
 *
 * For kiro/ghcp providers without email, generates unique accountId from:
 * 1. OAuth provider + profile ID from filename (e.g., github-ABC123)
 * 2. Fallback: provider + index (e.g., kiro-1, kiro-2)
 */
export function discoverExistingAccounts(): void {
  const authDir = getAuthDir();

  if (!fs.existsSync(authDir)) {
    return;
  }

  const registry = loadAccountsRegistry();
  const files = fs.readdirSync(authDir);

  // Track whether any accounts were discovered (to avoid saving empty registry)
  let discoveredCount = 0;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(authDir, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Skip if no type field
      if (!data.type) continue;

      // Build reverse mapping from PROVIDER_TYPE_VALUES (type value -> provider)
      // e.g., "antigravity" -> "agy", "kiro" -> "kiro", "codewhisperer" -> "kiro"
      const typeValue = data.type.toLowerCase();
      let provider: CLIProxyProvider | undefined;
      for (const [prov, typeValues] of Object.entries(PROVIDER_TYPE_VALUES)) {
        if (typeValues.includes(typeValue)) {
          provider = prov as CLIProxyProvider;
          break;
        }
      }

      // Skip if unknown provider type
      if (!provider) {
        continue;
      }

      // Extract email if available, fallback to filename-based ID
      let email = data.email || undefined;

      // Fallback: extract email from filename (e.g., "kiro-google-user@example.com.json")
      if (!email && file.includes('@')) {
        const match = file.match(/([^-]+@[^.]+\.[^.]+)(?=\.json$)/);
        if (match) {
          email = match[1];
        }
      }

      // Initialize provider section if needed
      if (!registry.providers[provider]) {
        registry.providers[provider] = {
          default: 'default',
          accounts: {},
        };
      }

      const providerAccounts = registry.providers[provider];
      if (!providerAccounts) continue;

      // Skip if token file already registered (under any accountId)
      const existingTokenFiles = Object.values(providerAccounts.accounts).map((a) => a.tokenFile);
      if (existingTokenFiles.includes(file)) {
        // Token file exists - check if we need to update projectId for agy accounts
        const projectIdValue =
          typeof data.project_id === 'string' && data.project_id.trim()
            ? data.project_id.trim()
            : null;
        if (provider === 'agy' && projectIdValue) {
          const existingEntry = Object.entries(providerAccounts.accounts).find(
            ([, meta]) => meta.tokenFile === file
          );
          // Update if missing or changed
          if (existingEntry && existingEntry[1].projectId !== projectIdValue) {
            existingEntry[1].projectId = projectIdValue;
            discoveredCount++; // Count projectId updates as changes
          }
        }
        continue;
      }

      // Determine accountId based on provider type
      let accountId: string;

      if (PROVIDERS_WITHOUT_EMAIL.includes(provider) && !email) {
        // For kiro/ghcp without email: extract from filename or generate unique
        // Pattern: kiro-github-ABC123.json -> github-ABC123
        const filenameId = extractAccountIdFromTokenFile(file, undefined);

        if (filenameId !== 'default') {
          accountId = filenameId;
        } else {
          // Generate unique ID: provider + incrementing index
          let index = 1;
          while (providerAccounts.accounts[`${provider}-${index}`]) {
            index++;
          }
          accountId = `${provider}-${index}`;
        }
      } else {
        // For providers with email: use email or filename extraction
        accountId = extractAccountIdFromTokenFile(file, email);
      }

      // Skip if account already registered
      if (providerAccounts.accounts[accountId]) {
        continue;
      }

      // Set as default if first account
      if (Object.keys(providerAccounts.accounts).length === 0) {
        providerAccounts.default = accountId;
      }

      // Get file stats for creation time
      const stats = fs.statSync(filePath);

      // Register account with auto-generated nickname
      // Use mtime as lastUsedAt (when token was last modified = last auth/refresh)
      const lastModified = stats.mtime || stats.birthtime || new Date();
      const accountMeta: Omit<AccountInfo, 'id' | 'provider' | 'isDefault'> = {
        email,
        nickname: generateNickname(email),
        tokenFile: file,
        createdAt: stats.birthtime?.toISOString() || new Date().toISOString(),
        lastUsedAt: lastModified.toISOString(),
      };

      // Read project_id for Antigravity accounts (read-only field from auth token)
      const discoveredProjectId =
        typeof data.project_id === 'string' && data.project_id.trim()
          ? data.project_id.trim()
          : null;
      if (provider === 'agy' && discoveredProjectId) {
        accountMeta.projectId = discoveredProjectId;
      }

      providerAccounts.accounts[accountId] = accountMeta;
      discoveredCount++;
    } catch {
      // Skip invalid files
      continue;
    }
  }

  // Only save if at least one account was discovered or updated
  // This prevents creating accounts.json with empty provider sections
  if (discoveredCount === 0) {
    return;
  }

  // Reload-merge pattern: reduce race condition with concurrent OAuth registration
  // Reload fresh registry and merge discovered accounts (fresh registry wins on conflicts)
  const freshRegistry = loadAccountsRegistry();
  for (const [providerName, discovered] of Object.entries(registry.providers)) {
    if (!discovered) continue;
    // Skip empty provider sections (no accounts discovered)
    if (Object.keys(discovered.accounts).length === 0) continue;

    const prov = providerName as CLIProxyProvider;
    if (!freshRegistry.providers[prov]) {
      freshRegistry.providers[prov] = discovered;
    } else {
      // Merge accounts, preferring fresh registry's existing entries but updating projectId
      const freshProviderAccounts = freshRegistry.providers[prov];
      if (!freshProviderAccounts) continue;
      for (const [id, meta] of Object.entries(discovered.accounts)) {
        if (!freshProviderAccounts.accounts[id]) {
          freshProviderAccounts.accounts[id] = meta;
          // Set default if none exists
          if (!freshProviderAccounts.default || freshProviderAccounts.default === 'default') {
            freshProviderAccounts.default = id;
          }
        } else if (meta.projectId && !freshProviderAccounts.accounts[id].projectId) {
          // Update existing account with projectId if discovered from auth file
          freshProviderAccounts.accounts[id].projectId = meta.projectId;
        }
      }
    }
  }
  saveAccountsRegistry(freshRegistry);
}
