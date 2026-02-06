/**
 * Extended Context Configuration
 *
 * Handles the [1m] suffix for models supporting 1M token context window.
 * Claude Code recognizes this suffix to enable extended context.
 *
 * Behavior:
 * - Gemini family (gemini-* but NOT gemini-claude-*): Auto-enabled by default
 * - Claude (Anthropic): Opt-in via --1m flag
 */

import { CLIProxyProvider } from '../types';
import { supportsExtendedContext, isNativeGeminiModel } from '../model-catalog';

/** Extended context suffix recognized by Claude Code */
const EXTENDED_CONTEXT_SUFFIX = '[1m]';

/**
 * Apply extended context suffix to model name.
 * Appends [1m] suffix if not already present.
 *
 * @param model - Model name (may include thinking suffix like "model(high)")
 * @returns Model name with [1m] suffix, e.g., "gemini-2.5-pro[1m]" or "gemini-2.5-pro(high)[1m]"
 */
export function applyExtendedContextSuffix(model: string): string {
  if (model.endsWith(EXTENDED_CONTEXT_SUFFIX)) {
    return model;
  }
  return `${model}${EXTENDED_CONTEXT_SUFFIX}`;
}

/**
 * Determine if extended context should be applied to a model.
 *
 * @param provider - CLIProxy provider
 * @param modelId - Base model ID (without suffixes)
 * @param extendedContextOverride - CLI override (true = force on, false = force off, undefined = auto)
 * @returns Whether to apply extended context suffix
 */
export function shouldApplyExtendedContext(
  provider: CLIProxyProvider,
  modelId: string,
  extendedContextOverride?: boolean
): boolean {
  // Explicit override takes priority
  if (extendedContextOverride === true) {
    // User explicitly requested --1m
    return supportsExtendedContext(provider, modelId);
  }
  if (extendedContextOverride === false) {
    // User explicitly disabled with --no-1m
    return false;
  }

  // Auto behavior: enable for native Gemini models only
  if (isNativeGeminiModel(modelId)) {
    return supportsExtendedContext(provider, modelId);
  }

  // For other models (Claude, etc.), default to off - require explicit --1m
  return false;
}

/**
 * Apply extended context configuration to env vars.
 * Modifies ANTHROPIC_MODEL and tier models with [1m] suffix.
 *
 * @param envVars - Environment variables to modify (mutated in place)
 * @param provider - CLIProxy provider
 * @param extendedContextOverride - CLI override (true = force on, false = force off, undefined = auto)
 */
export function applyExtendedContextConfig(
  envVars: NodeJS.ProcessEnv,
  provider: CLIProxyProvider,
  extendedContextOverride?: boolean
): void {
  // Get base model to check support (strip any existing suffixes for lookup)
  const baseModel = envVars.ANTHROPIC_MODEL || '';
  const cleanModelId = stripModelSuffixes(baseModel);

  if (!shouldApplyExtendedContext(provider, cleanModelId, extendedContextOverride)) {
    return;
  }

  // Apply suffix to main model
  if (envVars.ANTHROPIC_MODEL) {
    envVars.ANTHROPIC_MODEL = applyExtendedContextSuffix(envVars.ANTHROPIC_MODEL);
  }

  // Apply to tier models if they support extended context
  const tierModels = [
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  ] as const;

  for (const tierVar of tierModels) {
    const model = envVars[tierVar];
    if (model) {
      const tierCleanId = stripModelSuffixes(model);
      if (shouldApplyExtendedContext(provider, tierCleanId, extendedContextOverride)) {
        envVars[tierVar] = applyExtendedContextSuffix(model);
      }
    }
  }
}

/**
 * Strip thinking and extended context suffixes from model ID for catalog lookup.
 * Examples:
 *   "gemini-2.5-pro(high)[1m]" -> "gemini-2.5-pro"
 *   "gemini-2.5-pro(8192)" -> "gemini-2.5-pro"
 *   "gemini-2.5-pro" -> "gemini-2.5-pro"
 */
function stripModelSuffixes(modelId: string): string {
  return modelId
    .replace(/\[1m\]$/i, '') // Remove [1m] suffix
    .replace(/\([^)]+\)$/, ''); // Remove thinking suffix like (high) or (8192)
}
