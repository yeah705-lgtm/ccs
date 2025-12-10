/**
 * Data Aggregator for Claude Code Usage Analytics
 *
 * Aggregates raw JSONL entries into daily, monthly, and session summaries.
 * Uses model-pricing.ts for cost calculations.
 */

import { type RawUsageEntry } from './jsonl-parser';
import { calculateCost } from './model-pricing';
import {
  type ModelBreakdown,
  type DailyUsage,
  type MonthlyUsage,
  type SessionUsage,
} from './usage-types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Extract YYYY-MM-DD from ISO timestamp */
function extractDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/** Extract YYYY-MM from ISO timestamp */
function extractMonth(timestamp: string): string {
  return timestamp.slice(0, 7);
}

/** Create model breakdown from accumulated data */
function createModelBreakdown(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): ModelBreakdown {
  const cost = calculateCost(
    { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens },
    modelName
  );

  return {
    modelName,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cost,
  };
}

/** Accumulator for per-model token counts */
interface ModelAccumulator {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

// ============================================================================
// DAILY AGGREGATION
// ============================================================================

/**
 * Aggregate raw entries into daily usage summaries
 * Groups by date (YYYY-MM-DD), calculates costs per model
 */
export function aggregateDailyUsage(
  entries: RawUsageEntry[],
  source = 'custom-parser'
): DailyUsage[] {
  // Group entries by date
  const byDate = new Map<string, RawUsageEntry[]>();

  for (const entry of entries) {
    const date = extractDate(entry.timestamp);
    const existing = byDate.get(date) || [];
    existing.push(entry);
    byDate.set(date, existing);
  }

  // Build daily summaries
  const dailyUsage: DailyUsage[] = [];

  for (const [date, dateEntries] of byDate) {
    // Aggregate by model
    const modelMap = new Map<string, ModelAccumulator>();
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;

    for (const entry of dateEntries) {
      const model = entry.model;
      const acc = modelMap.get(model) || {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };

      acc.inputTokens += entry.inputTokens;
      acc.outputTokens += entry.outputTokens;
      acc.cacheCreationTokens += entry.cacheCreationTokens;
      acc.cacheReadTokens += entry.cacheReadTokens;
      modelMap.set(model, acc);

      totalInput += entry.inputTokens;
      totalOutput += entry.outputTokens;
      totalCacheCreation += entry.cacheCreationTokens;
      totalCacheRead += entry.cacheReadTokens;
    }

    // Build model breakdowns
    const modelBreakdowns: ModelBreakdown[] = [];
    let totalCost = 0;

    for (const [modelName, acc] of modelMap) {
      const breakdown = createModelBreakdown(
        modelName,
        acc.inputTokens,
        acc.outputTokens,
        acc.cacheCreationTokens,
        acc.cacheReadTokens
      );
      modelBreakdowns.push(breakdown);
      totalCost += breakdown.cost;
    }

    // Sort breakdowns by cost descending
    modelBreakdowns.sort((a, b) => b.cost - a.cost);

    dailyUsage.push({
      date,
      source,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCacheCreation,
      cacheReadTokens: totalCacheRead,
      cost: totalCost,
      totalCost,
      modelsUsed: Array.from(modelMap.keys()),
      modelBreakdowns,
    });
  }

  // Sort by date descending (most recent first)
  dailyUsage.sort((a, b) => b.date.localeCompare(a.date));

  return dailyUsage;
}

// ============================================================================
// MONTHLY AGGREGATION
// ============================================================================

/**
 * Aggregate raw entries into monthly usage summaries
 * Groups by month (YYYY-MM), calculates costs per model
 */
export function aggregateMonthlyUsage(
  entries: RawUsageEntry[],
  source = 'custom-parser'
): MonthlyUsage[] {
  // Group entries by month
  const byMonth = new Map<string, RawUsageEntry[]>();

  for (const entry of entries) {
    const month = extractMonth(entry.timestamp);
    const existing = byMonth.get(month) || [];
    existing.push(entry);
    byMonth.set(month, existing);
  }

  // Build monthly summaries
  const monthlyUsage: MonthlyUsage[] = [];

  for (const [month, monthEntries] of byMonth) {
    // Aggregate by model
    const modelMap = new Map<string, ModelAccumulator>();
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;

    for (const entry of monthEntries) {
      const model = entry.model;
      const acc = modelMap.get(model) || {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };

      acc.inputTokens += entry.inputTokens;
      acc.outputTokens += entry.outputTokens;
      acc.cacheCreationTokens += entry.cacheCreationTokens;
      acc.cacheReadTokens += entry.cacheReadTokens;
      modelMap.set(model, acc);

      totalInput += entry.inputTokens;
      totalOutput += entry.outputTokens;
      totalCacheCreation += entry.cacheCreationTokens;
      totalCacheRead += entry.cacheReadTokens;
    }

    // Build model breakdowns
    const modelBreakdowns: ModelBreakdown[] = [];
    let totalCost = 0;

    for (const [modelName, acc] of modelMap) {
      const breakdown = createModelBreakdown(
        modelName,
        acc.inputTokens,
        acc.outputTokens,
        acc.cacheCreationTokens,
        acc.cacheReadTokens
      );
      modelBreakdowns.push(breakdown);
      totalCost += breakdown.cost;
    }

    // Sort breakdowns by cost descending
    modelBreakdowns.sort((a, b) => b.cost - a.cost);

    monthlyUsage.push({
      month,
      source,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCacheCreation,
      cacheReadTokens: totalCacheRead,
      totalCost,
      modelsUsed: Array.from(modelMap.keys()),
      modelBreakdowns,
    });
  }

  // Sort by month descending (most recent first)
  monthlyUsage.sort((a, b) => b.month.localeCompare(a.month));

  return monthlyUsage;
}

// ============================================================================
// SESSION AGGREGATION
// ============================================================================

/**
 * Aggregate raw entries into session usage summaries
 * Groups by sessionId, tracks last activity and versions
 */
export function aggregateSessionUsage(
  entries: RawUsageEntry[],
  source = 'custom-parser'
): SessionUsage[] {
  // Group entries by sessionId
  const bySession = new Map<string, RawUsageEntry[]>();

  for (const entry of entries) {
    if (!entry.sessionId) continue;
    const existing = bySession.get(entry.sessionId) || [];
    existing.push(entry);
    bySession.set(entry.sessionId, existing);
  }

  // Build session summaries
  const sessionUsage: SessionUsage[] = [];

  for (const [sessionId, sessionEntries] of bySession) {
    // Aggregate by model
    const modelMap = new Map<string, ModelAccumulator>();
    const versions = new Set<string>();
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;
    let lastActivity = '';
    let projectPath = '';

    for (const entry of sessionEntries) {
      const model = entry.model;
      const acc = modelMap.get(model) || {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };

      acc.inputTokens += entry.inputTokens;
      acc.outputTokens += entry.outputTokens;
      acc.cacheCreationTokens += entry.cacheCreationTokens;
      acc.cacheReadTokens += entry.cacheReadTokens;
      modelMap.set(model, acc);

      totalInput += entry.inputTokens;
      totalOutput += entry.outputTokens;
      totalCacheCreation += entry.cacheCreationTokens;
      totalCacheRead += entry.cacheReadTokens;

      // Track latest timestamp
      if (entry.timestamp > lastActivity) {
        lastActivity = entry.timestamp;
      }

      // Track versions
      if (entry.version) {
        versions.add(entry.version);
      }

      // Use project path from entry
      if (entry.projectPath) {
        projectPath = entry.projectPath;
      }
    }

    // Build model breakdowns
    const modelBreakdowns: ModelBreakdown[] = [];
    let totalCost = 0;

    for (const [modelName, acc] of modelMap) {
      const breakdown = createModelBreakdown(
        modelName,
        acc.inputTokens,
        acc.outputTokens,
        acc.cacheCreationTokens,
        acc.cacheReadTokens
      );
      modelBreakdowns.push(breakdown);
      totalCost += breakdown.cost;
    }

    // Sort breakdowns by cost descending
    modelBreakdowns.sort((a, b) => b.cost - a.cost);

    sessionUsage.push({
      sessionId,
      projectPath,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCacheCreation,
      cacheReadTokens: totalCacheRead,
      cost: totalCost,
      totalCost,
      lastActivity,
      versions: Array.from(versions),
      modelsUsed: Array.from(modelMap.keys()),
      modelBreakdowns,
      source,
    });
  }

  // Sort by last activity descending (most recent first)
  sessionUsage.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  return sessionUsage;
}

// ============================================================================
// MAIN DATA LOADER (drop-in replacement for better-ccusage)
// ============================================================================

import { scanProjectsDirectory, type ParserOptions } from './jsonl-parser';

/**
 * Load daily usage data (replaces better-ccusage loadDailyUsageData)
 */
export async function loadDailyUsageData(options?: ParserOptions): Promise<DailyUsage[]> {
  const entries = await scanProjectsDirectory(options);
  return aggregateDailyUsage(entries);
}

/**
 * Load monthly usage data (replaces better-ccusage loadMonthlyUsageData)
 */
export async function loadMonthlyUsageData(options?: ParserOptions): Promise<MonthlyUsage[]> {
  const entries = await scanProjectsDirectory(options);
  return aggregateMonthlyUsage(entries);
}

/**
 * Load session data (replaces better-ccusage loadSessionData)
 */
export async function loadSessionData(options?: ParserOptions): Promise<SessionUsage[]> {
  const entries = await scanProjectsDirectory(options);
  return aggregateSessionUsage(entries);
}

/**
 * Load all usage data in a single pass (more efficient)
 */
export async function loadAllUsageData(options?: ParserOptions): Promise<{
  daily: DailyUsage[];
  monthly: MonthlyUsage[];
  session: SessionUsage[];
}> {
  const entries = await scanProjectsDirectory(options);
  return {
    daily: aggregateDailyUsage(entries),
    monthly: aggregateMonthlyUsage(entries),
    session: aggregateSessionUsage(entries),
  };
}
