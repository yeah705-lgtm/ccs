import type { ResolvedProvider, ApiProviderConfig } from './types';
import { loadRouterConfig } from '../config/loader';

// Hardcoded CLIProxy providers (auto-discovered)
const CLIPROXY_PROVIDER_LIST = ['agy', 'gemini', 'codex', 'qwen', 'iflow', 'kiro', 'ghcp'] as const;

// CLIProxyAPI base URL
const CLIPROXY_BASE_URL = 'http://127.0.0.1:8317';

/**
 * Get provider by name
 * Priority: 1. CLIProxy hardcoded, 2. API providers from config
 */
export async function getProvider(name: string): Promise<ResolvedProvider | null> {
  // Check CLIProxy providers first
  if (isCLIProxyProvider(name)) {
    return resolveCLIProxyProvider(name);
  }

  // Check API providers from config
  const config = loadRouterConfig();
  const apiConfig = config?.providers?.[name];

  if (apiConfig) {
    return resolveApiProvider(name, apiConfig);
  }

  return null;
}

/**
 * Check if name is a hardcoded CLIProxy provider
 */
export function isCLIProxyProvider(name: string): boolean {
  return CLIPROXY_PROVIDER_LIST.includes(name as (typeof CLIPROXY_PROVIDER_LIST)[number]);
}

/**
 * Resolve CLIProxy provider
 */
function resolveCLIProxyProvider(name: string): ResolvedProvider {
  return {
    name,
    type: 'cliproxy',
    adapter: 'anthropic', // CLIProxy speaks Anthropic format
    baseUrl: `${CLIPROXY_BASE_URL}/api/provider/${name}/v1`,
  };
}

/**
 * Resolve API provider from config
 */
function resolveApiProvider(name: string, config: ApiProviderConfig): ResolvedProvider {
  const authToken = process.env[config.auth_env];

  return {
    name,
    type: 'api',
    adapter: config.adapter,
    baseUrl: config.base_url,
    authToken,
    headers: config.headers,
  };
}

/**
 * List all available providers
 */
export async function listProviders(): Promise<{
  cliproxy: string[];
  api: string[];
}> {
  const config = loadRouterConfig();

  return {
    cliproxy: [...CLIPROXY_PROVIDER_LIST],
    api: config?.providers ? Object.keys(config.providers) : [],
  };
}

/**
 * Get all providers as resolved list
 */
export async function getAllProviders(): Promise<ResolvedProvider[]> {
  const providers: ResolvedProvider[] = [];

  // Add CLIProxy providers
  for (const name of CLIPROXY_PROVIDER_LIST) {
    providers.push(resolveCLIProxyProvider(name));
  }

  // Add API providers
  const config = loadRouterConfig();
  if (config?.providers) {
    for (const [name, apiConfig] of Object.entries(config.providers)) {
      providers.push(resolveApiProvider(name, apiConfig));
    }
  }

  return providers;
}
