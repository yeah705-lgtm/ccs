/**
 * React Query hook for CLIProxyAPI stats
 */

import { useQuery } from '@tanstack/react-query';
import type { ModelQuota, QuotaResult } from '@/lib/api-client';

/** Per-account usage statistics */
export interface AccountUsageStats {
  /** Account email or identifier */
  source: string;
  /** Number of successful requests */
  successCount: number;
  /** Number of failed requests */
  failureCount: number;
  /** Total tokens used */
  totalTokens: number;
  /** Last request timestamp */
  lastUsedAt?: string;
}

/** CLIProxy usage statistics */
export interface CliproxyStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  requestsByModel: Record<string, number>;
  requestsByProvider: Record<string, number>;
  /** Per-account usage breakdown */
  accountStats: Record<string, AccountUsageStats>;
  quotaExceededCount: number;
  retryCount: number;
  collectedAt: string;
}

/** CLIProxy running status */
export interface CliproxyStatus {
  running: boolean;
}

/**
 * Fetch CLIProxy stats from API
 */
async function fetchCliproxyStats(): Promise<CliproxyStats> {
  const response = await fetch('/api/cliproxy/stats');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch stats');
  }
  return response.json();
}

/**
 * Fetch CLIProxy running status
 */
async function fetchCliproxyStatus(): Promise<CliproxyStatus> {
  const response = await fetch('/api/cliproxy/status');
  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }
  return response.json();
}

/**
 * Hook to get CLIProxy running status
 */
export function useCliproxyStatus() {
  return useQuery({
    queryKey: ['cliproxy-status'],
    queryFn: fetchCliproxyStatus,
    refetchInterval: 10000, // Check every 10 seconds
    retry: 1,
  });
}

/**
 * Hook to get CLIProxy usage stats
 */
export function useCliproxyStats(enabled = true) {
  return useQuery({
    queryKey: ['cliproxy-stats'],
    queryFn: fetchCliproxyStats,
    enabled,
    refetchInterval: 5000, // Refresh every 5 seconds for near-real-time updates
    retry: 1,
    staleTime: 3000, // Consider data stale after 3 seconds
  });
}

/** CLIProxy model from /v1/models endpoint */
export interface CliproxyModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/** Categorized models response */
export interface CliproxyModelsResponse {
  models: CliproxyModel[];
  byCategory: Record<string, CliproxyModel[]>;
  totalCount: number;
}

/**
 * Fetch CLIProxy models from API
 */
async function fetchCliproxyModels(): Promise<CliproxyModelsResponse> {
  const response = await fetch('/api/cliproxy/models');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch models');
  }
  return response.json();
}

/**
 * Hook to get available CLIProxy models (categorized by provider)
 */
export function useCliproxyModels(enabled = true) {
  return useQuery({
    queryKey: ['cliproxy-models'],
    queryFn: fetchCliproxyModels,
    enabled,
    staleTime: 60000, // Models don't change often, cache for 1 minute
    retry: 1,
  });
}

/** Error log file metadata from CLIProxyAPI */
export interface CliproxyErrorLog {
  name: string;
  size: number;
  modified: number;
  /** Absolute path to the log file (injected by backend) */
  absolutePath?: string;
  /** HTTP status code extracted from log (injected by backend) */
  statusCode?: number;
  /** Model name extracted from request body (injected by backend) */
  model?: string;
}

/**
 * Fetch CLIProxy error logs from API
 */
async function fetchCliproxyErrorLogs(): Promise<CliproxyErrorLog[]> {
  const response = await fetch('/api/cliproxy/error-logs');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch error logs');
  }
  const data = await response.json();
  return data.files ?? [];
}

/**
 * Fetch specific error log content
 */
async function fetchCliproxyErrorLogContent(name: string): Promise<string> {
  const response = await fetch(`/api/cliproxy/error-logs/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch error log content');
  }
  return response.text();
}

/**
 * Hook to get CLIProxy error logs list
 */
export function useCliproxyErrorLogs(enabled = true) {
  return useQuery({
    queryKey: ['cliproxy-error-logs'],
    queryFn: fetchCliproxyErrorLogs,
    enabled,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
    staleTime: 10000,
  });
}

/**
 * Hook to get specific error log content
 */
export function useCliproxyErrorLogContent(name: string | null) {
  return useQuery({
    queryKey: ['cliproxy-error-log-content', name],
    queryFn: () => (name ? fetchCliproxyErrorLogContent(name) : Promise.resolve('')),
    enabled: !!name,
    staleTime: 60000, // Cache log content for 1 minute
  });
}

// Re-export for consumers
export type { ModelQuota, QuotaResult };

/**
 * Fetch account quota from API
 */
async function fetchAccountQuota(provider: string, accountId: string): Promise<QuotaResult> {
  const response = await fetch(`/api/cliproxy/quota/${provider}/${encodeURIComponent(accountId)}`);
  if (!response.ok) {
    let message = 'Failed to fetch quota';
    try {
      const error = await response.json();
      message = error.message || message;
    } catch {
      // Use default message if response isn't JSON
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Hook to get account quota
 * Only enabled for 'agy' provider (Antigravity) as it's the only one supporting quota
 */
export function useAccountQuota(provider: string, accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['account-quota', provider, accountId],
    queryFn: () => fetchAccountQuota(provider, accountId),
    enabled: enabled && provider === 'agy' && !!accountId,
    staleTime: 60000, // Match refetchInterval to prevent early refetching
    refetchInterval: 60000, // Refresh every 1 minute
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnMount: false, // Don't refetch on component remount (AuthMonitor re-renders)
    retry: 1,
  });
}
