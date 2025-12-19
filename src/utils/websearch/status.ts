/**
 * WebSearch Status and Readiness
 *
 * Provides status checking and display functions for WebSearch.
 *
 * @module utils/websearch/status
 */

import { ok, warn, fail, info } from '../ui';
import { getWebSearchConfig } from '../../config/unified-config-loader';
import { getGeminiCliStatus, hasGeminiCli, isGeminiAuthenticated } from './gemini-cli';
import { getGrokCliStatus, hasGrokCli } from './grok-cli';
import { getOpenCodeCliStatus, hasOpenCodeCli } from './opencode-cli';
import type { WebSearchCliInfo, WebSearchStatus } from './types';

/**
 * Get all WebSearch CLI providers with their status
 */
export function getWebSearchCliProviders(): WebSearchCliInfo[] {
  const geminiStatus = getGeminiCliStatus();
  const grokStatus = getGrokCliStatus();
  const opencodeStatus = getOpenCodeCliStatus();

  return [
    {
      id: 'gemini',
      name: 'Gemini CLI',
      command: 'gemini',
      installed: geminiStatus.installed,
      version: geminiStatus.version,
      installCommand: 'npm install -g @google/gemini-cli',
      docsUrl: 'https://github.com/google-gemini/gemini-cli',
      requiresApiKey: false,
      description: 'Google Gemini with web search (FREE tier: 1000 req/day)',
      freeTier: true,
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      command: 'opencode',
      installed: opencodeStatus.installed,
      version: opencodeStatus.version,
      installCommand: 'curl -fsSL https://opencode.ai/install | bash',
      docsUrl: 'https://github.com/sst/opencode',
      requiresApiKey: false,
      description: 'OpenCode with built-in web search (FREE via Zen)',
      freeTier: true,
    },
    {
      id: 'grok',
      name: 'Grok CLI',
      command: 'grok',
      installed: grokStatus.installed,
      version: grokStatus.version,
      installCommand: 'npm install -g @vibe-kit/grok-cli',
      docsUrl: 'https://github.com/superagent-ai/grok-cli',
      requiresApiKey: true,
      apiKeyEnvVar: 'GROK_API_KEY',
      description: 'xAI Grok CLI with AI coding agent capabilities',
      freeTier: false,
    },
  ];
}

/**
 * Check if any WebSearch CLI is available
 */
export function hasAnyWebSearchCli(): boolean {
  return hasGeminiCli() || hasGrokCli() || hasOpenCodeCli();
}

/**
 * Get install hints for CLI-only users when no WebSearch CLI is installed
 */
export function getCliInstallHints(): string[] {
  if (hasAnyWebSearchCli()) {
    return [];
  }

  return [
    '[i] WebSearch: No CLI tools installed',
    '    Gemini CLI (FREE): npm i -g @google/gemini-cli',
    '    OpenCode (FREE):   curl -fsSL https://opencode.ai/install | bash',
    '    Grok CLI (paid):   npm i -g @vibe-kit/grok-cli',
  ];
}

/**
 * Get WebSearch readiness status for display
 *
 * Called on third-party profile startup to inform user.
 * Checks both installation AND authentication status for Gemini CLI.
 */
export function getWebSearchReadiness(): WebSearchStatus {
  const wsConfig = getWebSearchConfig();

  // Check if WebSearch is disabled entirely
  if (!wsConfig.enabled) {
    return {
      readiness: 'unavailable',
      geminiCli: false,
      geminiAuthenticated: false,
      grokCli: false,
      opencodeCli: false,
      message: 'Disabled in config',
    };
  }

  // Check all CLIs
  const geminiInstalled = hasGeminiCli();
  const geminiAuthed = geminiInstalled && isGeminiAuthenticated();
  const grokInstalled = hasGrokCli();
  const opencodeInstalled = hasOpenCodeCli();

  // Build message based on installed + authenticated CLIs
  const readyClis: string[] = [];
  const needsAuthClis: string[] = [];

  // Gemini requires auth check
  if (geminiInstalled) {
    if (geminiAuthed) {
      readyClis.push('Gemini');
    } else {
      needsAuthClis.push('Gemini');
    }
  }

  // Other CLIs don't require auth check (for now)
  if (grokInstalled) readyClis.push('Grok');
  if (opencodeInstalled) readyClis.push('OpenCode');

  // Determine overall status
  if (readyClis.length > 0) {
    return {
      readiness: 'ready',
      geminiCli: geminiInstalled,
      geminiAuthenticated: geminiAuthed,
      grokCli: grokInstalled,
      opencodeCli: opencodeInstalled,
      message: `Ready (${readyClis.join(' + ')})`,
    };
  }

  if (needsAuthClis.length > 0) {
    return {
      readiness: 'needs_auth',
      geminiCli: geminiInstalled,
      geminiAuthenticated: false,
      grokCli: grokInstalled,
      opencodeCli: opencodeInstalled,
      message: `Gemini: run 'gemini' to login`,
    };
  }

  return {
    readiness: 'unavailable',
    geminiCli: false,
    geminiAuthenticated: false,
    grokCli: false,
    opencodeCli: false,
    message: 'Install: npm i -g @google/gemini-cli',
  };
}

/**
 * Display WebSearch status (single line, equilibrium UX)
 *
 * Only call for third-party profiles.
 * Shows detailed install hints when no CLI is installed.
 */
export function displayWebSearchStatus(): void {
  const status = getWebSearchReadiness();

  switch (status.readiness) {
    case 'ready':
      console.error(ok(`WebSearch: ${status.message}`));
      break;
    case 'needs_auth':
      console.error(warn(`WebSearch: ${status.message}`));
      break;
    case 'unavailable':
      console.error(fail(`WebSearch: ${status.message}`));
      const hints = getCliInstallHints();
      if (hints.length > 0) {
        for (const hint of hints) {
          console.error(info(hint));
        }
      }
      break;
  }
}
