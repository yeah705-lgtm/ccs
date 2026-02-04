/**
 * Image Analyzer Hook Installer
 *
 * Manages installation and uninstallation of the image analyzer hook.
 * This hook intercepts Read tool calls and analyzes image files via CLIProxy.
 *
 * @module utils/hooks/image-analyzer-hook-installer
 */

import * as fs from 'fs';
import * as path from 'path';
import { info, warn } from '../ui';
import { getImageAnalyzerHookPath, getCcsHooksDir } from './image-analyzer-hook-configuration';
import { getImageAnalysisConfig } from '../../config/unified-config-loader';
import { removeMigrationMarker } from './image-analyzer-profile-hook-injector';

// Re-export from hook-configuration for backward compatibility
export {
  getImageAnalyzerHookPath,
  getImageAnalyzerHookConfig,
} from './image-analyzer-hook-configuration';

// Hook file name
const IMAGE_ANALYZER_HOOK = 'image-analyzer-transformer.cjs';

/**
 * Check if image analyzer hook is installed
 */
export function hasImageAnalyzerHook(): boolean {
  return fs.existsSync(getImageAnalyzerHookPath());
}

/**
 * Install image analyzer hook to ~/.ccs/hooks/
 *
 * This hook intercepts Read calls and analyzes images via CLIProxy.
 *
 * @returns true if hook installed successfully
 */
export function installImageAnalyzerHook(): boolean {
  try {
    const imageConfig = getImageAnalysisConfig();

    // Skip if disabled
    if (!imageConfig.enabled) {
      if (process.env.CCS_DEBUG) {
        console.error(info('Image analysis disabled - skipping hook install'));
      }
      return false;
    }

    // Ensure hooks directory exists
    const hooksDir = getCcsHooksDir();
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true, mode: 0o700 });
    }

    const hookPath = getImageAnalyzerHookPath();

    // Find the bundled hook script
    // In npm package: node_modules/ccs/lib/hooks/
    // In development: lib/hooks/
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'lib', 'hooks', IMAGE_ANALYZER_HOOK),
      path.join(__dirname, '..', '..', 'lib', 'hooks', IMAGE_ANALYZER_HOOK),
      path.join(__dirname, '..', 'lib', 'hooks', IMAGE_ANALYZER_HOOK),
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
        console.error(warn(`Image analyzer hook source not found: ${IMAGE_ANALYZER_HOOK}`));
      }
      return false;
    }

    // Copy hook to ~/.ccs/hooks/
    fs.copyFileSync(sourcePath, hookPath);
    fs.chmodSync(hookPath, 0o755);

    if (process.env.CCS_DEBUG) {
      console.error(info(`Installed image analyzer hook: ${hookPath}`));
    }

    // Note: Hook registration is handled by ensureProfileHooks() in image-analyzer-profile-injector.ts
    // which writes to per-profile settings (~/.ccs/<profile>.settings.json)
    // Global settings (~/.claude/settings.json) are NOT modified here

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to install image analyzer hook: ${(error as Error).message}`));
    }
    return false;
  }
}

/**
 * Uninstall image analyzer hook from ~/.ccs/hooks/
 *
 * Note: Does NOT touch global ~/.claude/settings.json.
 * Profile-specific hooks are removed when ~/.ccs/ is deleted.
 *
 * @returns true if hook uninstalled successfully
 */
export function uninstallImageAnalyzerHook(): boolean {
  try {
    const hookPath = getImageAnalyzerHookPath();

    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
      if (process.env.CCS_DEBUG) {
        console.error(info(`Uninstalled image analyzer hook: ${hookPath}`));
      }
    }

    // Remove migration marker (so fresh install re-runs migration)
    removeMigrationMarker();

    // Note: Do NOT call removeHookConfig() - global settings should not be touched.
    // Per-profile hooks in ~/.ccs/*.settings.json are cleaned up when ~/.ccs/ is deleted.

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to uninstall image analyzer hook: ${(error as Error).message}`));
    }
    return false;
  }
}
