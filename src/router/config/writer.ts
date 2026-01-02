import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { parseYaml, stringifyYaml } from './loader';
import type { RouterProfile, RouterConfig } from './schema';
import { getConfigPath } from './loader';

/**
 * Save a router profile to config.yaml
 */
export async function saveRouterProfile(name: string, profile: RouterProfile): Promise<void> {
  const configPath = getConfigPath();

  // Read existing config
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    config = (parseYaml(content) as Record<string, unknown>) ?? {};
  }

  // Ensure router.profiles section exists
  if (!config.router) {
    config.router = { profiles: {} };
  }
  const router = config.router as { profiles?: Record<string, unknown> };
  if (!router.profiles) {
    router.profiles = {};
  }

  // Add/update profile
  router.profiles[name] = profile;

  // Write back
  const yaml = stringifyYaml(config);
  writeFileSync(configPath, yaml, 'utf-8');
}

/**
 * Delete a router profile from config.yaml
 */
export async function deleteRouterProfile(name: string): Promise<boolean> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return false;
  }

  const content = readFileSync(configPath, 'utf-8');
  const config = (parseYaml(content) as Record<string, unknown>) ?? {};

  const router = config.router as { profiles?: Record<string, unknown> } | undefined;
  if (!router?.profiles?.[name]) {
    return false;
  }

  delete router.profiles[name];

  const yaml = stringifyYaml(config);
  writeFileSync(configPath, yaml, 'utf-8');

  return true;
}

/**
 * Update router defaults in config.yaml
 */
export async function updateRouterDefaults(
  defaults: Partial<RouterConfig['defaults']>
): Promise<void> {
  const configPath = getConfigPath();

  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    config = (parseYaml(content) as Record<string, unknown>) ?? {};
  }

  if (!config.router) {
    config.router = {};
  }
  const router = config.router as Record<string, unknown>;

  router.defaults = {
    ...((router.defaults as Record<string, unknown>) ?? {}),
    ...defaults,
  };

  const yaml = stringifyYaml(config);
  writeFileSync(configPath, yaml, 'utf-8');
}
