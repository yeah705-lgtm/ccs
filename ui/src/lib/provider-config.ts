/**
 * Provider Configuration
 * Shared constants for CLIProxy providers - SINGLE SOURCE OF TRUTH for UI
 *
 * When adding a new provider, update CLIPROXY_PROVIDERS array and related mappings.
 */

/**
 * Canonical list of CLIProxy provider IDs
 * This is the UI's single source of truth for valid providers.
 * Must stay in sync with backend's CLIPROXY_PROFILES in src/auth/profile-detector.ts
 */
export const CLIPROXY_PROVIDERS = [
  'gemini',
  'codex',
  'agy',
  'qwen',
  'iflow',
  'kiro',
  'ghcp',
  'claude',
] as const;

/** Union type for CLIProxy provider IDs */
export type CLIProxyProvider = (typeof CLIPROXY_PROVIDERS)[number];

/** Check if a string is a valid CLIProxy provider */
export function isValidProvider(provider: string): provider is CLIProxyProvider {
  return CLIPROXY_PROVIDERS.includes(provider as CLIProxyProvider);
}

// Map provider names to asset filenames (only providers with actual logos)
export const PROVIDER_ASSETS: Record<string, string> = {
  gemini: '/assets/providers/gemini-color.svg',
  agy: '/assets/providers/agy.png',
  codex: '/assets/providers/openai.svg',
  qwen: '/assets/providers/qwen-color.svg',
  iflow: '/assets/providers/iflow.png',
  kiro: '/assets/providers/kiro.png',
  ghcp: '/assets/providers/copilot.svg',
  claude: '/assets/providers/claude.svg',
};

// Provider brand colors
export const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  agy: '#f3722c',
  codex: '#10a37f',
  vertex: '#4285F4',
  iflow: '#f94144',
  qwen: '#6236FF',
  kiro: '#4d908e', // Dark Cyan (AWS-inspired)
  ghcp: '#43aa8b', // Seaweed (GitHub-inspired)
  claude: '#D97757', // Anthropic brand color (matches SVG)
};

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Gemini',
  agy: 'Antigravity',
  codex: 'Codex',
  vertex: 'Vertex AI',
  iflow: 'iFlow',
  qwen: 'Qwen',
  kiro: 'Kiro (AWS)',
  ghcp: 'GitHub Copilot (OAuth)',
  claude: 'Claude (Anthropic)',
};

// Map provider to display name
export function getProviderDisplayName(provider: string): string {
  return PROVIDER_NAMES[provider.toLowerCase()] || provider;
}

/**
 * Providers that use Device Code OAuth flow instead of Authorization Code flow.
 * Device Code flow requires displaying a user code for manual entry at provider's website.
 */
export const DEVICE_CODE_PROVIDERS: CLIProxyProvider[] = ['ghcp', 'qwen'];

/** Check if provider uses Device Code flow */
export function isDeviceCodeProvider(provider: string): boolean {
  return DEVICE_CODE_PROVIDERS.includes(provider as CLIProxyProvider);
}
