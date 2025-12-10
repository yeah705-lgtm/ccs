/**
 * Secrets Manager
 *
 * Handles loading and saving secrets (API keys, tokens) in a separate file
 * with restricted permissions (chmod 600).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getCcsDir } from '../utils/config-manager';
import { SecretsConfig, isSecretsConfig, createEmptySecretsConfig } from './unified-config-types';

// Re-export from shared utility for backward compatibility
export { isSensitiveKey as isSecretKey } from '../utils/sensitive-keys';

const SECRETS_FILE = 'secrets.yaml';
const SECRETS_FILE_MODE = 0o600; // Owner read/write only

/**
 * Get path to secrets.yaml
 */
export function getSecretsPath(): string {
  return path.join(getCcsDir(), SECRETS_FILE);
}

/**
 * Check if secrets.yaml exists
 */
export function hasSecrets(): boolean {
  return fs.existsSync(getSecretsPath());
}

/**
 * Load secrets from YAML file.
 * Returns empty secrets config if file doesn't exist.
 */
export function loadSecrets(): SecretsConfig {
  const secretsPath = getSecretsPath();

  if (!fs.existsSync(secretsPath)) {
    return createEmptySecretsConfig();
  }

  try {
    const content = fs.readFileSync(secretsPath, 'utf8');
    const parsed = yaml.load(content);

    if (!isSecretsConfig(parsed)) {
      console.error(`[!] Invalid secrets format in ${secretsPath}`);
      return createEmptySecretsConfig();
    }

    return parsed;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[X] Failed to load secrets: ${error}`);
    return createEmptySecretsConfig();
  }
}

/**
 * Save secrets to YAML file with restricted permissions.
 * Uses atomic write (temp file + rename) to prevent corruption.
 */
export function saveSecrets(secrets: SecretsConfig): void {
  const secretsPath = getSecretsPath();
  const dir = path.dirname(secretsPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  // Convert to YAML
  const content = yaml.dump(secrets, {
    indent: 2,
    lineWidth: -1,
    quotingType: '"',
    noRefs: true,
  });

  // Atomic write: write to temp file, then rename
  const tempPath = `${secretsPath}.tmp.${process.pid}`;

  try {
    fs.writeFileSync(tempPath, content, { mode: SECRETS_FILE_MODE });
    fs.renameSync(tempPath, secretsPath);

    // Ensure correct permissions after rename (some systems may not preserve)
    fs.chmodSync(secretsPath, SECRETS_FILE_MODE);
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw err;
  }
}

/**
 * Get a secret value for a specific profile.
 */
export function getProfileSecret(profileName: string, key: string): string | undefined {
  const secrets = loadSecrets();
  return secrets.profiles[profileName]?.[key];
}

/**
 * Set a secret value for a specific profile.
 */
export function setProfileSecret(profileName: string, key: string, value: string): void {
  const secrets = loadSecrets();

  if (!secrets.profiles[profileName]) {
    secrets.profiles[profileName] = {};
  }

  secrets.profiles[profileName][key] = value;
  saveSecrets(secrets);
}

/**
 * Delete a secret value for a specific profile.
 */
export function deleteProfileSecret(profileName: string, key: string): boolean {
  const secrets = loadSecrets();

  if (!secrets.profiles[profileName]?.[key]) {
    return false;
  }

  delete secrets.profiles[profileName][key];

  // Clean up empty profile object
  if (Object.keys(secrets.profiles[profileName]).length === 0) {
    delete secrets.profiles[profileName];
  }

  saveSecrets(secrets);
  return true;
}

/**
 * Get all secrets for a profile.
 */
export function getProfileSecrets(profileName: string): Record<string, string> {
  const secrets = loadSecrets();
  return secrets.profiles[profileName] || {};
}

/**
 * Set all secrets for a profile (replaces existing).
 */
export function setProfileSecrets(
  profileName: string,
  profileSecrets: Record<string, string>
): void {
  const secrets = loadSecrets();

  if (Object.keys(profileSecrets).length === 0) {
    delete secrets.profiles[profileName];
  } else {
    secrets.profiles[profileName] = profileSecrets;
  }

  saveSecrets(secrets);
}

/**
 * Delete all secrets for a profile.
 */
export function deleteAllProfileSecrets(profileName: string): boolean {
  const secrets = loadSecrets();

  if (!secrets.profiles[profileName]) {
    return false;
  }

  delete secrets.profiles[profileName];
  saveSecrets(secrets);
  return true;
}
