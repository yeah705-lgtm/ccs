const assert = require('assert');
const { DeltaAccumulator } = require('../../../dist/glmt/delta-accumulator');

describe('DeltaAccumulator', () => {
  describe('Initialization', () => {
    it('has correct initial state', () => {
      const acc = new DeltaAccumulator();
      assert(acc.messageId.startsWith('msg_'), 'Message ID should start with msg_');
      assert.strictEqual(acc.role, 'assistant');
      assert.strictEqual(acc.contentBlocks.length, 0);
      assert.strictEqual(acc.currentBlockIndex, -1);
      assert.strictEqual(acc.messageStarted, false);
      assert.strictEqual(acc.finalized, false);
    });

    it('accepts config options', () => {
      const acc = new DeltaAccumulator({}, { loopDetectionThreshold: 5 });
      assert.strictEqual(acc.loopDetectionThreshold, 5);
    });
  });

  describe('Block management', () => {
    it('starts thinking block', () => {
      const acc = new DeltaAccumulator();
      const block = acc.startBlock('thinking');
      assert.strictEqual(block.type, 'thinking');
      assert.strictEqual(block.index, 0);
      assert.strictEqual(block.started, true);
      assert.strictEqual(block.stopped, false);
      assert.strictEqual(acc.contentBlocks.length, 1);
      assert.strictEqual(acc.currentBlockIndex, 0);
    });

    it('starts text block', () => {
      const acc = new DeltaAccumulator();
      const block = acc.startBlock('text');
      assert.strictEqual(block.type, 'text');
      assert.strictEqual(block.index, 0);
    });

    it('adds delta to thinking block', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Hello ');
      acc.addDelta('world');
      const block = acc.getCurrentBlock();
      assert.strictEqual(block.content, 'Hello world');
      assert.strictEqual(acc.thinkingBuffer, 'Hello world');
    });

    it('adds delta to text block', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('text');
      acc.addDelta('Answer: ');
      acc.addDelta('42');
      const block = acc.getCurrentBlock();
      assert.strictEqual(block.content, 'Answer: 42');
      assert.strictEqual(acc.textBuffer, 'Answer: 42');
    });

    it('handles multiple blocks (thinking → text)', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Analyzing...');
      acc.startBlock('text');
      acc.addDelta('The answer is 42');

      assert.strictEqual(acc.contentBlocks.length, 2);
      assert.strictEqual(acc.currentBlockIndex, 1);
      assert.strictEqual(acc.contentBlocks[0].type, 'thinking');
      assert.strictEqual(acc.contentBlocks[1].type, 'text');
      assert.strictEqual(acc.contentBlocks[0].content, 'Analyzing...');
      assert.strictEqual(acc.contentBlocks[1].content, 'The answer is 42');
    });

    it('stops current block', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Done');
      acc.stopCurrentBlock();
      const block = acc.getCurrentBlock();
      assert.strictEqual(block.stopped, true);
    });

    it('returns null when no blocks exist', () => {
      const acc = new DeltaAccumulator();
      const block = acc.getCurrentBlock();
      assert.strictEqual(block, null);
    });
  });

  describe('Usage statistics', () => {
    it('updates usage statistics', () => {
      const acc = new DeltaAccumulator();
      acc.updateUsage({ prompt_tokens: 100, completion_tokens: 50 });
      assert.strictEqual(acc.inputTokens, 100);
      assert.strictEqual(acc.outputTokens, 50);
    });
  });

  describe('Summary', () => {
    it('gets correct summary', () => {
      const acc = new DeltaAccumulator();
      acc.model = 'glm-4.6';
      acc.startBlock('thinking');
      acc.addDelta('test');
      acc.updateUsage({ prompt_tokens: 10, completion_tokens: 20 });

      const summary = acc.getSummary();
      assert.strictEqual(summary.messageId, acc.messageId);
      assert.strictEqual(summary.model, 'glm-4.6');
      assert.strictEqual(summary.role, 'assistant');
      assert.strictEqual(summary.blockCount, 1);
      assert.strictEqual(summary.usage.input_tokens, 10);
      assert.strictEqual(summary.usage.output_tokens, 20);
    });
  });

  describe('Message lifecycle', () => {
    it('tracks lifecycle flags', () => {
      const acc = new DeltaAccumulator();
      assert.strictEqual(acc.messageStarted, false);
      acc.messageStarted = true;
      assert.strictEqual(acc.messageStarted, true);
      acc.finalized = true;
      assert.strictEqual(acc.finalized, true);
    });

    it('tracks finish reason', () => {
      const acc = new DeltaAccumulator();
      assert.strictEqual(acc.finishReason, null);
      acc.finishReason = 'stop';
      assert.strictEqual(acc.finishReason, 'stop');
    });
  });

  describe('Loop detection', () => {
    it('does not detect loop below threshold', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Thinking 1');
      acc.startBlock('thinking');
      acc.addDelta('Thinking 2');

      const hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, false);
      assert.strictEqual(acc.loopDetected, false);
    });

    it('detects loop with 3 consecutive thinking blocks', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Planning step 1...');
      acc.startBlock('thinking');
      acc.addDelta('Planning step 2...');
      acc.startBlock('thinking');
      acc.addDelta('Planning step 3...');

      const hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, true);
      assert.strictEqual(acc.loopDetected, true);

      const summary = acc.getSummary();
      assert.strictEqual(summary.loopDetected, true);
    });

    it('does not detect loop when tool calls present', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Thinking 1');
      acc.startBlock('thinking');
      acc.addDelta('Thinking 2');

      acc.addToolCallDelta({
        index: 0,
        id: 'call_123',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path": "test.js"}' },
      });

      acc.startBlock('thinking');
      acc.addDelta('Thinking 3');

      const hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, false);
      assert.strictEqual(acc.loopDetected, false);
    });

    it('does not detect loop with mixed block types', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.addDelta('Thinking 1');
      acc.startBlock('text');
      acc.addDelta('Some text');
      acc.startBlock('thinking');
      acc.addDelta('Thinking 2');
      acc.startBlock('thinking');
      acc.addDelta('Thinking 3');

      const hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, false);
    });

    it('respects custom threshold', () => {
      const acc = new DeltaAccumulator({}, { loopDetectionThreshold: 5 });

      for (let i = 0; i < 4; i++) {
        acc.startBlock('thinking');
        acc.addDelta(`Thinking ${i + 1}`);
      }

      let hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, false);

      acc.startBlock('thinking');
      acc.addDelta('Thinking 5');

      hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, true);
    });

    it('resets loop detection state', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.startBlock('thinking');
      acc.startBlock('thinking');
      acc.checkForLoop();

      assert.strictEqual(acc.loopDetected, true);
      acc.resetLoopDetection();
      assert.strictEqual(acc.loopDetected, false);

      const hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, true);
    });

    it('persists after first detection', () => {
      const acc = new DeltaAccumulator();
      acc.startBlock('thinking');
      acc.startBlock('thinking');
      acc.startBlock('thinking');
      acc.checkForLoop();

      assert.strictEqual(acc.loopDetected, true);

      acc.startBlock('thinking');
      acc.startBlock('thinking');

      const hasLoop = acc.checkForLoop();
      assert.strictEqual(hasLoop, true);
    });
  });

  describe('Tool call tracking', () => {
    it('tracks tool calls correctly', () => {
      const acc = new DeltaAccumulator();

      acc.addToolCallDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'test', arguments: '{"a":' },
      });

      acc.addToolCallDelta({
        index: 0,
        function: { arguments: '1}' },
      });

      const toolCalls = acc.getToolCalls();
      assert.strictEqual(toolCalls.length, 1);
      assert.strictEqual(toolCalls[0].function.arguments, '{"a":1}');

      const summary = acc.getSummary();
      assert.strictEqual(summary.toolCallCount, 1);
    });
  });
});
