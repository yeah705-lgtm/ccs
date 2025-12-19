/**
 * ToolCallHandler - Handle tool call processing for streaming responses
 *
 * Responsibilities:
 * - Process tool call deltas from OpenAI
 * - Generate tool_use content blocks for Anthropic format
 * - Handle input_json_delta events
 */

import type { DeltaAccumulator } from '../delta-accumulator';
import type { OpenAIToolCallDelta, OpenAIToolCall, ContentBlock, AnthropicSSEEvent } from './types';

export class ToolCallHandler {
  /**
   * Process tool calls from non-streaming response
   */
  processToolCalls(toolCalls: OpenAIToolCall[]): ContentBlock[] {
    const content: ContentBlock[] = [];

    for (const toolCall of toolCalls) {
      let parsedInput: Record<string, unknown>;
      try {
        parsedInput = JSON.parse(toolCall.function.arguments || '{}');
      } catch (parseError) {
        const err = parseError as Error;
        console.error(`[ToolCallHandler] Invalid JSON in tool arguments: ${err.message}`);
        parsedInput = { _error: 'Invalid JSON', _raw: toolCall.function.arguments };
      }

      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: parsedInput,
      });
    }

    return content;
  }

  /**
   * Process tool call deltas during streaming
   * Returns events for tool use blocks and input_json deltas
   */
  processToolCallDeltas(
    toolCallDeltas: OpenAIToolCallDelta[],
    accumulator: DeltaAccumulator
  ): AnthropicSSEEvent[] {
    const events: AnthropicSSEEvent[] = [];

    for (const toolCallDelta of toolCallDeltas) {
      // Track tool call state
      const isNewToolCall = !accumulator.hasToolCall(toolCallDelta.index);
      accumulator.addToolCallDelta(toolCallDelta);

      // Emit tool use events (start + input_json deltas)
      if (isNewToolCall) {
        // Start new tool_use block in accumulator
        const block = accumulator.startBlock('tool_use');
        const toolCall = accumulator.getToolCall(toolCallDelta.index);

        events.push({
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: block.index,
            content_block: {
              type: 'tool_use',
              id: toolCall?.id || `tool_${toolCallDelta.index}`,
              name: toolCall?.function?.name || '',
            },
          },
        });
      }

      // Emit input_json delta if arguments present
      if (toolCallDelta.function?.arguments) {
        const currentToolBlock = accumulator.getCurrentBlock();
        if (currentToolBlock && currentToolBlock.type === 'tool_use') {
          events.push({
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: currentToolBlock.index,
              delta: {
                type: 'input_json_delta',
                partial_json: toolCallDelta.function.arguments,
              },
            },
          });
        }
      }
    }

    return events;
  }
}
