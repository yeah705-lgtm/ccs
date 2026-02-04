/**
 * Image Read Block Hook Environment Variables
 *
 * Provides environment variables for image read blocking hook configuration.
 * Prevents context overflow when skills generate images and agent tries to read them.
 *
 * Enabled by default for third-party profiles (settings, cliproxy).
 * Disabled for native Claude accounts where context is managed server-side.
 *
 * @module utils/hooks/image-read-block-hook-env
 */

import { loadOrCreateUnifiedConfig } from '../../config/unified-config-loader';

/**
 * Configuration for image read blocking.
 */
export interface ImageReadBlockConfig {
  /** Whether blocking is enabled (default: true) */
  enabled: boolean;
}

/**
 * Get image read block configuration from unified config.
 * Defaults to ENABLED (opt-out feature) - matches WebSearch pattern.
 */
export function getImageReadBlockConfig(): ImageReadBlockConfig {
  const config = loadOrCreateUnifiedConfig();
  // Access hooks config via type assertion since it's a new field not yet in UnifiedConfig type
  const hooksConfig = (
    config as unknown as { hooks?: { block_image_read?: { enabled?: boolean } } }
  ).hooks;
  return {
    // Default to TRUE - enabled by default, user can opt-out
    enabled: hooksConfig?.block_image_read?.enabled ?? true,
  };
}

/**
 * Get environment variables for image read block hook configuration.
 *
 * Like WebSearch, this respects CCS_PROFILE_TYPE:
 * - 'account' or 'default' profiles: Skip blocking (native Claude)
 * - 'settings' or 'cliproxy' profiles: Apply blocking
 *
 * @returns Record of environment variables to set before spawning Claude
 */
export function getImageReadBlockHookEnv(): Record<string, string> {
  const config = getImageReadBlockConfig();
  const env: Record<string, string> = {};

  if (config.enabled) {
    env.CCS_BLOCK_IMAGE_READ = '1';
  } else {
    // Explicit disable signal
    env.CCS_BLOCK_IMAGE_READ = '0';
  }

  return env;
}
