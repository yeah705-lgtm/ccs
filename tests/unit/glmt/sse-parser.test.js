const assert = require('assert');
const { SSEParser } = require('../../../dist/glmt/sse-parser');

describe('SSEParser', () => {
  describe('Basic parsing', () => {
    it('parses single event', () => {
      const parser = new SSEParser();
      const events = parser.parse('data: {"test": "value"}\n\n');
      assert.strictEqual(events.length, 1, `Expected 1 event, got ${events.length}`);
      assert.strictEqual(events[0].data.test, 'value');
    });

    it('parses multiple events in one chunk', () => {
      const parser = new SSEParser();
      const events = parser.parse('data: {"a": 1}\n\ndata: {"b": 2}\n\n');
      assert.strictEqual(events.length, 2, `Expected 2 events, got ${events.length}`);
      assert.strictEqual(events[0].data.a, 1);
      assert.strictEqual(events[1].data.b, 2);
    });

    it('handles event split across chunks', () => {
      const parser = new SSEParser();
      const events1 = parser.parse('data: {"test":');
      assert.strictEqual(events1.length, 0, 'Should not emit incomplete event');
      const events2 = parser.parse('"value"}\n\n');
      assert.strictEqual(
        events2.length,
        1,
        `Expected 1 event after completion, got ${events2.length}`
      );
      assert.strictEqual(events2[0].data.test, 'value');
    });

    it('handles empty lines between events', () => {
      const parser = new SSEParser();
      const events = parser.parse('data: {"a": 1}\n\n\n\ndata: {"b": 2}\n\n');
      assert.strictEqual(events.length, 2, `Expected 2 events, got ${events.length}`);
    });
  });

  describe('[DONE] marker', () => {
    it('detects [DONE] marker', () => {
      const parser = new SSEParser();
      const events = parser.parse('data: [DONE]\n\n');
      assert.strictEqual(events.length, 1, `Expected 1 event, got ${events.length}`);
      assert.strictEqual(events[0].event, 'done');
      assert.strictEqual(events[0].data, null);
    });

    it('handles mixed events with [DONE]', () => {
      const parser = new SSEParser();
      const events = parser.parse('data: {"msg": "hello"}\n\ndata: [DONE]\n\n');
      assert.strictEqual(events.length, 2, `Expected 2 events, got ${events.length}`);
      assert.strictEqual(events[0].data.msg, 'hello');
      assert.strictEqual(events[1].event, 'done');
    });
  });

  describe('Error handling', () => {
    it('handles malformed JSON gracefully', () => {
      const parser = new SSEParser();
      const events = parser.parse('data: {invalid json}\n\ndata: {"valid": true}\n\n');
      assert.strictEqual(events.length, 1, `Expected 1 valid event, got ${events.length}`);
      assert.strictEqual(events[0].data.valid, true);
    });
  });

  describe('Event fields', () => {
    it('parses event with ID field', () => {
      const parser = new SSEParser();
      const events = parser.parse('id: 123\ndata: {"test": true}\n\n');
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].id, '123');
      assert.strictEqual(events[0].data.test, true);
    });

    it('parses custom event type', () => {
      const parser = new SSEParser();
      const events = parser.parse('event: custom\ndata: {"test": true}\n\n');
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].event, 'custom');
    });
  });

  describe('Reset functionality', () => {
    it('resets parser state', () => {
      const parser = new SSEParser();
      parser.parse('data: {"test": 1}\n\n');
      assert.strictEqual(parser.eventCount, 1);
      parser.reset();
      assert.strictEqual(parser.eventCount, 0);
      assert.strictEqual(parser.buffer, '');
    });
  });

  describe('Z.AI stream format', () => {
    it('parses real Z.AI stream format', () => {
      const parser = new SSEParser();
      const chunk =
        'data: {"choices":[{"delta":{"role":"assistant","reasoning_content":"test"}}]}\n\n';
      const events = parser.parse(chunk);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].data.choices[0].delta.reasoning_content, 'test');
    });

    it('parses multiple Z.AI deltas', () => {
      const parser = new SSEParser();
      const chunk =
        'data: {"choices":[{"delta":{"reasoning_content":"chunk1"}}]}\n\ndata: {"choices":[{"delta":{"reasoning_content":"chunk2"}}]}\n\n';
      const events = parser.parse(chunk);
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0].data.choices[0].delta.reasoning_content, 'chunk1');
      assert.strictEqual(events[1].data.choices[0].delta.reasoning_content, 'chunk2');
    });
  });
});
