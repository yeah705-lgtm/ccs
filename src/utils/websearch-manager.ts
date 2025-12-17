/**
 * WebSearch Manager - Manages WebSearch hook for CCS
 *
 * WebSearch is a server-side tool executed by Anthropic's API.
 * Third-party providers (gemini, agy, codex, qwen) don't have access.
 * This manager installs a hook that uses CLI tools (Gemini CLI) as fallback.
 *
 * Simplified Architecture:
 *   - No MCP complexity
 *   - Uses CLI tools (currently Gemini CLI)
 *   - Easy to extend for future CLI tools (opencode, etc.)
 *
 * @module utils/websearch-manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { ok, info, warn, fail } from './ui';
import { getWebSearchConfig } from '../config/unified-config-loader';

// CCS hooks directory
const CCS_HOOKS_DIR = path.join(os.homedir(), '.ccs', 'hooks');

// Hook file name
const WEBSEARCH_HOOK = 'websearch-transformer.cjs';

// Buffer time added to max provider timeout for hook timeout (seconds)
const HOOK_TIMEOUT_BUFFER = 30;

// Minimum hook timeout in seconds (fallback if no providers configured)
const MIN_HOOK_TIMEOUT = 60;

// Path to Claude settings.json
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

// ========== Gemini CLI Detection ==========

/**
 * Gemini CLI installation status
 */
export interface GeminiCliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

// Cache for Gemini CLI status (per process)
let geminiCliCache: GeminiCliStatus | null = null;

/**
 * Check if Gemini CLI is installed globally
 *
 * Requires global install: `npm install -g @google/gemini-cli`
 * No npx fallback - must be in PATH
 *
 * @returns Gemini CLI status with path and version
 */
export function getGeminiCliStatus(): GeminiCliStatus {
  // Return cached result if available
  if (geminiCliCache) {
    return geminiCliCache;
  }

  const result: GeminiCliStatus = {
    installed: false,
    path: null,
    version: null,
  };

  try {
    const isWindows = process.platform === 'win32';
    const whichCmd = isWindows ? 'where gemini' : 'which gemini';

    const pathResult = execSync(whichCmd, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const geminiPath = pathResult.trim().split('\n')[0]; // First result on Windows

    if (geminiPath) {
      result.installed = true;
      result.path = geminiPath;

      // Try to get version
      try {
        const versionResult = execSync('gemini --version', {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        result.version = versionResult.trim();
      } catch {
        // Version check failed, but CLI is installed
        result.version = 'unknown';
      }
    }
  } catch {
    // Command not found - Gemini CLI not installed
  }

  // Cache result
  geminiCliCache = result;
  return result;
}

/**
 * Check if Gemini CLI is available (quick boolean check)
 */
export function hasGeminiCli(): boolean {
  return getGeminiCliStatus().installed;
}

/**
 * Clear Gemini CLI cache (for testing or after installation)
 */
export function clearGeminiCliCache(): void {
  geminiCliCache = null;
}

// ========== Grok CLI Detection ==========

/**
 * Grok CLI installation status
 */
export interface GrokCliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

// Cache for Grok CLI status (per process)
let grokCliCache: GrokCliStatus | null = null;

/**
 * Check if Grok CLI is installed globally
 *
 * Grok CLI (grok-4-cli by lalomorales22) provides web search + X search.
 * Requires: `npm install -g grok-cli` and XAI_API_KEY env var.
 *
 * @returns Grok CLI status with path and version
 */
export function getGrokCliStatus(): GrokCliStatus {
  // Return cached result if available
  if (grokCliCache) {
    return grokCliCache;
  }

  const result: GrokCliStatus = {
    installed: false,
    path: null,
    version: null,
  };

  try {
    const isWindows = process.platform === 'win32';
    const whichCmd = isWindows ? 'where grok' : 'which grok';

    const pathResult = execSync(whichCmd, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const grokPath = pathResult.trim().split('\n')[0]; // First result on Windows

    if (grokPath) {
      result.installed = true;
      result.path = grokPath;

      // Try to get version
      try {
        const versionResult = execSync('grok --version', {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        result.version = versionResult.trim();
      } catch {
        // Version check failed, but CLI is installed
        result.version = 'unknown';
      }
    }
  } catch {
    // Command not found - Grok CLI not installed
  }

  // Cache result
  grokCliCache = result;
  return result;
}

/**
 * Check if Grok CLI is available (quick boolean check)
 */
export function hasGrokCli(): boolean {
  return getGrokCliStatus().installed;
}

/**
 * Clear Grok CLI cache (for testing or after installation)
 */
export function clearGrokCliCache(): void {
  grokCliCache = null;
}

// ========== OpenCode CLI Detection ==========

/**
 * OpenCode CLI installation status
 */
export interface OpenCodeCliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

// Cache for OpenCode CLI status (per process)
let opencodeCliCache: OpenCodeCliStatus | null = null;

/**
 * Check if OpenCode CLI is installed globally
 *
 * OpenCode provides built-in web search via opencode/grok-code model.
 * Install: curl -fsSL https://opencode.ai/install | bash
 *
 * @returns OpenCode CLI status with path and version
 */
export function getOpenCodeCliStatus(): OpenCodeCliStatus {
  // Return cached result if available
  if (opencodeCliCache) {
    return opencodeCliCache;
  }

  const result: OpenCodeCliStatus = {
    installed: false,
    path: null,
    version: null,
  };

  try {
    const isWindows = process.platform === 'win32';
    const whichCmd = isWindows ? 'where opencode' : 'which opencode';

    const pathResult = execSync(whichCmd, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const opencodePath = pathResult.trim().split('\n')[0]; // First result on Windows

    if (opencodePath) {
      result.installed = true;
      result.path = opencodePath;

      // Try to get version
      try {
        const versionResult = execSync('opencode --version', {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        result.version = versionResult.trim();
      } catch {
        // Version check failed, but CLI is installed
        result.version = 'unknown';
      }
    }
  } catch {
    // Command not found - OpenCode CLI not installed
  }

  // Cache result
  opencodeCliCache = result;
  return result;
}

/**
 * Check if OpenCode CLI is available (quick boolean check)
 */
export function hasOpenCodeCli(): boolean {
  return getOpenCodeCliStatus().installed;
}

/**
 * Clear OpenCode CLI cache (for testing or after installation)
 */
export function clearOpenCodeCliCache(): void {
  opencodeCliCache = null;
}

/**
 * Clear all CLI caches
 */
export function clearAllCliCaches(): void {
  geminiCliCache = null;
  grokCliCache = null;
  opencodeCliCache = null;
}

// ========== CLI Provider Info ==========

/**
 * WebSearch CLI provider information for health checks and UI
 */
export interface WebSearchCliInfo {
  /** Provider ID */
  id: 'gemini' | 'grok' | 'opencode';
  /** Display name */
  name: string;
  /** CLI command name */
  command: string;
  /** Whether CLI is installed */
  installed: boolean;
  /** CLI version if installed */
  version: string | null;
  /** Install command */
  installCommand: string;
  /** Docs URL */
  docsUrl: string;
  /** Whether this provider requires an API key */
  requiresApiKey: boolean;
  /** API key environment variable name */
  apiKeyEnvVar?: string;
  /** Brief description */
  description: string;
  /** Free tier available? */
  freeTier: boolean;
}

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

// ========== Hook Management ==========

/**
 * Install WebSearch hook to ~/.ccs/hooks/
 *
 * This hook intercepts WebSearch and executes via Gemini CLI.
 *
 * @returns true if hook installed successfully
 */
export function installWebSearchHook(): boolean {
  try {
    const wsConfig = getWebSearchConfig();

    // Skip if disabled
    if (!wsConfig.enabled) {
      if (process.env.CCS_DEBUG) {
        console.error(info('WebSearch disabled - skipping hook install'));
      }
      return false;
    }

    // Ensure hooks directory exists
    if (!fs.existsSync(CCS_HOOKS_DIR)) {
      fs.mkdirSync(CCS_HOOKS_DIR, { recursive: true, mode: 0o700 });
    }

    const hookPath = path.join(CCS_HOOKS_DIR, WEBSEARCH_HOOK);

    // Find the bundled hook script
    // In npm package: node_modules/ccs/lib/hooks/
    // In development: lib/hooks/
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'lib', 'hooks', WEBSEARCH_HOOK),
      path.join(__dirname, '..', 'lib', 'hooks', WEBSEARCH_HOOK),
    ];

    let sourcePath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        sourcePath = p;
        break;
      }
    }

    if (!sourcePath) {
      if (process.env.CCS_DEBUG) {
        console.error(warn(`WebSearch hook source not found: ${WEBSEARCH_HOOK}`));
      }
      return false;
    }

    // Copy hook to ~/.ccs/hooks/
    fs.copyFileSync(sourcePath, hookPath);
    fs.chmodSync(hookPath, 0o755);

    if (process.env.CCS_DEBUG) {
      console.error(info(`Installed WebSearch hook: ${hookPath}`));
    }

    // Ensure hook is configured in settings.json
    ensureHookConfig();

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to install WebSearch hook: ${(error as Error).message}`));
    }
    return false;
  }
}

/**
 * Check if WebSearch hook is installed
 */
export function hasWebSearchHook(): boolean {
  const hookPath = path.join(CCS_HOOKS_DIR, WEBSEARCH_HOOK);
  return fs.existsSync(hookPath);
}

/**
 * Get WebSearch hook configuration for settings.json
 * Timeout is computed from max provider timeout in config.yaml + buffer
 */
export function getWebSearchHookConfig(): Record<string, unknown> {
  const hookPath = path.join(CCS_HOOKS_DIR, WEBSEARCH_HOOK);
  const wsConfig = getWebSearchConfig();

  // Compute max timeout from enabled providers
  const timeouts: number[] = [];
  if (wsConfig.providers?.gemini?.enabled && wsConfig.providers.gemini.timeout) {
    timeouts.push(wsConfig.providers.gemini.timeout);
  }
  if (wsConfig.providers?.opencode?.enabled && wsConfig.providers.opencode.timeout) {
    timeouts.push(wsConfig.providers.opencode.timeout);
  }
  if (wsConfig.providers?.grok?.enabled && wsConfig.providers.grok.timeout) {
    timeouts.push(wsConfig.providers.grok.timeout);
  }

  // Hook timeout = max provider timeout + buffer (or minimum if none configured)
  const maxProviderTimeout = timeouts.length > 0 ? Math.max(...timeouts) : MIN_HOOK_TIMEOUT;
  const hookTimeout = maxProviderTimeout + HOOK_TIMEOUT_BUFFER;

  return {
    PreToolUse: [
      {
        matcher: 'WebSearch',
        hooks: [
          {
            type: 'command',
            command: `node "${hookPath}"`,
            timeout: hookTimeout,
          },
        ],
      },
    ],
  };
}

/**
 * Ensure WebSearch hook is configured in ~/.claude/settings.json
 */
function ensureHookConfig(): boolean {
  try {
    const wsConfig = getWebSearchConfig();

    if (!wsConfig.enabled) {
      return false;
    }

    // Read existing settings or start fresh
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      try {
        const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8');
        settings = JSON.parse(content);
      } catch {
        if (process.env.CCS_DEBUG) {
          console.error(warn('Malformed settings.json - will merge carefully'));
        }
      }
    }

    // Check if WebSearch hook already configured
    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    const expectedHookPath = path.join(CCS_HOOKS_DIR, WEBSEARCH_HOOK);
    const expectedCommand = `node "${expectedHookPath}"`;

    if (hooks?.PreToolUse) {
      const webSearchHookIndex = hooks.PreToolUse.findIndex((h: unknown) => {
        const hook = h as Record<string, unknown>;
        return hook.matcher === 'WebSearch';
      });

      if (webSearchHookIndex !== -1) {
        // Hook exists - check if it needs updating (different command path or timeout)
        const existingHook = hooks.PreToolUse[webSearchHookIndex] as Record<string, unknown>;
        const existingHooks = existingHook.hooks as Array<Record<string, unknown>>;
        const currentHookConfig = getWebSearchHookConfig();
        const expectedHooks = (currentHookConfig.PreToolUse as Array<Record<string, unknown>>)[0]
          .hooks as Array<Record<string, unknown>>;
        const expectedTimeout = expectedHooks[0].timeout as number;

        let needsUpdate = false;

        if (existingHooks?.[0]?.command !== expectedCommand) {
          existingHooks[0].command = expectedCommand;
          needsUpdate = true;
        }

        if (existingHooks?.[0]?.timeout !== expectedTimeout) {
          existingHooks[0].timeout = expectedTimeout;
          needsUpdate = true;
        }

        if (needsUpdate) {
          fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
          if (process.env.CCS_DEBUG) {
            console.error(info('Updated WebSearch hook config in settings.json'));
          }
        }
        return true;
      }
    }

    // Get hook config
    const hookConfig = getWebSearchHookConfig();

    // Merge hook config into settings
    if (!settings.hooks) {
      settings.hooks = {};
    }

    const settingsHooks = settings.hooks as Record<string, unknown[]>;
    if (!settingsHooks.PreToolUse) {
      settingsHooks.PreToolUse = [];
    }

    // Add our hook config
    const preToolUseHooks = hookConfig.PreToolUse as unknown[];
    settingsHooks.PreToolUse.push(...preToolUseHooks);

    // Ensure ~/.claude directory exists
    const claudeDir = path.dirname(CLAUDE_SETTINGS_PATH);
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true, mode: 0o700 });
    }

    // Write updated settings
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');

    if (process.env.CCS_DEBUG) {
      console.error(info('Added WebSearch hook to settings.json'));
    }

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to configure WebSearch hook: ${(error as Error).message}`));
    }
    return false;
  }
}

// ========== Environment Variables for Hook ==========

/**
 * Get environment variables for WebSearch hook configuration.
 *
 * Simple env vars - hook reads these to control behavior.
 *
 * @returns Record of environment variables to set before spawning Claude
 */
export function getWebSearchHookEnv(): Record<string, string> {
  const wsConfig = getWebSearchConfig();
  const env: Record<string, string> = {};

  // Skip hook entirely if disabled
  if (!wsConfig.enabled) {
    env.CCS_WEBSEARCH_SKIP = '1';
    return env;
  }

  // Pass master switch
  env.CCS_WEBSEARCH_ENABLED = '1';

  // Pass individual provider enabled states
  // Hook will only use providers that are BOTH enabled AND installed
  if (wsConfig.providers?.gemini?.enabled) {
    env.CCS_WEBSEARCH_GEMINI = '1';
    env.CCS_WEBSEARCH_TIMEOUT = String(wsConfig.providers.gemini.timeout || 55);
  }

  if (wsConfig.providers?.opencode?.enabled) {
    env.CCS_WEBSEARCH_OPENCODE = '1';
    if (wsConfig.providers.opencode.model) {
      env.CCS_WEBSEARCH_OPENCODE_MODEL = wsConfig.providers.opencode.model;
    }
    // Use opencode timeout if no gemini timeout set
    if (!env.CCS_WEBSEARCH_TIMEOUT) {
      env.CCS_WEBSEARCH_TIMEOUT = String(wsConfig.providers.opencode.timeout || 90);
    }
  }

  if (wsConfig.providers?.grok?.enabled) {
    env.CCS_WEBSEARCH_GROK = '1';
    // Use grok timeout if no other timeout set
    if (!env.CCS_WEBSEARCH_TIMEOUT) {
      env.CCS_WEBSEARCH_TIMEOUT = String(wsConfig.providers.grok.timeout || 55);
    }
  }

  // Default timeout if none set
  if (!env.CCS_WEBSEARCH_TIMEOUT) {
    env.CCS_WEBSEARCH_TIMEOUT = '55';
  }

  return env;
}

// ========== WebSearch Readiness Status ==========

/**
 * WebSearch availability status for third-party profiles
 */
export type WebSearchReadiness = 'ready' | 'unavailable';

/**
 * WebSearch status for display
 */
export interface WebSearchStatus {
  readiness: WebSearchReadiness;
  geminiCli: boolean;
  grokCli: boolean;
  opencodeCli: boolean;
  message: string;
}

/**
 * Get WebSearch readiness status for display
 *
 * Called on third-party profile startup to inform user.
 */
export function getWebSearchReadiness(): WebSearchStatus {
  const wsConfig = getWebSearchConfig();

  // Check if WebSearch is disabled entirely
  if (!wsConfig.enabled) {
    return {
      readiness: 'unavailable',
      geminiCli: false,
      grokCli: false,
      opencodeCli: false,
      message: 'Disabled in config',
    };
  }

  // Check all CLIs
  const geminiInstalled = hasGeminiCli();
  const grokInstalled = hasGrokCli();
  const opencodeInstalled = hasOpenCodeCli();

  // Build message based on installed CLIs
  const installedClis: string[] = [];
  if (geminiInstalled) installedClis.push('Gemini');
  if (grokInstalled) installedClis.push('Grok');
  if (opencodeInstalled) installedClis.push('OpenCode');

  if (installedClis.length > 0) {
    return {
      readiness: 'ready',
      geminiCli: geminiInstalled,
      grokCli: grokInstalled,
      opencodeCli: opencodeInstalled,
      message: `Ready (${installedClis.join(' + ')})`,
    };
  }

  return {
    readiness: 'unavailable',
    geminiCli: false,
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
    case 'unavailable':
      console.error(fail(`WebSearch: ${status.message}`));
      // Show install hints for CLI-only users
      const hints = getCliInstallHints();
      if (hints.length > 0) {
        for (const hint of hints) {
          console.error(info(hint));
        }
      }
      break;
  }
}

// ========== Backward Compatibility Exports ==========
// These are kept for imports that haven't been updated yet

/**
 * @deprecated Use installWebSearchHook instead - MCP is no longer used
 */
export function ensureMcpWebSearch(): boolean {
  // No-op - MCP is no longer used
  return false;
}

/**
 * @deprecated MCP is no longer used
 */
export function hasMcpWebSearch(): boolean {
  return false;
}

/**
 * @deprecated MCP is no longer used
 */
export function getMcpConfigPath(): string {
  return path.join(os.homedir(), '.claude', '.mcp.json');
}
