/**
 * Extended Context Utilities
 * Shared utilities for extended context (1M token window) feature.
 */

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
