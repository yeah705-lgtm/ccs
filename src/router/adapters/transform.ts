import type { AnthropicContent, AnthropicRequest } from './base';

// OpenAI message format
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIContentPart[];
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAITool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: OpenAITool[];
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * Convert Anthropic messages to OpenAI format
 */
export function anthropicToOpenAI(req: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];

  // Add system message if present
  if (req.system) {
    messages.push({ role: 'system', content: req.system });
  }

  // Convert messages
  for (const msg of req.messages) {
    messages.push({
      role: msg.role,
      content: convertAnthropicContent(msg.content),
    });
  }

  return {
    model: req.model, // Will be replaced by adapter
    messages,
    max_tokens: req.max_tokens,
    temperature: req.temperature,
    stream: req.stream,
  };
}

/**
 * Convert Anthropic content to OpenAI content
 */
function convertAnthropicContent(
  content: string | AnthropicContent[]
): string | OpenAIContentPart[] {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((c) => {
    if (c.type === 'text') {
      return { type: 'text' as const, text: c.text || '' };
    }
    if (c.type === 'image') {
      return {
        type: 'image_url' as const,
        image_url: { url: c.text || '' },
      };
    }
    // Default to text for unknown types
    return { type: 'text' as const, text: JSON.stringify(c) };
  });
}

/**
 * Convert OpenAI response to Anthropic format
 */
export function openAIToAnthropic(res: OpenAIResponse): {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: { input_tokens: number; output_tokens: number };
} {
  const choice = res.choices[0];

  return {
    id: res.id,
    type: 'message',
    role: 'assistant',
    content: convertOpenAIContent(choice.message.content),
    model: res.model,
    stop_reason: mapFinishReason(choice.finish_reason),
    usage: {
      input_tokens: res.usage.prompt_tokens,
      output_tokens: res.usage.completion_tokens,
    },
  };
}

/**
 * Convert OpenAI content to Anthropic content
 */
function convertOpenAIContent(content: string | OpenAIContentPart[] | null): AnthropicContent[] {
  if (!content) {
    return [{ type: 'text', text: '' }];
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map((c) => ({
    type: 'text' as const,
    text: c.text || '',
  }));
}

/**
 * Map OpenAI finish reason to Anthropic stop reason
 */
function mapFinishReason(reason: string): 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' {
  switch (reason) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}

/**
 * Convert OpenAI SSE chunk to Anthropic SSE format
 */
export function convertStreamChunk(openaiChunk: string): string {
  // Parse OpenAI SSE: data: {"id":"...","choices":[{"delta":{"content":"..."}}]}
  if (!openaiChunk.startsWith('data: ')) {
    return openaiChunk;
  }

  const jsonStr = openaiChunk.slice(6);
  if (jsonStr === '[DONE]') {
    return 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  }

  try {
    const data = JSON.parse(jsonStr);
    const delta = data.choices?.[0]?.delta;

    if (delta?.content) {
      return `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: delta.content },
      })}\n\n`;
    }
  } catch {
    // Return as-is if parsing fails
  }

  return '';
}
