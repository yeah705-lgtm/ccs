import type { ProviderAdapter, AnthropicRequest, AnthropicResponse } from './base';
import type { ResolvedProvider } from '../providers/types';
import {
  anthropicToOpenAI,
  openAIToAnthropic,
  convertStreamChunk,
  type OpenAIRequest,
  type OpenAIResponse,
} from './transform';

/**
 * OpenAI-compatible adapter
 * Used for: GLM, Kimi, DeepSeek, and other OpenAI-format APIs
 */
export class OpenAICompatAdapter implements ProviderAdapter {
  readonly adapterType = 'openai-compat' as const;

  transformRequest(
    req: AnthropicRequest,
    targetModel: string,
    _provider: ResolvedProvider
  ): OpenAIRequest {
    const openaiReq = anthropicToOpenAI(req);
    return {
      ...openaiReq,
      model: targetModel,
    };
  }

  transformResponse(res: unknown): AnthropicResponse {
    return openAIToAnthropic(res as OpenAIResponse);
  }

  transformStreamChunk(chunk: unknown): string {
    return convertStreamChunk(chunk as string);
  }

  getHeaders(provider: ResolvedProvider): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.authToken) {
      headers['Authorization'] = `Bearer ${provider.authToken}`;
    }

    // Merge any custom headers
    if (provider.headers) {
      Object.assign(headers, provider.headers);
    }

    return headers;
  }

  getEndpoint(provider: ResolvedProvider): string {
    // OpenAI-compatible endpoint
    return `${provider.baseUrl}/chat/completions`;
  }
}

// Singleton instance
export const openaiCompatAdapter = new OpenAICompatAdapter();
