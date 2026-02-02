const assert = require('assert');
const ReasoningEnforcer = require('../../../dist/glmt/reasoning-enforcer').default;

describe('ReasoningEnforcer', () => {
  describe('Opt-in behavior', () => {
    it('should NOT inject when disabled and thinking=false', () => {
      const enforcer = new ReasoningEnforcer({ enabled: false });
      const messages = [{ role: 'user', content: 'What is 2+2?' }];

      const result = enforcer.injectInstruction(messages, { thinking: false });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].content, 'What is 2+2?');
    });

    it('should inject when enabled=true', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'What is 2+2?' }];

      const result = enforcer.injectInstruction(messages, { thinking: false });

      assert.ok(result[0].content.includes('CRITICAL'));
      assert.ok(result[0].content.includes('<reasoning_content>'));
    });

    it('should inject when thinking=true (even if enabled=false)', () => {
      const enforcer = new ReasoningEnforcer({ enabled: false });
      const messages = [{ role: 'user', content: 'What is 2+2?' }];

      const result = enforcer.injectInstruction(messages, { thinking: true });

      assert.ok(result[0].content.includes('CRITICAL'));
    });
  });

  describe('System message injection', () => {
    it('should prepend to system message (string content)', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Calculate 2+2' },
      ];

      const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'medium' });

      assert.strictEqual(result.length, 2);
      assert.ok(result[0].content.startsWith('You are an expert reasoning model'));
      assert.ok(result[0].content.includes('You are a helpful assistant'));
      assert.strictEqual(result[1].content, 'Calculate 2+2');
    });

    it('should prepend to system message (array content)', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [
        {
          role: 'system',
          content: [{ type: 'text', text: 'You are a code assistant.' }],
        },
        { role: 'user', content: 'Write a function' },
      ];

      const result = enforcer.injectInstruction(messages, { thinking: true });

      assert.ok(Array.isArray(result[0].content));
      assert.strictEqual(result[0].content[0].type, 'text');
      assert.ok(result[0].content[0].text.includes('CRITICAL'));
      assert.strictEqual(result[0].content[1].text, 'You are a code assistant.');
    });
  });

  describe('User message fallback', () => {
    it('should prepend to first user message when no system message', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'Explain quantum computing' }];

      const result = enforcer.injectInstruction(messages, { thinking: true });

      assert.strictEqual(result.length, 1);
      assert.ok(result[0].content.includes('CRITICAL'));
      assert.ok(result[0].content.includes('Explain quantum computing'));
    });
  });

  describe('Effort levels', () => {
    it('should use low prompt template', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'Test' }];

      const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'low' });

      assert.ok(result[0].content.toLowerCase().includes('brief analysis'));
    });

    it('should use medium prompt template', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'Test' }];

      const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'medium' });

      assert.ok(result[0].content.toLowerCase().includes('think step-by-step'));
    });

    it('should use high prompt template', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'Test' }];

      const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'high' });

      assert.ok(result[0].content.toLowerCase().includes('think deeply and systematically'));
    });

    it('should use max prompt template', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'Test' }];

      const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'max' });

      assert.ok(result[0].content.toLowerCase().includes('exhaustively from first principles'));
    });

    it('should default to medium effort if not specified', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'user', content: 'Test' }];

      const result = enforcer.injectInstruction(messages, { thinking: true });

      assert.ok(result[0].content.includes('think step-by-step'));
    });
  });

  describe('Edge cases', () => {
    it('should handle empty messages array', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const result = enforcer.injectInstruction([], { thinking: true });

      assert.strictEqual(result.length, 0);
    });

    it('should handle messages with no system or user role', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const messages = [{ role: 'assistant', content: 'Previous response' }];

      const result = enforcer.injectInstruction(messages, { thinking: true });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].content, 'Previous response');
    });

    it('should not mutate original messages array', () => {
      const enforcer = new ReasoningEnforcer({ enabled: true });
      const originalMessages = [{ role: 'user', content: 'Test prompt' }];
      const originalCopy = JSON.parse(JSON.stringify(originalMessages));

      enforcer.injectInstruction(originalMessages, { thinking: true });

      assert.deepStrictEqual(originalMessages, originalCopy);
    });

    it('should handle custom prompts via constructor', () => {
      const customPrompts = {
        low: 'Custom low prompt',
        medium: 'Custom medium prompt',
        high: 'Custom high prompt',
        max: 'Custom max prompt',
      };
      const enforcer = new ReasoningEnforcer({ enabled: true, prompts: customPrompts });
      const messages = [{ role: 'user', content: 'Test' }];

      const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'low' });

      assert.ok(result[0].content.includes('Custom low prompt'));
    });
  });
});
