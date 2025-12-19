/**
 * OpenCode CLI Detection
 *
 * Detects and manages OpenCode CLI installation status.
 *
 * @module utils/websearch/opencode-cli
 */

import { execSync } from 'child_process';
import type { OpenCodeCliStatus } from './types';

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
