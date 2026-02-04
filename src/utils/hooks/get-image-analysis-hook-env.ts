/**
 * Image Analysis Hook Environment Variables
 *
 * Provides environment variables for image analysis hook configuration.
 * Hook routes image/PDF files through CLIProxy for vision analysis.
 *
 * @module utils/hooks/image-analysis-hook-env
 */

import { getImageAnalysisConfig } from '../../config/unified-config-loader';

/**
 * Serialize provider_models map to env var format: provider:model,provider:model
 */
function serializeProviderModels(providerModels: Record<string, string>): string {
  return Object.entries(providerModels)
    .map(([provider, model]) => `${provider}:${model}`)
    .join(',');
}

/**
 * Get image analysis hook environment variables.
 * These env vars control the hook's behavior via Claude Code hook system.
 *
 * @param provider - Current CLIProxy provider (e.g., 'agy', 'gemini', 'codex')
 * @returns Environment variables for image analysis hook
 */
export function getImageAnalysisHookEnv(provider?: string): Record<string, string> {
  const config = getImageAnalysisConfig();

  // Check if current provider has a vision model configured
  const hasVisionModel = provider && config.provider_models[provider];
  const skipImageAnalysis = !config.enabled || !hasVisionModel;

  return {
    CCS_IMAGE_ANALYSIS_ENABLED: config.enabled ? '1' : '0',
    CCS_IMAGE_ANALYSIS_TIMEOUT: String(Number(config.timeout) || 60),
    CCS_IMAGE_ANALYSIS_PROVIDER_MODELS: serializeProviderModels(config.provider_models),
    CCS_CURRENT_PROVIDER: provider || '',
    CCS_IMAGE_ANALYSIS_SKIP: skipImageAnalysis ? '1' : '0',
  };
}
