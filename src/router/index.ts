// Router module barrel export

// Config
export {
  loadRouterConfig,
  getRouterProfile,
  listRouterProfiles,
  isRouterProfile,
  getRouterPort,
  validateProfile,
  isProfileRunnable,
  generateRouterSettings,
  getRouterEnvVars,
} from './config';

export type {
  RouterConfig,
  RouterProfile,
  TierConfig,
  ApiProviderConfig,
  RouterSettings,
  ValidationResult,
} from './config';

// Providers
export {
  getProvider,
  isCLIProxyProvider,
  listProviders,
  getAllProviders,
  getPooledProvider,
  checkProviderHealth,
  checkAllProvidersHealth,
  CLIPROXY_PROVIDERS,
} from './providers';

export type { ResolvedProvider, ProviderHealthResult, Tier } from './providers';

// Resolver
export { detectTier, resolveRoute, resolveFallbackChain } from './resolver';

export type { ResolvedRoute, FallbackResult } from './resolver';

// Adapters
export {
  getAdapter,
  adapters,
  anthropicAdapter,
  openaiCompatAdapter,
  openRouterAdapter,
} from './adapters';

export type { ProviderAdapter, AnthropicRequest, AnthropicResponse } from './adapters';

// Server
export { createRouterServer, startRouter } from './server';

// Service
export {
  startRouterService,
  stopRouterService,
  getRouterServiceStatus,
  isRouterServiceActive,
} from './service';

// Lifecycle
export { runRouterSession, getActiveSession } from './lifecycle';

// CLI
export { handleRouterCommand } from './cli';
export type { RouterCommandResult } from './cli';
