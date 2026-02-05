import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// We need to mock process.platform for cross-platform testing
const originalPlatform = process.platform;

describe('escapeShellArg', () => {
  describe('Unix (non-Windows)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('wraps argument in double quotes', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('arg')).toBe('"arg"');
    });

    it('escapes inner double quotes with backslash', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('say "hello"')).toBe('"say \\"hello\\""');
    });

    it('handles paths with spaces', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('/path/to/my file')).toBe('"/path/to/my file"');
    });

    it('handles empty string', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('')).toBe('""');
    });
  });

  describe('Windows (cmd.exe)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('wraps argument in double quotes', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('arg')).toBe('"arg"');
    });

    it('escapes inner double quotes by doubling them', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('say "hello"')).toBe('"say ""hello"""');
    });

    it('escapes percent signs', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('%PATH%')).toBe('"%%PATH%%"');
    });

    it('escapes caret characters', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('a^b')).toBe('"a^^b"');
    });

    it('replaces newlines with spaces', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('line1\nline2')).toBe('"line1 line2"');
    });

    it('replaces tabs with spaces', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('col1\tcol2')).toBe('"col1 col2"');
    });

    it('handles Windows paths with spaces', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('C:\\Program Files\\App')).toBe('"C:\\Program Files\\App"');
    });

    it('escapes exclamation marks for delayed expansion', async () => {
      const { escapeShellArg } = await import('../../../src/utils/shell-executor');
      expect(escapeShellArg('hello!')).toBe('"hello^^!"');
    });
  });
});
