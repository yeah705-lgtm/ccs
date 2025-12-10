/**
 * Feature flags for gradual rollout of new functionality.
 */

/**
 * Check if unified config (YAML) is enabled.
 * Set CCS_UNIFIED_CONFIG=1 to enable.
 */
export function isUnifiedConfigEnabled(): boolean {
  return process.env.CCS_UNIFIED_CONFIG === '1';
}

/**
 * Check if migration mode is active.
 * Set CCS_MIGRATE=1 to trigger automatic migration.
 */
export function isMigrationEnabled(): boolean {
  return process.env.CCS_MIGRATE === '1';
}

/**
 * Check if debug mode is enabled.
 * Set CCS_DEBUG=1 for verbose logging.
 */
export function isDebugEnabled(): boolean {
  return process.env.CCS_DEBUG === '1';
}
