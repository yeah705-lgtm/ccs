import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RouterProfile } from './schema';
import { getRouterPort } from './loader';

export interface RouterSettings {
  env: {
    ANTHROPIC_BASE_URL: string;
    ANTHROPIC_MODEL: string;
    ANTHROPIC_DEFAULT_OPUS_MODEL: string;
    ANTHROPIC_DEFAULT_SONNET_MODEL: string;
    ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  };
}

/**
 * Generate Claude settings for router session
 * Router intercepts requests and routes based on model name
 */
export function generateRouterSettings(_profile: RouterProfile, port?: number): RouterSettings {
  const routerPort = port ?? getRouterPort();

  return {
    env: {
      // Point Claude CLI to router
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${routerPort}/v1`,

      // Default model (Claude will send this, router detects tier)
      ANTHROPIC_MODEL: 'claude-sonnet-4-5-20250929',

      // Tier model names (Claude uses these for tier selection)
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-5-20251124',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-5-20250929',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5-20251015',
    },
  };
}

/**
 * Write settings to file
 */
export function writeRouterSettings(
  settingsPath: string,
  profile: RouterProfile,
  port?: number
): void {
  const settings = generateRouterSettings(profile, port);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

/**
 * Generate settings file path for profile
 */
export function getRouterSettingsPath(ccsDir: string, profileName: string): string {
  return join(ccsDir, `router-${profileName}.settings.json`);
}

/**
 * Get environment variables for spawning Claude CLI
 */
export function getRouterEnvVars(profile: RouterProfile, port?: number): Record<string, string> {
  const settings = generateRouterSettings(profile, port);
  return settings.env;
}
