/**
 * Grok CLI Detection
 *
 * Detects and manages Grok CLI installation status.
 *
 * @module utils/websearch/grok-cli
 */

import { execSync } from 'child_process';
import type { GrokCliStatus } from './types';

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
