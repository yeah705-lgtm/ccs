// Base interface
export type {
  ProviderAdapter,
  AnthropicRequest,
  AnthropicResponse,
  AnthropicMessage,
  AnthropicContent,
  AdapterRegistry,
} from './base';

// Adapters
export { AnthropicAdapter, anthropicAdapter } from './anthropic';
export { OpenAICompatAdapter, openaiCompatAdapter } from './openai-compat';
export { OpenRouterAdapter, openRouterAdapter } from './openrouter';
export { CustomAdapter, createCustomAdapter } from './custom';
export type { CustomAdapterConfig } from './custom';

// Transform utilities
export { anthropicToOpenAI, openAIToAnthropic, convertStreamChunk } from './transform';
export type { OpenAIRequest, OpenAIResponse, OpenAIMessage, OpenAIChoice } from './transform';

// Adapter registry
import type { AdapterRegistry, ProviderAdapter } from './base';
import { anthropicAdapter } from './anthropic';
import { openaiCompatAdapter } from './openai-compat';
import { openRouterAdapter } from './openrouter';

export const adapters: AdapterRegistry = new Map<string, ProviderAdapter>([
  ['anthropic', anthropicAdapter],
  ['openai-compat', openaiCompatAdapter],
  ['openrouter', openRouterAdapter],
]);

export function getAdapter(type: string): ProviderAdapter | undefined {
  return adapters.get(type);
}
