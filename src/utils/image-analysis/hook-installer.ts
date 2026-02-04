/**
 * Image Analysis Hook Installer
 *
 * Manages installation of prompt templates for image analysis (user-customizable).
 *
 * @module utils/image-analysis/hook-installer
 */

import * as fs from 'fs';
import * as path from 'path';
import { info, warn } from '../ui';
import { getCcsDir } from '../config-manager';

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
