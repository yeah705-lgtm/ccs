/**
 * Image Analysis Utilities
 *
 * Exports hook installer functions for image blocking and prompt management
 */

export {
  getHookPath,
  getCcsHooksDir,
  getPromptsDir,
  hasImageBlockHook,
  installImageBlockHook,
  installImageAnalysisPrompts,
  uninstallImageBlockHook,
} from './hook-installer';
