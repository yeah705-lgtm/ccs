/**
 * AgyProxy module exports
 *
 * Provides model ID normalization for Antigravity provider responses.
 * Fixes MCP tool failures caused by invalid model IDs in responses.
 */

export { AgyProxy } from './agy-proxy';
export { normalizeModelId, MODEL_ID_MAP } from './model-normalizer';
