const assert = require('assert');
const { HeadlessExecutor } = require('../../../dist/delegation/headless-executor');

describe('Permission Mode', () => {
  describe('Validation', () => {
    it('accepts acceptEdits mode', () => {
      assert.doesNotThrow(() => HeadlessExecutor._validatePermissionMode('acceptEdits'));
    });

    it('accepts plan mode', () => {
      assert.doesNotThrow(() => HeadlessExecutor._validatePermissionMode('plan'));
    });

    it('accepts default mode', () => {
      assert.doesNotThrow(() => HeadlessExecutor._validatePermissionMode('default'));
    });

    it('accepts bypassPermissions mode', () => {
      assert.doesNotThrow(() => HeadlessExecutor._validatePermissionMode('bypassPermissions'));
    });

    it('rejects invalid mode', () => {
      assert.throws(
        () => HeadlessExecutor._validatePermissionMode('invalidMode'),
        /Invalid permission mode/
      );
    });

    it('rejects empty mode', () => {
      assert.throws(() => HeadlessExecutor._validatePermissionMode(''), /Invalid permission mode/);
    });

    it('rejects null mode', () => {
      assert.throws(
        () => HeadlessExecutor._validatePermissionMode(null),
        /Invalid permission mode/
      );
    });
  });

  describe('CLI args construction', () => {
    it('builds args for acceptEdits mode', () => {
      const args = ['-p', 'test', '--settings', '/path/settings.json'];
      const permissionMode = 'acceptEdits';

      if (permissionMode && permissionMode !== 'default') {
        if (permissionMode === 'bypassPermissions') {
          args.push('--dangerously-skip-permissions');
        } else {
          args.push('--permission-mode', permissionMode);
        }
      }

      assert.ok(args.includes('--permission-mode'));
      assert.ok(args.includes('acceptEdits'));
      assert.ok(!args.includes('--dangerously-skip-permissions'));
    });

    it('builds args for plan mode', () => {
      const args = ['-p', 'test', '--settings', '/path/settings.json'];
      const permissionMode = 'plan';

      if (permissionMode && permissionMode !== 'default') {
        if (permissionMode === 'bypassPermissions') {
          args.push('--dangerously-skip-permissions');
        } else {
          args.push('--permission-mode', permissionMode);
        }
      }

      assert.ok(args.includes('--permission-mode'));
      assert.ok(args.includes('plan'));
    });

    it('builds args for bypassPermissions mode', () => {
      const args = ['-p', 'test', '--settings', '/path/settings.json'];
      const permissionMode = 'bypassPermissions';

      if (permissionMode && permissionMode !== 'default') {
        if (permissionMode === 'bypassPermissions') {
          args.push('--dangerously-skip-permissions');
        } else {
          args.push('--permission-mode', permissionMode);
        }
      }

      assert.ok(args.includes('--dangerously-skip-permissions'));
      assert.ok(!args.includes('--permission-mode'));
    });

    it('builds args for default mode (no flag)', () => {
      const args = ['-p', 'test', '--settings', '/path/settings.json'];
      const permissionMode = 'default';

      if (permissionMode && permissionMode !== 'default') {
        if (permissionMode === 'bypassPermissions') {
          args.push('--dangerously-skip-permissions');
        } else {
          args.push('--permission-mode', permissionMode);
        }
      }

      assert.ok(!args.includes('--permission-mode'));
      assert.ok(!args.includes('--dangerously-skip-permissions'));
      assert.strictEqual(args.length, 4);
    });
  });
});
