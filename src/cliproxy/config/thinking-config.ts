/**
 * Thinking configuration and suffix handling
 * Manages thinking budget suffixes for CLIProxyAPIPlus
 */

import { CLIProxyProvider } from '../types';
import { ThinkingConfig, DEFAULT_THINKING_TIER_DEFAULTS } from '../../config/unified-config-types';
import { getThinkingConfig } from '../../config/unified-config-loader';
import { supportsThinking } from '../model-catalog';
import { validateThinking } from '../thinking-validator';
import { warn } from '../../utils/ui';

/** Model tier types for thinking budget defaults */
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

/**
 * Check if warnings should be shown based on thinking config.
 * Defaults to true if show_warnings is not explicitly false.
 */
function shouldShowWarnings(thinkingConfig: ThinkingConfig): boolean {
  return thinkingConfig.show_warnings !== false;
}

/**
 * Detect tier from model name.
 * Returns 'sonnet' as default if unclear.
 */
export function detectTierFromModel(modelName: string): ModelTier {
  const lower = modelName.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  return 'sonnet'; // Default to sonnet (most common)
}

/**
 * Apply thinking suffix to model name.
 * CLIProxyAPIPlus parses suffixes like model(level) or model(budget).
 *
 * @param model - Base model name
 * @param thinkingValue - Level name (e.g., 'high') or numeric budget
 * @returns Model name with thinking suffix, e.g., "gemini-3-pro-preview(high)"
 */
export function applyThinkingSuffix(model: string, thinkingValue: string | number): string {
  // Don't apply if model already ends with a parenthesized suffix (e.g., "model(high)" or "model(8192)")
  // Matches: ends with "(...)" where content is non-empty
  if (/\([^)]+\)$/.test(model)) {
    return model;
  }
  return `${model}(${thinkingValue})`;
}

/**
 * Get thinking value for tier based on config.
 * Respects provider-specific overrides if configured.
 */
export function getThinkingValueForTier(
  tier: ModelTier,
  provider: CLIProxyProvider,
  thinkingConfig: ThinkingConfig
): string {
  // Check provider-specific override first
  const providerOverride = thinkingConfig.provider_overrides?.[provider]?.[tier];
  if (providerOverride) {
    return providerOverride;
  }
  // Fall back to global tier default (with null guard, uses centralized defaults)
  return thinkingConfig.tier_defaults?.[tier] ?? DEFAULT_THINKING_TIER_DEFAULTS[tier];
}

/**
 * Apply thinking configuration to env vars.
 * Modifies ANTHROPIC_MODEL and tier models with thinking suffixes.
 *
 * @param envVars - Environment variables to modify
 * @param provider - CLIProxy provider
 * @param thinkingOverride - Optional CLI override (takes priority over config)
 * @returns Modified env vars with thinking suffixes applied
 */
export function applyThinkingConfig(
  envVars: NodeJS.ProcessEnv,
  provider: CLIProxyProvider,
  thinkingOverride?: string | number
): NodeJS.ProcessEnv {
  const thinkingConfig = getThinkingConfig();
  const result = { ...envVars };

  // Check if thinking is off
  if (thinkingConfig.mode === 'off' && thinkingOverride === undefined) {
    return result;
  }

  // Get base model to check thinking support
  const baseModel = result.ANTHROPIC_MODEL || '';
  if (!supportsThinking(provider, baseModel)) {
    // U2: Warn user if they explicitly provided --thinking but model doesn't support it
    if (thinkingOverride !== undefined && shouldShowWarnings(thinkingConfig)) {
      console.warn(
        warn(
          `Model ${baseModel || 'unknown'} (provider: ${provider}) does not support thinking budget. --thinking flag ignored.`
        )
      );
    }
    return result;
  }

  // Determine thinking value to use
  let thinkingValue: string | number;

  if (thinkingOverride !== undefined) {
    // CLI override takes priority
    thinkingValue = thinkingOverride;
  } else if (thinkingConfig.mode === 'manual' && thinkingConfig.override !== undefined) {
    // Config manual mode with override
    thinkingValue = thinkingConfig.override;
  } else if (thinkingConfig.mode === 'auto') {
    // Auto mode: detect tier and apply default
    const tier = detectTierFromModel(baseModel);
    thinkingValue = getThinkingValueForTier(tier, provider, thinkingConfig);
  } else {
    return result; // No thinking to apply
  }

  // Validate thinking value against model capabilities
  const validation = validateThinking(provider, baseModel, thinkingValue);
  if (validation.warning && shouldShowWarnings(thinkingConfig)) {
    console.warn(warn(validation.warning));
  }
  thinkingValue = validation.value;

  // If validation says off, don't apply suffix
  if (thinkingValue === 'off') {
    return result;
  }

  // Apply thinking suffix to main model
  if (result.ANTHROPIC_MODEL) {
    result.ANTHROPIC_MODEL = applyThinkingSuffix(result.ANTHROPIC_MODEL, thinkingValue);
  }

  // Apply to tier models if they support thinking
  const tierModels = [
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  ] as const;

  for (const tierVar of tierModels) {
    const model = result[tierVar];
    if (model && supportsThinking(provider, model)) {
      // Get tier-specific thinking value
      const tier = tierVar.includes('OPUS')
        ? 'opus'
        : tierVar.includes('SONNET')
          ? 'sonnet'
          : 'haiku';
      const tierThinkingValue =
        thinkingOverride ?? getThinkingValueForTier(tier, provider, thinkingConfig);
      result[tierVar] = applyThinkingSuffix(model, tierThinkingValue);
    }
  }

  return result;
}
