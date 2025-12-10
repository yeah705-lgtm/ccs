/**
 * API Client
 * Phase 03: REST API Routes & CRUD
 */

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || res.statusText);
  }

  return res.json();
}

// Types
export interface Profile {
  name: string;
  settingsPath: string;
  configured: boolean;
}

export interface CreateProfile {
  name: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export interface UpdateProfile {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface Variant {
  name: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  settings: string;
  account?: string;
}

export interface CreateVariant {
  name: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  model?: string;
  account?: string;
}

export interface UpdateVariant {
  provider?: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  model?: string;
  account?: string;
}

/** OAuth account info for multi-account support */
export interface OAuthAccount {
  id: string;
  email?: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  isDefault: boolean;
  tokenFile: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface AuthStatus {
  provider: string;
  displayName: string;
  authenticated: boolean;
  lastAuth: string | null;
  tokenFiles: number;
  accounts: OAuthAccount[];
  defaultAccount?: string;
}

/** Provider accounts summary */
export type ProviderAccountsMap = Record<string, OAuthAccount[]>;

export interface Account {
  name: string;
  type?: string;
  created: string;
  last_used?: string | null;
}

// Unified config types
export interface ConfigFormat {
  format: 'yaml' | 'json' | 'none';
  migrationNeeded: boolean;
  backups: string[];
}

export interface MigrationResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  migratedFiles: string[];
  warnings: string[];
}

export interface SecretsExists {
  exists: boolean;
  keys: string[];
}

// API
export const api = {
  profiles: {
    list: () => request<{ profiles: Profile[] }>('/profiles'),
    create: (data: CreateProfile) =>
      request('/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (name: string, data: UpdateProfile) =>
      request(`/profiles/${name}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (name: string) => request(`/profiles/${name}`, { method: 'DELETE' }),
  },
  cliproxy: {
    list: () => request<{ variants: Variant[] }>('/cliproxy'),
    auth: () => request<{ authStatus: AuthStatus[] }>('/cliproxy/auth'),
    create: (data: CreateVariant) =>
      request('/cliproxy', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (name: string, data: UpdateVariant) =>
      request(`/cliproxy/${name}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (name: string) => request(`/cliproxy/${name}`, { method: 'DELETE' }),
    // Multi-account management
    accounts: {
      list: () => request<{ accounts: ProviderAccountsMap }>('/cliproxy/accounts'),
      listByProvider: (provider: string) =>
        request<{ provider: string; accounts: OAuthAccount[] }>(`/cliproxy/accounts/${provider}`),
      setDefault: (provider: string, accountId: string) =>
        request(`/cliproxy/accounts/${provider}/default`, {
          method: 'POST',
          body: JSON.stringify({ accountId }),
        }),
      remove: (provider: string, accountId: string) =>
        request(`/cliproxy/accounts/${provider}/${accountId}`, { method: 'DELETE' }),
    },
  },
  accounts: {
    list: () => request<{ accounts: Account[]; default: string | null }>('/accounts'),
    setDefault: (name: string) =>
      request('/accounts/default', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
  // Unified config API
  config: {
    format: () => request<ConfigFormat>('/config/format'),
    get: () => request<Record<string, unknown>>('/config'),
    update: (config: Record<string, unknown>) =>
      request<{ success: boolean }>('/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    migrate: (dryRun = false) =>
      request<MigrationResult>(`/config/migrate?dryRun=${dryRun}`, { method: 'POST' }),
    rollback: (backupPath: string) =>
      request<{ success: boolean }>('/config/rollback', {
        method: 'POST',
        body: JSON.stringify({ backupPath }),
      }),
  },
  secrets: {
    update: (profile: string, secrets: Record<string, string>) =>
      request<{ success: boolean }>(`/secrets/${profile}`, {
        method: 'PUT',
        body: JSON.stringify(secrets),
      }),
    exists: (profile: string) => request<SecretsExists>(`/secrets/${profile}/exists`),
  },
};
