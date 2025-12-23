/**
 * Model ID Normalizer for Antigravity responses
 *
 * Antigravity returns internal model aliases like "claude-sonnet-4-5-thinking"
 * which are not valid Anthropic model IDs. Claude Code uses these IDs for
 * subsequent MCP tool calls, causing failures.
 *
 * This module normalizes invalid model IDs to valid Anthropic format.
 */

/**
 * Mapping of internal Antigravity model IDs to valid Anthropic model IDs
 */
export const MODEL_ID_MAP: Record<string, string> = {
  'claude-sonnet-4-5-thinking': 'claude-sonnet-4-5-20250929',
  'claude-opus-4-5-thinking': 'claude-opus-4-5-20251101',
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
};

/**
 * Normalize a model ID to a valid Anthropic format
 * Returns original ID if not in the mapping (passthrough unknown models)
 */
export function normalizeModelId(model: string): string {
  return MODEL_ID_MAP[model] || model;
}
