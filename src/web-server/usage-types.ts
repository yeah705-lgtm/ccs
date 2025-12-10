/**
 * Usage Data Types
 *
 * Type definitions for aggregated usage data.
 * Compatible with better-ccusage interfaces for drop-in replacement.
 */

// ============================================================================
// MODEL BREAKDOWN
// ============================================================================

/** Per-model token and cost breakdown */
export interface ModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

// ============================================================================
// AGGREGATED USAGE TYPES
// ============================================================================

/** Daily usage aggregation (YYYY-MM-DD) */
export interface DailyUsage {
  date: string;
  source: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
}

/** Monthly usage aggregation (YYYY-MM) */
export interface MonthlyUsage {
  month: string;
  source: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
}

/** Session-level usage aggregation */
export interface SessionUsage {
  sessionId: string;
  projectPath: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  totalCost: number;
  lastActivity: string;
  versions: string[];
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
  source: string;
}
