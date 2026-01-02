import type { ProviderAdapter, AnthropicRequest, AnthropicResponse } from './base';
import type { ResolvedProvider } from '../providers/types';

export interface CustomAdapterConfig {
  // Request transformation (JavaScript code as string)
  transformRequest?: string;
  // Response transformation (JavaScript code as string)
  transformResponse?: string;
  // Endpoint path
  endpoint?: string;
}

/**
 * Custom adapter for user-defined transformations
 * Uses configurable transformation functions
 */
export class CustomAdapter implements ProviderAdapter {
  readonly adapterType = 'custom' as const;

  private config: CustomAdapterConfig;

  constructor(config: CustomAdapterConfig = {}) {
    this.config = config;
  }

  transformRequest(
    req: AnthropicRequest,
    targetModel: string,
    provider: ResolvedProvider
  ): unknown {
    // If custom transform provided, use it
    if (this.config.transformRequest) {
      // Note: In production, use safer evaluation method
      const transform = new Function(
        'req',
        'targetModel',
        'provider',
        this.config.transformRequest
      );
      return transform(req, targetModel, provider);
    }

    // Default: passthrough with model update
    return { ...req, model: targetModel };
  }

  transformResponse(res: unknown): AnthropicResponse {
    if (this.config.transformResponse) {
      const transform = new Function('res', this.config.transformResponse);
      return transform(res);
    }
    return res as AnthropicResponse;
  }

  transformStreamChunk(chunk: unknown): string {
    // Custom adapters passthrough streaming by default
    return chunk as string;
  }

  getHeaders(provider: ResolvedProvider): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.authToken) {
      headers['Authorization'] = `Bearer ${provider.authToken}`;
    }

    if (provider.headers) {
      Object.assign(headers, provider.headers);
    }

    return headers;
  }

  getEndpoint(provider: ResolvedProvider): string {
    return `${provider.baseUrl}${this.config.endpoint || '/v1/messages'}`;
  }
}

/**
 * Create custom adapter from config
 */
export function createCustomAdapter(config: CustomAdapterConfig): CustomAdapter {
  return new CustomAdapter(config);
}
