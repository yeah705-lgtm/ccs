// Base adapter interface for format transformation

import type { ResolvedProvider } from '../providers/types';

// Anthropic message format (incoming)
export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

export interface AnthropicContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  // Additional content fields omitted for brevity
  // (image, tool_use, tool_result details)
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Adapter interface
export interface ProviderAdapter {
  readonly adapterType: string;

  // Transform Anthropic request to provider format
  transformRequest(req: AnthropicRequest, targetModel: string, provider: ResolvedProvider): unknown;

  // Transform provider response to Anthropic format
  transformResponse(res: unknown): AnthropicResponse;

  // Transform streaming chunk
  transformStreamChunk(chunk: unknown): string;

  // Get additional headers for this provider
  getHeaders(provider: ResolvedProvider): Record<string, string>;

  // Get endpoint URL for chat completions
  getEndpoint(provider: ResolvedProvider): string;
}

// Adapter registry type
export type AdapterRegistry = Map<string, ProviderAdapter>;
