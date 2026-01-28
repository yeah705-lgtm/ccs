/**
 * Provider Configuration
 * Shared constants for provider branding and assets
 */

// Map provider names to asset filenames (only providers with actual logos)
export const PROVIDER_ASSETS: Record<string, string> = {
  gemini: '/assets/providers/gemini-color.svg',
  agy: '/assets/providers/agy.png',
  codex: '/assets/providers/openai.svg',
  qwen: '/assets/providers/qwen-color.svg',
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
