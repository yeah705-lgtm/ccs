/**
 * CLIProxyAPI Stats Fetcher
 *
 * Fetches usage statistics from CLIProxyAPI's management API.
 * Requires usage-statistics-enabled: true in config.yaml.
 */

import { CCS_CONTROL_PANEL_SECRET, CLIPROXY_DEFAULT_PORT } from './config-generator';

/** Usage statistics from CLIProxyAPI */
export interface CliproxyStats {
  /** Total number of requests processed */
  totalRequests: number;
  /** Token counts */
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  /** Requests grouped by model */
  requestsByModel: Record<string, number>;
  /** Requests grouped by provider */
  requestsByProvider: Record<string, number>;
  /** Number of quota exceeded (429) events */
  quotaExceededCount: number;
  /** Number of request retries */
  retryCount: number;
  /** Timestamp of stats collection */
  collectedAt: string;
}

/** Usage API response from CLIProxyAPI /v0/management/usage endpoint */
interface UsageApiResponse {
  failed_requests?: number;
  usage?: {
    total_requests?: number;
    success_count?: number;
    failure_count?: number;
    total_tokens?: number;
    apis?: Record<
      string,
      {
        total_requests?: number;
        total_tokens?: number;
        models?: Record<
          string,
          {
            total_requests?: number;
            total_tokens?: number;
          }
        >;
      }
    >;
  };
}

/**
 * Fetch usage statistics from CLIProxyAPI management API
 * @param port CLIProxyAPI port (default: 8317)
 * @returns Stats object or null if unavailable
 */
export async function fetchCliproxyStats(
  port: number = CLIPROXY_DEFAULT_PORT
): Promise<CliproxyStats | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(`http://127.0.0.1:${port}/v0/management/usage`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${CCS_CONTROL_PANEL_SECRET}`,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as UsageApiResponse;
    const usage = data.usage;

    // Extract models and providers from the nested API structure
    const requestsByModel: Record<string, number> = {};
    const requestsByProvider: Record<string, number> = {};

    if (usage?.apis) {
      for (const [provider, providerData] of Object.entries(usage.apis)) {
        requestsByProvider[provider] = providerData.total_requests ?? 0;
        if (providerData.models) {
          for (const [model, modelData] of Object.entries(providerData.models)) {
            requestsByModel[model] = modelData.total_requests ?? 0;
          }
        }
      }
    }

    // Normalize the response to our interface
    return {
      totalRequests: usage?.total_requests ?? 0,
      tokens: {
        input: 0, // API doesn't provide input/output breakdown
        output: 0,
        total: usage?.total_tokens ?? 0,
      },
      requestsByModel,
      requestsByProvider,
      quotaExceededCount: usage?.failure_count ?? data.failed_requests ?? 0,
      retryCount: 0, // API doesn't track retries separately
      collectedAt: new Date().toISOString(),
    };
  } catch {
    // CLIProxyAPI not running or stats endpoint not available
    return null;
  }
}

/** OpenAI-compatible model object from /v1/models endpoint */
export interface CliproxyModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/** Response from /v1/models endpoint */
interface ModelsApiResponse {
  data: CliproxyModel[];
  object: string;
}

/** Categorized models response for UI */
export interface CliproxyModelsResponse {
  models: CliproxyModel[];
  byCategory: Record<string, CliproxyModel[]>;
  totalCount: number;
}

/**
 * Fetch available models from CLIProxyAPI /v1/models endpoint
 * @param port CLIProxyAPI port (default: 8317)
 * @returns Categorized models or null if unavailable
 */
export async function fetchCliproxyModels(
  port: number = CLIPROXY_DEFAULT_PORT
): Promise<CliproxyModelsResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Use the internal API key for /v1 endpoints
        Authorization: 'Bearer ccs-internal-managed',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ModelsApiResponse;

    // Group models by owned_by field
    const byCategory: Record<string, CliproxyModel[]> = {};
    for (const model of data.data) {
      const category = model.owned_by || 'other';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(model);
    }

    // Sort models within each category alphabetically
    for (const category of Object.keys(byCategory)) {
      byCategory[category].sort((a, b) => a.id.localeCompare(b.id));
    }

    return {
      models: data.data,
      byCategory,
      totalCount: data.data.length,
    };
  } catch {
    return null;
  }
}

/**
 * Check if CLIProxyAPI is running and responsive
 * @param port CLIProxyAPI port (default: 8317)
 * @returns true if proxy is running
 */
export async function isCliproxyRunning(port: number = CLIPROXY_DEFAULT_PORT): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout

    // Use root endpoint - CLIProxyAPI returns server info at /
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
