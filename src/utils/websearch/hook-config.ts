/**
 * WebSearch Hook Configuration
 *
 * Manages hook configuration in Claude settings.json.
 *
 * @module utils/websearch/hook-config
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { info, warn } from '../ui';
import { getWebSearchConfig } from '../../config/unified-config-loader';

// Path to Claude settings.json
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

// CCS hooks directory
const CCS_HOOKS_DIR = path.join(os.homedir(), '.ccs', 'hooks');

// Hook file name
const WEBSEARCH_HOOK = 'websearch-transformer.cjs';

// Buffer time added to max provider timeout for hook timeout (seconds)
const HOOK_TIMEOUT_BUFFER = 30;

// Minimum hook timeout in seconds (fallback if no providers configured)
const MIN_HOOK_TIMEOUT = 60;

/**
 * Get path to WebSearch hook
 */
export function getHookPath(): string {
  return path.join(CCS_HOOKS_DIR, WEBSEARCH_HOOK);
}

/**
 * Get WebSearch hook configuration for settings.json
 * Timeout is computed from max provider timeout in config.yaml + buffer
 */
export function getWebSearchHookConfig(): Record<string, unknown> {
  const hookPath = getHookPath();
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
export function ensureHookConfig(): boolean {
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
    const expectedHookPath = getHookPath();
    const expectedCommand = `node "${expectedHookPath}"`;

    if (hooks?.PreToolUse) {
      const webSearchHookIndex = hooks.PreToolUse.findIndex((h: unknown) => {
        const hook = h as Record<string, unknown>;
        return hook.matcher === 'WebSearch';
      });

      if (webSearchHookIndex !== -1) {
        // Hook exists - check if it needs updating
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
