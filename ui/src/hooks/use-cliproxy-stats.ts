/**
 * React Query hook for CLIProxyAPI stats
 */

import { useQuery } from '@tanstack/react-query';

/** CLIProxy usage statistics */
export interface CliproxyStats {
  totalRequests: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  requestsByModel: Record<string, number>;
  requestsByProvider: Record<string, number>;
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
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
    staleTime: 10000, // Consider data stale after 10 seconds
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
