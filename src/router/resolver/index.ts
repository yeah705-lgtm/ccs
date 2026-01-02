// Resolver barrel exports

// Tier detection
export { detectTier, isTier } from './tier';

// Route resolution
export { resolveRoute, getTierConfig, validateProfileRoutes } from './route';

// Fallback chain
export { resolveFallbackChain, type FallbackResult, type FallbackAttempt } from './fallback';

// Re-export types from providers for convenience
export type { ResolvedRoute } from '../providers/types';
