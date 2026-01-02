import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml, dump as stringifyYaml } from 'js-yaml';
import { routerConfigSchema, type RouterConfig, type RouterProfile } from './schema';
import { getCcsDir } from '../../utils/config-manager';

// Re-export yaml functions for writer.ts
export { parseYaml, stringifyYaml };

/**
 * Get config.yaml path
 */
export function getConfigPath(): string {
  return join(getCcsDir(), 'config.yaml');
}

/**
 * Load router configuration from config.yaml
 * @returns Router configuration or null if not configured
 */
export function loadRouterConfig(): RouterConfig | null {
  const configPath = join(getCcsDir(), 'config.yaml');

  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, 'utf-8');
  const config = parseYaml(content) as Record<string, unknown> | null;

  if (!config?.router) {
    return null;
  }

  return routerConfigSchema.parse(config.router);
}

/**
 * Get specific router profile by name
 */
export function getRouterProfile(name: string): RouterProfile | null {
  const config = loadRouterConfig();
  return config?.profiles?.[name] ?? null;
}

/**
 * List all router profile names
 */
export function listRouterProfiles(): string[] {
  const config = loadRouterConfig();
  return config?.profiles ? Object.keys(config.profiles) : [];
}

/**
 * Check if a name is a router profile
 */
export function isRouterProfile(name: string): boolean {
  return getRouterProfile(name) !== null;
}

/**
 * Get router port from config (default: 9400)
 */
export function getRouterPort(): number {
  const config = loadRouterConfig();
  return config?.port ?? 9400;
}
