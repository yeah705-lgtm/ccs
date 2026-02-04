/**
 * Image Analysis Hook Installer
 *
 * Manages installation of:
 * 1. block-image-read.cjs hook (blocks image reads to prevent context overflow)
 * 2. Prompt templates for image analysis (user-customizable)
 *
 * @module utils/image-analysis/hook-installer
 */

import * as fs from 'fs';
import * as path from 'path';
import { info, warn } from '../ui';
import { getCcsDir } from '../config-manager';

// Hook file name
const IMAGE_BLOCK_HOOK = 'block-image-read.cjs';

/**
 * Get path to installed hook script
 */
export function getHookPath(): string {
  return path.join(getCcsDir(), 'hooks', IMAGE_BLOCK_HOOK);
}

/**
 * Get CCS hooks directory
 */
export function getCcsHooksDir(): string {
  return path.join(getCcsDir(), 'hooks');
}

/**
 * Get prompts directory for image analysis
 */
export function getPromptsDir(): string {
  return path.join(getCcsDir(), 'prompts', 'image-analysis');
}

/**
 * Check if image block hook is installed
 */
export function hasImageBlockHook(): boolean {
  return fs.existsSync(getHookPath());
}

/**
 * Install image block hook to ~/.ccs/hooks/
 *
 * This hook intercepts Read tool calls for image files and blocks them
 * to prevent context overflow (images consume 100K+ tokens each).
 *
 * @returns true if hook installed successfully
 */
export function installImageBlockHook(): boolean {
  try {
    // Ensure hooks directory exists
    const hooksDir = getCcsHooksDir();
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true, mode: 0o700 });
    }

    const hookPath = getHookPath();

    // Find the bundled hook script
    // In npm package: node_modules/ccs/lib/hooks/
    // In development: lib/hooks/
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'lib', 'hooks', IMAGE_BLOCK_HOOK),
      path.join(__dirname, '..', '..', 'lib', 'hooks', IMAGE_BLOCK_HOOK),
      path.join(__dirname, '..', 'lib', 'hooks', IMAGE_BLOCK_HOOK),
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
        console.error(warn(`Image block hook source not found: ${IMAGE_BLOCK_HOOK}`));
      }
      return false;
    }

    // Copy hook to ~/.ccs/hooks/
    fs.copyFileSync(sourcePath, hookPath);
    fs.chmodSync(hookPath, 0o755);

    if (process.env.CCS_DEBUG) {
      console.error(info(`Installed image block hook: ${hookPath}`));
    }

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to install image block hook: ${(error as Error).message}`));
    }
    return false;
  }
}

/**
 * Install prompt templates to ~/.ccs/prompts/image-analysis/
 * Only installs if directory doesn't exist (doesn't overwrite user edits)
 *
 * @returns true if prompts installed or already exist
 */
export function installImageAnalysisPrompts(): boolean {
  try {
    const promptsDir = getPromptsDir();

    // Skip if already exists (preserve user customizations)
    if (fs.existsSync(promptsDir)) {
      if (process.env.CCS_DEBUG) {
        console.error(
          info('Image analysis prompts already installed - preserving user customizations')
        );
      }
      return true;
    }

    // Create directory
    fs.mkdirSync(promptsDir, { recursive: true, mode: 0o755 });

    // Find bundled prompts
    const possibleBasePaths = [
      path.join(__dirname, '..', '..', '..', 'lib', 'prompts'),
      path.join(__dirname, '..', '..', 'lib', 'prompts'),
      path.join(__dirname, '..', 'lib', 'prompts'),
    ];

    let promptsBasePath: string | null = null;
    for (const p of possibleBasePaths) {
      if (fs.existsSync(p)) {
        promptsBasePath = p;
        break;
      }
    }

    if (!promptsBasePath) {
      if (process.env.CCS_DEBUG) {
        console.error(warn('Image analysis prompts source not found'));
      }
      return false;
    }

    // Copy prompt files
    const promptFiles = [
      'image-analysis-default.txt',
      'image-analysis-screenshot.txt',
      'image-analysis-document.txt',
    ];

    for (const file of promptFiles) {
      const sourcePath = path.join(promptsBasePath, file);
      const destPath = path.join(promptsDir, file.replace('image-analysis-', ''));

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        fs.chmodSync(destPath, 0o644);
      } else if (process.env.CCS_DEBUG) {
        console.error(warn(`Prompt template not found: ${file}`));
      }
    }

    if (process.env.CCS_DEBUG) {
      console.error(info(`Installed image analysis prompts: ${promptsDir}`));
    }

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to install image analysis prompts: ${(error as Error).message}`));
    }
    return false;
  }
}

/**
 * Uninstall image block hook from ~/.ccs/hooks/
 *
 * @returns true if hook uninstalled successfully
 */
export function uninstallImageBlockHook(): boolean {
  try {
    const hookPath = getHookPath();

    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
      if (process.env.CCS_DEBUG) {
        console.error(info(`Uninstalled image block hook: ${hookPath}`));
      }
    }

    return true;
  } catch (error) {
    if (process.env.CCS_DEBUG) {
      console.error(warn(`Failed to uninstall image block hook: ${(error as Error).message}`));
    }
    return false;
  }
}
