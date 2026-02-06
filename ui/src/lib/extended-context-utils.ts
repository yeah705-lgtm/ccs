/**
 * Extended Context Utilities
 * Shared utilities for extended context (1M token window) feature.
 */

/** The suffix that enables 1M token context in Claude Code */
export const EXTENDED_CONTEXT_SUFFIX = '[1m]';

/**
 * Check if model is a native Gemini model (auto-enabled behavior).
 * Native Gemini models: gemini-* but NOT gemini-claude-*
 *
 * This mirrors the backend function in src/cliproxy/model-catalog.ts
 */
export function isNativeGeminiModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.startsWith('gemini-') && !lower.startsWith('gemini-claude-');
}

/**
 * Check if model string already has [1m] suffix
 */
export function hasExtendedContextSuffix(model: string): boolean {
  return model.toLowerCase().endsWith(EXTENDED_CONTEXT_SUFFIX.toLowerCase());
}

/**
 * Apply [1m] suffix to model string if not already present
 */
export function applyExtendedContextSuffix(model: string): string {
  if (!model) return model;
  if (hasExtendedContextSuffix(model)) return model;
  return `${model}${EXTENDED_CONTEXT_SUFFIX}`;
}

/**
 * Strip [1m] suffix from model string
 */
export function stripExtendedContextSuffix(model: string): string {
  if (!model) return model;
  if (hasExtendedContextSuffix(model)) {
    return model.slice(0, -EXTENDED_CONTEXT_SUFFIX.length);
  }
  return model;
}
