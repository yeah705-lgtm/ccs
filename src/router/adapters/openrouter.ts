import type { ResolvedProvider } from '../providers/types';
import { OpenAICompatAdapter } from './openai-compat';

/**
 * OpenRouter adapter
 * Extends OpenAI-compatible with required OpenRouter headers
 */
export class OpenRouterAdapter extends OpenAICompatAdapter {
  constructor() {
    super();
    // @ts-expect-error - Overriding readonly property for type narrowing
    this.adapterType = 'openrouter';
  }

  override getHeaders(provider: ResolvedProvider): Record<string, string> {
    const baseHeaders = super.getHeaders(provider);

    // OpenRouter requires these headers
    return {
      ...baseHeaders,
      'HTTP-Referer': 'https://ccs.kaitran.ca',
      'X-Title': 'CCS CLI',
    };
  }
}

// Singleton instance
export const openRouterAdapter = new OpenRouterAdapter();
